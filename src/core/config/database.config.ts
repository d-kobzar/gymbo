import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is required');
  }
  const url = new URL(raw);
  return {
    url: raw,
    host: url.hostname,
    port: Number(url.port) || 5432,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: process.env.NODE_ENV === 'production',
  };
});
