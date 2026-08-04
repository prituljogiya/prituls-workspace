# Troubleshooting Guide

## 500 Internal Server Error

If you're getting a 500 error, check the following:

### 1. Check Backend Server Logs

Look at your backend terminal for error messages. Common issues:

- **Database connection errors**: Check your `.env` file has correct `DATABASE_URL`
- **Missing environment variables**: Ensure all required env vars are set
- **Prisma client not generated**: Run `npm run prisma:generate` in backend folder

### 2. Common Fixes

#### Database Connection
```bash
cd backend
# Verify .env file exists and has DATABASE_URL
cat .env | grep DATABASE_URL

# Test database connection
npm run prisma:studio
```

#### Missing Dependencies
```bash
cd backend
npm install
npm run prisma:generate
```

#### Port Conflicts
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9
```

### 3. Frontend Issues

#### CORS Errors
- Ensure backend is running on port 5001
- Check `frontend/.env.local` has correct API URL
- Restart frontend dev server after changing .env

#### API Connection
- Check browser console for network errors
- Verify backend is running: `curl http://localhost:5001/api/health`

### 4. Debug Steps

1. **Check Backend Logs**: Look at terminal where `npm run dev` is running
2. **Check Browser Console**: Open DevTools → Console tab
3. **Check Network Tab**: Open DevTools → Network tab, see failed requests
4. **Test API Directly**: Use curl or Postman to test endpoints

### 5. Quick Health Check

```bash
# Backend health
curl http://localhost:5001/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 6. Reset Everything

If nothing works:

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install
npm run prisma:generate
npm run prisma:db:push

# Frontend  
cd ../frontend
rm -rf node_modules package-lock.json .next
npm install

# Restart both servers
```

