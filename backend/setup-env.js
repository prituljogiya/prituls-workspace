const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Generate a secure JWT secret
const jwtSecret = crypto.randomBytes(32).toString('hex');
const dbUser = process.env.USER || os.userInfo().username || 'postgres';

const envContent = `# Database (PostgreSQL)
DATABASE_URL="postgresql://${dbUser}@localhost:5432/pms?schema=public"

# JWT
JWT_SECRET="${jwtSecret}"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
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
`;

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Backing up to .env.backup');
  fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
}

fs.writeFileSync(envPath, envContent);
console.log('✅ .env file created successfully!');
console.log('📝 Ensure PostgreSQL is running and DATABASE_URL points to your pms database.');
