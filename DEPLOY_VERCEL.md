# Production deploy notes for Vercel + Neon
# Do not put secrets in this file.

## What's configured
- Frontend: Next.js on Vercel
- Backend: Express as `/api` serverless function
- Database: Neon Postgres

## Required Vercel Environment Variables
DATABASE_URL=<neon pooled url with pgbouncer=true>
DIRECT_URL=<neon direct url>
JWT_SECRET=<long random string>
FRONTEND_URL=https://YOUR_APP.vercel.app
NEXT_PUBLIC_API_URL=/api
NODE_ENV=production

Optional:
OPENAI_API_KEY=
GROQ_API_KEY=

## Notes
- File uploads are ephemeral on serverless (won't persist)
- Socket.io realtime is local-only (not on Vercel)
- Team member / admin users must be created after first deploy
