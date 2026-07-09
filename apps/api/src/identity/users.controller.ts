import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
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
    summary:
      'STAKES/E1 + S-12 F-06 — request an email change: verify-first (link to the NEW address), 2xx-uniform',
  })
  async changeEmail(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<{ ok: true }> {
    return this.auth.changeEmail(jwt.sub, dto.currentPassword, dto.newEmail);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'STAKES/S-15 E5 — list active sessions (no UA/IP stored by design)' })
  async listSessions(@CurrentUser() jwt: JwtPayload) {
    return { items: await this.auth.listSessions(jwt.sub) };
  }

  @Delete('me/sessions/:id')
  @ApiOperation({ summary: 'STAKES/S-15 E5 — revoke one session' })
  async revokeSession(@CurrentUser() jwt: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.revokeSession(jwt.sub, id);
  }

  @Post('me/signout-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'STAKES/E5 — revoke every refresh token (sign out all devices)' })
  async signOutAll(@CurrentUser() jwt: JwtPayload): Promise<{ revoked: number }> {
    return this.auth.signOutAll(jwt.sub);
  }
}
