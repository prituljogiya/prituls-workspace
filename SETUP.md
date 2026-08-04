# Quick Setup Guide

## 1. Install Dependencies

```bash
# Root
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

## 2. Database Setup (PostgreSQL)

1. Ensure PostgreSQL is running locally
2. Create the database: `createdb pms`
3. Create `backend/.env` (or run `npm run setup:env` in backend)
4. Set `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/pms?schema=public"
```

5. Generate Prisma client and push schema:

```bash
cd backend
npm run prisma:generate
npm run prisma:db:push
```

## 3. Configure Environment

### Backend (.env)
```env
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/pms?schema=public"
JWT_SECRET="change-this-to-a-random-string"
JWT_EXPIRES_IN="7d"
PORT=5001
FRONTEND_URL="http://localhost:3000"
```

> Note: macOS often uses port 5000 (AirPlay). Prefer `5001` for the API.

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

## 4. Create Admin User

```bash
cd backend
npm run create:admin
```

Default: `admin@example.com` / `admin123`

## 5. Run Development Servers

### Option 1: Both together (from root)
```bash
npm run dev
```

### Option 2: Separately

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

## 6. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- Health Check: http://localhost:5001/api/health
- Admin login: http://localhost:3000/admin/login

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `pg_isready`
- Create DB if missing: `createdb pms`
- Check `DATABASE_URL` format
- Test: `psql -d pms -c 'SELECT 1'`

### Port Already in Use
- Change `PORT` in backend/.env
- Update `NEXT_PUBLIC_API_URL` in frontend/.env.local

### Prisma Errors
- Run `npm run prisma:generate` in backend
- Run `npm run prisma:db:push` to sync schema
- Verify `schema.prisma` provider is `postgresql`
