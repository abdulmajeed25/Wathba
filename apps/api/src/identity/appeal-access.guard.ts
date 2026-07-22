import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { JwtPayload } from './auth.service';

/**
 * OPS-GAPS R1 — the appeal-only access guard.
 *
 * A banned/suspended account gets a SUSPENDED-flagged token at sign-in
 * (auth.service). The normal JwtAuthGuard (via jwt.strategy) rejects that
 * token on every product route — a suspended account has zero product access.
 * The ONLY routes that accept it are the appeal endpoints, guarded here: this
 * verifies the JWT signature/expiry and attaches `req.user`, but deliberately
 * does NOT re-check suspension, so a banned user can plead their case.
 *
 * It also accepts a normal (non-suspended) token, so a rejected-project
 * creator — who is not suspended — uses the same endpoints seamlessly.
 */
@Injectable()
export class AppealAccessGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('مطلوب تسجيل الدخول لتقديم التظلّم');
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('جلسة غير صالحة');
    }
  }
}
