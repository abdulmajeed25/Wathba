import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { OpsAuthService, type OpsPrincipal } from './ops-auth.service';

/**
 * OPS Part 1 — the ops-session guard. Replaces the public-JWT gate on the
 * /v1/ops surface: a request must carry a LIVE ops session token in
 * `x-ops-token` (the web BFF forwards the httpOnly cookie's value here).
 * The public bearer JWT is deliberately NOT accepted — the ops surface has
 * its own session with its own idle/absolute lifetime and step-up state.
 */
@Injectable()
export class OpsSessionGuard implements CanActivate {
  constructor(private readonly opsAuth: OpsAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { opsPrincipal?: OpsPrincipal }>();
    const raw = req.header('x-ops-token');
    if (!raw) throw new UnauthorizedException('مطلوب دخول صريح إلى مركز العمليات');
    req.opsPrincipal = await this.opsAuth.resolve(raw);
    return true;
  }
}

/**
 * OPS Part 1 — optional IP allowlist for the ops surface, env-gated:
 *   OPS_IP_ALLOWLIST="203.0.113.7, 198.51.100.0/24"
 * Unset (dev default) = allow all. IPv4 exact + CIDR; IPv6 exact match.
 * Production guidance lives in the session notes / owner checklist.
 */
@Injectable()
export class OpsIpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(OpsIpAllowlistGuard.name);

  constructor(private readonly cfg: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const raw = this.cfg.get<string>('OPS_IP_ALLOWLIST')?.trim();
    if (!raw) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = normalizeIp(req.ip ?? req.socket?.remoteAddress ?? '');
    if (ipAllowed(ip, raw)) return true;
    this.logger.warn(`OPS IP REFUSED ip=${ip} path=${req.path}`);
    throw new ForbiddenException('عنوان الشبكة غير مسموح به لمركز العمليات');
  }
}

export function normalizeIp(ip: string): string {
  // Express reports IPv4-mapped addresses as ::ffff:a.b.c.d.
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function ipAllowed(ip: string, allowlist: string): boolean {
  const entries = allowlist.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    if (entry.includes('/')) {
      if (cidrMatch(ip, entry)) return true;
    } else if (entry === ip) {
      return true;
    }
  }
  return false;
}

function cidrMatch(ip: string, cidr: string): boolean {
  const [net, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipN = v4ToInt(ip);
  const netN = v4ToInt(net!);
  if (ipN === null || netN === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return ((ipN & mask) >>> 0) === ((netN & mask) >>> 0);
}

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = (n << 8) | b;
  }
  return n >>> 0;
}
