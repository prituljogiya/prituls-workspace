import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

type SubtaskDraft = { title: string; description?: string | null };

function extractSubtasks(content: string, preferObject: boolean): SubtaskDraft[] {
  const parsed = JSON.parse(content);

  if (preferObject && parsed?.subtasks && Array.isArray(parsed.subtasks)) {
    return parsed.subtasks;
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed?.subtasks && Array.isArray(parsed.subtasks)) {
    return parsed.subtasks;
  }

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const arr = JSON.parse(jsonMatch[0]);
    if (Array.isArray(arr)) return arr;
  }

  throw new Error('Invalid subtasks JSON shape');
}

/** Offline fallback when AI providers are unavailable / out of quota */
function localSubtasks(title: string, description?: string): SubtaskDraft[] {
  const focus = title.trim() || 'the task';
  const extras = description?.trim()
    ? [
        {
          title: `Clarify details for ${focus}`,
          description: description.trim().slice(0, 200),
        },
      ]
    : [];

  return [
    ...extras,
    { title: `Break down requirements for ${focus}`, description: 'List acceptance criteria and constraints' },
    { title: `Design approach for ${focus}`, description: 'Sketch solution and identify dependencies' },
    { title: `Implement core work for ${focus}`, description: 'Build the main functionality' },
    { title: `Write tests for ${focus}`, description: 'Cover happy path and key edge cases' },
    { title: `Review and polish ${focus}`, description: 'Code review, cleanup, and docs' },
    { title: `Verify and close ${focus}`, description: 'QA check and mark ready for done' },
  ];
}

function parseOpenAiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const code = parsed?.error?.code;
    const message = parsed?.error?.message || raw;

    if (code === 'insufficient_quota' || /exceeded your current quota/i.test(message)) {
      return 'OpenAI quota exceeded. Add billing/credits at https://platform.openai.com/account/billing, or set GROQ_API_KEY for a free fallback.';
    }
    if (code === 'invalid_api_key' || /incorrect api key/i.test(message)) {
      return 'Invalid OPENAI_API_KEY. Check backend/.env and restart the server.';
    }
    if (code === 'model_not_found') {
      return 'OpenAI model not found. Set OPENAI_MODEL in backend/.env (e.g. gpt-4o-mini).';
    }
    return message;
  } catch {
    return raw.slice(0, 300) || 'AI provider request failed';
  }
}

