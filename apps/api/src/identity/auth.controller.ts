import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, type AuthResponse } from './auth.service';
import { SignInDto, SignUpDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create account (email + password)' })
  async signUp(@Body() dto: SignUpDto): Promise<AuthResponse> {
    return this.auth.signUp(dto);
  }

  @Post('signin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in (email + password)' })
  async signIn(@Body() dto: SignInDto): Promise<AuthResponse> {
    return this.auth.signIn(dto.email, dto.password);
  }
}
