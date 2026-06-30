import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    const secret = cfg.get<string>('JWT_SECRET');
    // The same hard check IdentityModule already runs at boot — duplicated
    // here so a direct `new JwtStrategy()` in tests can't accidentally
    // smuggle a placeholder secret past validation.
    if (!secret || secret.trim().length < 16) {
      throw new Error('JWT_SECRET is missing or too short (<16 chars).');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
