import { Body, Controller, Get, Headers, HttpCode, NotFoundException, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type AuthResponse } from './auth.service';
import { EmailService } from '../email/email.service';
import {
  ForgotPasswordDto,
  RefreshDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly email: EmailService,
  ) {}

  /**
   * Sign-up — per-IP 5/min. Tighter than the global 120/min so a credential
   * stuffing tool can't create 120 fake accounts a minute on a single IP.
   * Env-tunable so e2e suites (many signups from one IP) don't trip it —
   * production leaves AUTH_SIGNUP_THROTTLE_LIMIT unset and keeps 5.
   */
  @Post('signup')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.AUTH_SIGNUP_THROTTLE_LIMIT ?? 5) } })
  @ApiOperation({
    summary:
      'Create account — ALWAYS 200 {ok:true} (STAKES/S-12 F-11 2xx-uniform, no enumeration); the session is minted by verify-email',
  })
  async signUp(@Body() dto: SignUpDto): Promise<{ ok: true }> {
    return this.auth.signUp(dto);
  }

  /** STAKES/S-12 F-11 — the emailed link lands here; success = signed in. */
  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.AUTH_SIGNUP_THROTTLE_LIMIT ?? 10) } })
  @ApiOperation({ summary: 'Consume a one-time email-verification token → session tokens' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthResponse> {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Re-send the verification link — always 200 (no enumeration), 60s cooldown' })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ ok: true }> {
    return this.auth.resendVerification(dto.email);
  }

  /**
   * Test seam — the stubbed outbox for a recipient. ONLY exists when the
   * mailer is stubbed (EMAIL_ENABLED unset) and never in production; e2e
   * suites read the verification link out of it. 404s otherwise.
   */
  @Get('dev-mailbox')
  @ApiOperation({ summary: 'DEV ONLY — last stubbed emails for a recipient (404 in production/real-mailer mode)' })
  devMailbox(@Query('to') to: string): Array<{ to: string; subject: string; html: string }> {
    if (process.env.NODE_ENV === 'production' || process.env.EMAIL_ENABLED === 'true') {
      throw new NotFoundException();
    }
    return this.email.sent.filter((m) => m.to === to).slice(-5);
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
  // Env-tunable for e2e (many signins from one IP); prod default stays 10.
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.AUTH_SIGNIN_THROTTLE_LIMIT ?? 10) } })
  @ApiOperation({ summary: 'Sign in (email + password)' })
  async signIn(
    @Body() dto: SignInDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponse> {
    return this.auth.signIn(dto.email, dto.password, userAgent);
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
