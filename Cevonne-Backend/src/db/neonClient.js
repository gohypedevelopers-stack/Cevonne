const { Pool } = require('@neondatabase/serverless');

const globalForDB = globalThis;
let pool;

const createPool = () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error(
            'DATABASE_URL is not set. Configure it in Vercel or your .env file.'
        );
    }

    return new Pool({ connectionString });
};

const getPool = () => {
    if (globalForDB.__marvellaPool) {
        return globalForDB.__marvellaPool;
    }

    if (!pool) {
        pool = createPool();
    }

    if (process.env.NODE_ENV !== 'production') {
        globalForDB.__marvellaPool = pool;
    }

    return pool;
};

module.exports = {
    getPool,
    get pool() {
        return getPool();
    },
};
