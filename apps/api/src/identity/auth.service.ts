import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
}

export interface AuthResponse {
  accessToken: string;
  user: Record<string, unknown>;
}

/**
 * Per-email login back-off. Hard-coded (no DB / no Redis) for v1: each API
 * process keeps its own in-memory map. That's intentional — at this scale a
 * single API instance handles all auth traffic; a distributed lockout would
 * be Tier 2/3 work. Resets the slot after `LOCKOUT_WINDOW_MS` so a typo'd
 * email isn't permanently locked.
 */
const LOGIN_FAIL_LIMIT = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly failedAttempts = new Map<string, { count: number; firstAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const exists = await this.users.findByEmail(email);
    if (exists) throw new ConflictException('email already registered');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        phone: input.phone,
        roles: ['BACKER'],
      },
    });
    return this.issue(user.id, email, user.roles);
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const key = email.toLowerCase();
    this.checkLockout(key);
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      this.recordFailure(key);
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.recordFailure(key);
      throw new UnauthorizedException('invalid credentials');
    }
    // Success — clear the per-email counter.
    this.failedAttempts.delete(key);
    return this.issue(user.id, user.email, user.roles);
  }

  /** Throws 429 with Retry-After if this email has hit LOGIN_FAIL_LIMIT. */
  private checkLockout(key: string): void {
    const slot = this.failedAttempts.get(key);
    if (!slot) return;
    const elapsed = Date.now() - slot.firstAt;
    if (elapsed >= LOCKOUT_WINDOW_MS) {
      this.failedAttempts.delete(key);
      return;
    }
    if (slot.count >= LOGIN_FAIL_LIMIT) {
      const retryAfterSec = Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many failed sign-in attempts. Try again in ${retryAfterSec}s.`,
          retryAfter: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string): void {
    const slot = this.failedAttempts.get(key);
    if (!slot || Date.now() - slot.firstAt >= LOCKOUT_WINDOW_MS) {
      this.failedAttempts.set(key, { count: 1, firstAt: Date.now() });
      return;
    }
    slot.count += 1;
  }

  private async issue(sub: string, email: string, roles: UserRole[]): Promise<AuthResponse> {
    const payload: JwtPayload = { sub, email, roles };
    const accessToken = await this.jwt.signAsync(payload);
    const user = await this.users.findById(sub);
    return { accessToken, user: this.users.toPublic(user) };
  }
}
