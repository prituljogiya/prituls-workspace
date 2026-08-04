# Port 5000 Conflict Fix

## Issue
Port 5000 is commonly used by macOS AirPlay Receiver, which can cause conflicts when starting the backend server.

## Solution
The default port has been changed to **5001** to avoid conflicts.

## Update Your .env File

If you already have a `.env` file, update the PORT:

```bash
# In backend/.env, change:
PORT=5000

# To:
PORT=5001
```

Or regenerate the .env file:
```bash
cd backend
npm run setup:env
```

## Update Frontend Configuration

Update `frontend/.env.local` to point to the new port:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

## Alternative: Disable AirPlay Receiver (macOS)

If you prefer to use port 5000, you can disable AirPlay Receiver:

1. Open **System Settings** (or System Preferences)
2. Go to **General** → **AirDrop & Handoff**
3. Turn off **AirPlay Receiver**

Then update your `.env` back to `PORT=5000`.

## Start Server

After updating the port, start the server:

```bash
cd backend
npm run dev
```

The server will now run on `http://localhost:5001` ✅

