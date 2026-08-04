# Create .env File

Your MongoDB connection string has been configured. To create the `.env` file, run:

```bash
npm run setup:env
```

Or manually create a `.env` file in the `backend` directory with the following content:

```env
# Database
DATABASE_URL="mongodb+srv://prituljogiya99_db_user:eCUYslKzmmbSQRbY@pms.3bpjipm.mongodb.net/pms?retryWrites=true&w=majority&appName=PMS"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-to-a-random-string"
JWT_EXPIRES_IN="7d"

# Server
PORT=5001
NODE_ENV=development

# Email (for forgot password - optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FRONTEND_URL="http://localhost:3000"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760

# AI Configuration (for subtask generation)
# Option 1: Use ChatGPT/OpenAI (recommended)
OPENAI_API_KEY="sk-your-openai-api-key-here"
# Optional: Specify model (default: gpt-3.5-turbo, can use gpt-4, gpt-4-turbo, etc.)
OPENAI_MODEL="gpt-3.5-turbo"

# Option 2: Use Groq (alternative, free tier available)
# GROQ_API_KEY="gsk-your-groq-api-key-here"
```

## Important Notes:

1. **JWT_SECRET**: Change this to a secure random string before production. You can generate one using:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Email Settings**: These are optional. Only needed if you want to use the "Forgot Password" feature.

3. **AI API Key**: 
   - **For ChatGPT**: Get your API key from https://platform.openai.com/api-keys
   - Add `OPENAI_API_KEY="sk-..."` to your `.env` file
   - The system will automatically use ChatGPT for AI subtask generation
   - Optional: Set `OPENAI_MODEL="gpt-4"` for better results (requires GPT-4 access)

4. **Database**: Your MongoDB Atlas connection is already configured and ready to use!

## Next Steps:

After creating the `.env` file:

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to MongoDB
npm run prisma:db:push

# Start the development server
npm run dev
```

