import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Generate subtasks using AI
router.post(
  '/generate-subtasks',
  authenticate,
  [
    body('taskTitle').notEmpty().withMessage('Task title is required'),
    body('taskDescription').optional().isString(),
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
          errors: errors.array() 
        });
      }

      const { taskTitle, taskDescription, taskId } = req.body;
      
      // Additional validation
      if (!taskTitle || taskTitle.trim() === '') {
        return res.status(400).json({ error: 'Task title is required and cannot be empty' });
      }
      
      if (!taskId || taskId.trim() === '') {
        return res.status(400).json({ error: 'Task ID is required and cannot be empty' });
      }

      // Check if task exists
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Use OpenAI (ChatGPT) or Groq API - prioritize OpenAI
      const openAIKey = process.env.OPENAI_API_KEY;
      const groqKey = process.env.GROQ_API_KEY;
      const isOpenAI = !!openAIKey;
      
      let apiKey: string;
      let apiUrl: string;
      let model: string;
      
      if (openAIKey) {
        // Use ChatGPT/OpenAI
        apiKey = openAIKey;
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        // Use gpt-4 if available, fallback to gpt-3.5-turbo
        model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      } else if (groqKey) {
        // Fallback to Groq
        apiKey = groqKey;
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        model = 'llama-3.1-8b-instant';
      } else {
        return res.status(500).json({
          error: 'AI API key not configured. Please set OPENAI_API_KEY (for ChatGPT) or GROQ_API_KEY in environment variables.',
        });
      }

      const prompt = isOpenAI
        ? `Given the following task, generate a list of subtasks that need to be completed.

Task Title: ${taskTitle.trim()}
${taskDescription && taskDescription.trim() ? `Task Description: ${taskDescription.trim()}` : ''}

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
    {"title": "Build login page component", "description": "Implement the login form with validation"},
    {"title": "Integrate authentication API", "description": "Connect frontend to backend auth endpoint"}
  ]
}`
        : `Given the following task, generate a list of subtasks that need to be completed:

Task Title: ${taskTitle.trim()}
${taskDescription && taskDescription.trim() ? `Task Description: ${taskDescription.trim()}` : ''}

Please generate 5-8 specific, actionable subtasks. Each subtask should be:
1. Clear and specific
2. Actionable (can be completed independently)
3. Relevant to the main task

Format your response as a JSON array of objects, where each object has:
- "title": string (the subtask title)
- "description": string (optional brief description)

Example format:
[
  {"title": "Create UI mockup in Figma", "description": "Design the user interface layout"},
  {"title": "Build login page component", "description": "Implement the login form with validation"},
  {"title": "Integrate authentication API", "description": "Connect frontend to backend auth endpoint"}
]

Return only the JSON array, no additional text.`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
          ...(isOpenAI && { response_format: { type: 'json_object' } }),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('AI API error:', error);
        return res.status(500).json({ error: 'Failed to generate subtasks' });
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        return res.status(500).json({ error: 'No response from AI' });
      }

      // Parse JSON from response
      let subtasks;
      try {
        const parsed = JSON.parse(content);
        
        // OpenAI returns { subtasks: [...] }, Groq returns [...]
        if (isOpenAI && parsed.subtasks && Array.isArray(parsed.subtasks)) {
          subtasks = parsed.subtasks;
        } else if (Array.isArray(parsed)) {
          subtasks = parsed;
        } else {
          // Try to extract JSON array from markdown code blocks if present
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          const jsonString = jsonMatch ? jsonMatch[0] : content;
          subtasks = JSON.parse(jsonString);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        console.error('Parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      if (!Array.isArray(subtasks) || subtasks.length === 0) {
        return res.status(500).json({ error: 'Invalid subtasks format' });
      }

      // Create subtasks in database
      const createdSubtasks = await Promise.all(
        subtasks.map((subtask: any, index: number) =>
          prisma.subtask.create({
            data: {
              taskId,
              title: subtask.title,
              description: subtask.description || null,
              order: index,
              isAIGenerated: true,
            },
          })
        )
      );

      res.json({ subtasks: createdSubtasks });
    } catch (error) {
      console.error('Generate subtasks error:', error);
      res.status(500).json({ error: 'Failed to generate subtasks' });
    }
  }
);

export default router;

