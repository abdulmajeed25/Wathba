import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type AuthResponse } from './auth.service';
import { ForgotPasswordDto, RefreshDto, ResetPasswordDto, SignInDto, SignUpDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Sign-up — per-IP 5/min. Tighter than the global 120/min so a credential
   * stuffing tool can't create 120 fake accounts a minute on a single IP.
   * Env-tunable so e2e suites (many signups from one IP) don't trip it —
   * production leaves AUTH_SIGNUP_THROTTLE_LIMIT unset and keeps 5.
   */
  @Post('signup')
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.AUTH_SIGNUP_THROTTLE_LIMIT ?? 5) } })
  @ApiOperation({ summary: 'Create account (email + password)' })
  async signUp(@Body() dto: SignUpDto): Promise<AuthResponse> {
    return this.auth.signUp(dto);
  }

  /**
   * Sign-in — per-IP 10/min. Brute-force attempts get bounced before they
   * reach the bcrypt compare (which is ~100ms per attempt anyway). Per-email
   * lockout is enforced one layer deeper in AuthService.signIn() — 5 failed
   * attempts in 15 min on the same email account back off into 429 with a
   * dynamic Retry-After.
   */
  @Post('signin')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Sign in (email + password)' })
  async signIn(@Body() dto: SignInDto): Promise<AuthResponse> {
    return this.auth.signIn(dto.email, dto.password);
  }

  /**
   * Refresh rotation (Sprint 2 / P1-502) — one-time-use refresh token yields
   * a new access+refresh pair. Reusing a rotated token revokes every session
   * for that user (replay defense).
   */
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Rotate refresh token → new access + refresh pair' })
  async refresh(@Body() dto: RefreshDto): Promise<AuthResponse> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Request a password-reset link — always 200 (no user enumeration)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: true }> {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Consume a one-time reset token → set new password + revoke all sessions' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Post('signout')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Revoke a refresh token (idempotent)' })
  async signOut(@Body() dto: RefreshDto): Promise<{ revoked: boolean }> {
    return this.auth.signOut(dto.refreshToken);
  }
}
