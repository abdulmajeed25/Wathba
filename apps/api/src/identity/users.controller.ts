import { Body, Controller, Delete, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { UsersService } from './users.service';
import { PdplService } from './pdpl.service';
import { UpdateProfileDto } from './dto/auth.dto';
import type { JwtPayload } from './auth.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly pdpl: PdplService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async me(@CurrentUser() jwt: JwtPayload): Promise<Record<string, unknown>> {
    const u = await this.users.findById(jwt.sub);
    return this.users.toPublic(u);
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
  @ApiOperation({ summary: 'Update current profile (name/phone/locale)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<Record<string, unknown>> {
    const u = await this.users.updateProfile(jwt.sub, dto);
    return this.users.toPublic(u);
  }
}
