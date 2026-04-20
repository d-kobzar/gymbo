import { SequelizeModuleOptions } from '@nestjs/sequelize';

const dbUrl = new URL(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gymbo');

export const databaseConfig: SequelizeModuleOptions = {
  dialect: 'postgres',
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 5432,
  username: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  autoLoadModels: true,
  synchronize: false,
  logging: false,
};
