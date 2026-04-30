const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const adapter = new PrismaPg({ connectionString });
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__marvellaPrisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__marvellaPrisma = prisma;
}

const getPrisma = async () => prisma;

const disconnect = async () => {
  await prisma.$disconnect();
};

module.exports = {
  getPrisma,
  disconnect,
};
