const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const apiKey = process.env.OPENAI_API_KEY;

console.log('🔧 Adding OpenAI API key to .env file...\n');

if (!apiKey) {
  console.error('❌ Set OPENAI_API_KEY in your environment first.');
  console.error('   Example: OPENAI_API_KEY=sk-... node add-openai-key.js');
  process.exit(1);
}

let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8');
}

if (/^OPENAI_API_KEY=/m.test(content)) {
  content = content.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY=${apiKey}`);
} else {
  content = `${content.trim()}\nOPENAI_API_KEY=${apiKey}\n`;
}

fs.writeFileSync(envPath, content);
console.log('✅ OPENAI_API_KEY written to .env (do not commit .env)');
