import { Sequelize } from 'sequelize';

const globalForSequelize = globalThis as unknown as {
  sequelize: Sequelize | undefined;
};

function createSequelizeInstance(): Sequelize {
  const instance = new Sequelize(
    process.env.DB_NAME || 'freeluma_dev',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    }
  );
  return instance;
}

export const sequelize = globalForSequelize.sequelize ?? createSequelizeInstance();

if (process.env.NODE_ENV !== 'production') {
  globalForSequelize.sequelize = sequelize;
}

// Guard: Prevent sync() in production
const originalSync = sequelize.sync.bind(sequelize);
sequelize.sync = async (...args: Parameters<typeof originalSync>) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('sequelize.sync() is disabled in production. Use migrations.');
  }
  return originalSync(...args);
};
