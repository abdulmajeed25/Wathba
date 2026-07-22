import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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
    // Batch OPS — suspension bites the LIVE token, not just the next login:
    // users.suspend revokes refresh tokens transactionally, and this check
    // kills the still-valid access token on its next request.
    const u = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { suspendedAt: true },
    });
    if (u?.suspendedAt) throw new UnauthorizedException('الحساب موقوف');
    return payload;
  }
}
