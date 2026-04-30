const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const globalForPrisma = globalThis;
let prisma;

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Configure it in Vercel or your .env file.'
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
};

const getPrisma = async () => {
  if (globalForPrisma.__marvellaPrisma) {
    return globalForPrisma.__marvellaPrisma;
  }

  if (!prisma) {
    prisma = createPrismaClient();

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.__marvellaPrisma = prisma;
    }
  }

  return prisma;
};

const disconnect = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

module.exports = {
  getPrisma,
  disconnect,
};
