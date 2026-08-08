import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging makes local feel slow (thousands of lines + sync I/O). Enable with PRISMA_LOG_QUERIES=1
    log:
      process.env.PRISMA_LOG_QUERIES === '1'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });

prisma.$connect().catch((error) => {
  console.error('❌ Failed to connect to Neon Postgres:', error.message);
  console.error('💡 Troubleshooting steps:');
  console.error('   1. Verify DATABASE_URL / DIRECT_URL in backend/.env');
  console.error('   2. Ensure the Neon project is active (not suspended)');
  console.error('   3. Confirm sslmode=require is present in the connection string');
  console.error('   4. Check network connectivity');
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
