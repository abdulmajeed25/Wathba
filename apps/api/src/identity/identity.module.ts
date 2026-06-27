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
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: {
          // JwtModule v11 types expiresIn as `ms.StringValue | number`; the env
          // value is a runtime string so cast at the boundary.
          expiresIn: (cfg.get<string>('JWT_EXPIRES_IN') ?? '14d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController, NafathController],
  providers: [AuthService, UsersService, NafathService, JwtStrategy],
  exports: [AuthService, UsersService, JwtStrategy, PassportModule, JwtModule],
})
export class IdentityModule {}
