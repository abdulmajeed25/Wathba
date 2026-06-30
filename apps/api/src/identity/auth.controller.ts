import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type AuthResponse } from './auth.service';
import { SignInDto, SignUpDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Sign-up — per-IP 5/min. Tighter than the global 120/min so a credential
   * stuffing tool can't create 120 fake accounts a minute on a single IP.
   */
  @Post('signup')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
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
}
