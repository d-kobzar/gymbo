import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import type { DatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return {
          dialect: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          autoLoadModels: true,
          synchronize: false,
          logging: false,
          dialectOptions: db.ssl
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : undefined,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
