import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NafathController } from './nafath.controller';
import { NafathService } from './nafath.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const secret = cfg.get<string>('JWT_SECRET');
        // Tier 1 hardening: JWT secret must be set and not a placeholder.
        // Silent fallback to `'change-me'` in prod is a security blocker —
        // throw at boot rather than ship a forgeable-token app.
        if (!secret || secret.trim().length < 16) {
          throw new Error(
            'JWT_SECRET is missing or too short (<16 chars). Set a strong random value in the API environment before booting.',
          );
        }
        if (/^(change-?me|secret|dev|test|placeholder)$/i.test(secret)) {
          throw new Error(
            `JWT_SECRET looks like a placeholder ("${secret}"). Set a real random value.`,
          );
        }
        return {
          secret,
          signOptions: {
            // JwtModule v11 types expiresIn as `ms.StringValue | number`; the
            // env value is a runtime string so cast at the boundary.
            expiresIn: (cfg.get<string>('JWT_EXPIRES_IN') ?? '14d') as `${number}d`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, UsersController, NafathController],
  providers: [AuthService, UsersService, NafathService, JwtStrategy],
  exports: [AuthService, UsersService, JwtStrategy, PassportModule, JwtModule],
})
export class IdentityModule {}
