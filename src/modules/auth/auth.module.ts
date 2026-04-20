import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '@modules/users/users.module';
import type { JwtConfig } from '@core/config/jwt.config';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { TelegramInitDataService } from './services/telegram-init-data.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const jwt = config.getOrThrow<JwtConfig>('jwt');
        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` },
        };
      },
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramInitDataService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, TelegramInitDataService, JwtStrategy, JwtAuthGuard],
})
export class AuthModule {}
