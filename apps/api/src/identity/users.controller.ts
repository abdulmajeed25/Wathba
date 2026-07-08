import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { UsersService } from './users.service';
import { PdplService } from './pdpl.service';
import { AuthService } from './auth.service';
import { ChangeEmailDto, ChangePasswordDto, UpdateProfileDto } from './dto/auth.dto';
import type { JwtPayload } from './auth.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly pdpl: PdplService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async me(@CurrentUser() jwt: JwtPayload): Promise<Record<string, unknown>> {
    return this.users.meView(jwt.sub);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'PDPL right of access — full JSON export of all stored personal data' })
  async exportMe(@CurrentUser() jwt: JwtPayload): Promise<Record<string, unknown>> {
    return this.pdpl.exportData(jwt.sub);
  }

  @Delete('me')
  @ApiOperation({
    summary:
      'PDPL right of erasure — anonymizes the account (login disabled, PII removed; ' +
      'financial records retained per AML). 409 while pledges are in escrow or campaigns active.',
  })
  async eraseMe(@CurrentUser() jwt: JwtPayload): Promise<{ erased: true }> {
    return this.pdpl.eraseAccount(jwt.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current profile (identity + prefs + privacy)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<Record<string, unknown>> {
    const u = await this.users.updateProfile(jwt.sub, dto);
    return this.users.toPublic(u);
  }

  @Post('me/password')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'STAKES/E1+A12 — change password (current-password check); revokes all other sessions',
  })
  async changePassword(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ ok: true; refreshToken: string }> {
    return this.auth.changePassword(jwt.sub, dto.currentPassword, dto.newPassword);
  }

  @Post('me/email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'STAKES/E1 — change email (current-password check, generic 409, old-address notice)',
  })
  async changeEmail(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<{ ok: true; accessToken: string }> {
    return this.auth.changeEmail(jwt.sub, dto.currentPassword, dto.newEmail);
  }

  @Post('me/signout-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'STAKES/E5 — revoke every refresh token (sign out all devices)' })
  async signOutAll(@CurrentUser() jwt: JwtPayload): Promise<{ revoked: number }> {
    return this.auth.signOutAll(jwt.sub);
  }
}
