# AI Subtask Generator Setup

This guide explains how to configure the AI subtask generation feature using ChatGPT (OpenAI) or Groq.

## 🚀 Quick Setup

### Option 1: ChatGPT/OpenAI (Recommended)

1. **Get your OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Sign in or create an account
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

2. **Add to your `.env` file**:
   ```env
   OPENAI_API_KEY="sk-your-api-key-here"
   ```

3. **Optional - Use GPT-4** (better quality, but costs more):
   ```env
   OPENAI_API_KEY="sk-your-api-key-here"
   OPENAI_MODEL="gpt-4"
   ```

4. **Restart your backend server**:
   ```bash
   cd backend
   npm run dev
   ```

### Option 2: Groq (Alternative - Free Tier Available)

1. **Get your Groq API Key**:
   - Go to https://console.groq.com/keys
   - Sign in or create an account
   - Create a new API key
   - Copy the key (starts with `gsk_`)

2. **Add to your `.env` file**:
   ```env
   GROQ_API_KEY="gsk-your-api-key-here"
   ```

3. **Restart your backend server**

## 📝 How It Works

1. **Priority**: The system prioritizes OpenAI (ChatGPT) if both keys are present
   - If `OPENAI_API_KEY` is set → Uses ChatGPT
   - If only `GROQ_API_KEY` is set → Uses Groq
   - If neither is set → AI feature is disabled

2. **Usage**:
   - Open any task detail page
   - Click the "✨ Generate Subtasks" button
   - AI will generate 5-8 actionable subtasks based on the task title and description

## 🔧 Configuration Details

### OpenAI Models Available:
- `gpt-3.5-turbo` (default, fast and cost-effective)
- `gpt-4` (better quality, slower, more expensive)
- `gpt-4-turbo` (best quality, latest model)

### Groq Models:
- `llama-3.1-8b-instant` (default, fast and free tier available)

## 💰 Pricing

### OpenAI:
- **GPT-3.5-turbo**: ~$0.0015 per 1K tokens (very affordable)
- **GPT-4**: ~$0.03 per 1K tokens (higher quality)
- Check current pricing: https://openai.com/pricing

### Groq:
- **Free tier**: 14,400 requests/day
- **Paid plans**: Available for higher usage
- Check current pricing: https://groq.com/pricing

## 🎯 Example

**Task**: "Build Login Screen"

**Generated Subtasks**:
1. Create UI mockup in Figma
2. Build Flutter login page component
3. Integrate authentication API
4. Add input validation
5. Implement error handling
6. Test login flows
7. Add password reset functionality

## ❓ Troubleshooting

### Error: "AI API key not configured"
- Make sure you've added the API key to your `.env` file
- Restart the backend server after adding the key
- Check that the key is correct (no extra spaces)

### Error: "Failed to generate subtasks"
- Check your API key is valid
- Verify you have credits/quota available
- Check backend console logs for detailed error messages

### Poor quality subtasks
- Try using `OPENAI_MODEL="gpt-4"` for better results
- Make sure your task title and description are clear
- The AI works better with detailed task descriptions

## 🔒 Security Note

**Never commit your `.env` file to version control!**

The `.env` file is already in `.gitignore`, but always double-check before committing.