// Generate subtasks using AI
router.post(
  '/generate-subtasks',
  authenticate,
  [
    body('taskTitle').notEmpty().withMessage('Task title is required'),
    body('taskDescription').optional({ nullable: true }).isString(),
    body('taskId').notEmpty().withMessage('Task ID is required'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err: any) => `${err.param}: ${err.msg}`).join(', ');
        console.error('Validation errors:', errorMessages);
        return res.status(400).json({
          error: `Validation failed: ${errorMessages}`,
          errors: errors.array(),
        });
      }

      const { taskTitle, taskDescription, taskId } = req.body;

      if (!taskTitle || String(taskTitle).trim() === '') {
        return res.status(400).json({ error: 'Task title is required and cannot be empty' });
      }

      if (!taskId || String(taskId).trim() === '') {
        return res.status(400).json({ error: 'Task ID is required and cannot be empty' });
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const openAIKey = process.env.OPENAI_API_KEY?.trim();
      const groqKey = process.env.GROQ_API_KEY?.trim();

      if (!openAIKey && !groqKey) {
        return res.status(500).json({
          error:
            'AI API key not configured. Set OPENAI_API_KEY (ChatGPT) or GROQ_API_KEY in backend/.env, then restart the backend.',
        });
      }

      // Prefer OpenAI; if it fails with quota/auth, fall back to Groq when available
      const providers: Array<{
        name: 'openai' | 'groq';
        apiKey: string;
        apiUrl: string;
        model: string;
        preferObject: boolean;
      }> = [];

      if (openAIKey) {
        providers.push({
          name: 'openai',
          apiKey: openAIKey,
          apiUrl: 'https://api.openai.com/v1/chat/completions',
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          preferObject: true,
        });
      }
      if (groqKey) {
        providers.push({
          name: 'groq',
          apiKey: groqKey,
          apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          preferObject: false,
        });
      }

      const title = String(taskTitle).trim();
      const description =
        taskDescription && String(taskDescription).trim()
          ? String(taskDescription).trim()
          : '';

      const openAiPrompt = `Given the following task, generate a list of subtasks that need to be completed.

Task Title: ${title}
${description ? `Task Description: ${description}` : ''}

Please generate 5-8 specific, actionable subtasks. Each subtask should be:
1. Clear and specific
2. Actionable (can be completed independently)
3. Relevant to the main task

Return a JSON object with a "subtasks" array, where each object has:
- "title": string (the subtask title)
- "description": string (optional brief description)

Example format:
{
  "subtasks": [
    {"title": "Create UI mockup in Figma", "description": "Design the user interface layout"},
    {"title": "Build login page component", "description": "Implement the login form with validation"}
  ]
}`;

      const groqPrompt = `Given the following task, generate a list of subtasks that need to be completed:

Task Title: ${title}
${description ? `Task Description: ${description}` : ''}

Please generate 5-8 specific, actionable subtasks.

Format your response as a JSON array of objects, where each object has:
- "title": string
- "description": string (optional)

Example:
[{"title":"Research requirements","description":"Gather constraints"}]

Return only the JSON array, no additional text.`;

      let lastError = 'Failed to generate subtasks';
      let content: string | null = null;
      let usedProvider: string | null = null;
      let drafted: SubtaskDraft[] | null = null;

      for (const provider of providers) {
        const prompt = provider.name === 'openai' ? openAiPrompt : groqPrompt;
        const response = await fetch(provider.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              {
                role: 'system',
                content:
                  provider.name === 'openai'
                    ? 'You are a helpful project planning assistant. Always respond with valid JSON only.'
                    : 'You are a helpful project planning assistant. Respond with a JSON array only.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 1500,
            ...(provider.name === 'openai' ? { response_format: { type: 'json_object' } } : {}),
          }),
        });

        if (!response.ok) {
          const raw = await response.text();
          console.error(`${provider.name} API error:`, raw);
          lastError = parseOpenAiError(raw);
          continue;
        }

        const data = await response.json();
        content = data.choices?.[0]?.message?.content || null;
        if (!content) {
          lastError = `No response from ${provider.name}`;
          continue;
        }

        try {
          const subtasks = extractSubtasks(content, provider.preferObject)
            .filter((s) => s && typeof s.title === 'string' && s.title.trim())
            .map((s) => ({
              title: String(s.title).trim(),
              description: s.description ? String(s.description).trim() : null,
            }));

          if (subtasks.length === 0) {
            lastError = 'AI returned no usable subtasks';
            content = null;
            continue;
          }

          drafted = subtasks;
          usedProvider = provider.name;
          break;
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          console.error('Parse error:', parseError);
          lastError = 'Failed to parse AI response';
          content = null;
        }
      }

      // Local fallback when OpenAI/Groq unavailable (e.g. insufficient_quota)
      if (!drafted) {
        console.warn('Using local subtask generator. Last AI error:', lastError);
        drafted = localSubtasks(title, description || undefined);
        usedProvider = 'local';
      }

      const maxOrder = await prisma.subtask.findFirst({
        where: { taskId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const startOrder = (maxOrder?.order ?? -1) + 1;

      const createdSubtasks = await Promise.all(
        drafted.map((subtask, index) =>
          prisma.subtask.create({
            data: {
              taskId,
              title: subtask.title,
              description: subtask.description || null,
              order: startOrder + index,
              isAIGenerated: usedProvider !== 'local',
            },
          })
        )
      );

      return res.json({
        subtasks: createdSubtasks,
        provider: usedProvider,
        warning:
          usedProvider === 'local'
            ? lastError || 'AI unavailable; generated local template subtasks.'
            : undefined,
      });
    } catch (error) {
      console.error('Generate subtasks error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate subtasks',
      });
    }
  }
);

export default router;