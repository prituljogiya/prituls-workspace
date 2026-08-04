#!/bin/bash
echo "NEXT_PUBLIC_API_URL=http://localhost:5001/api" > .env.local
echo "NEXT_PUBLIC_SOCKET_URL=http://localhost:5001" >> .env.local
echo "✅ Frontend .env.local file created!"
echo "📝 Contents:"
cat .env.local
