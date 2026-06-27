import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/auth.dto';
import type { JwtPayload } from './auth.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async me(@CurrentUser() jwt: JwtPayload): Promise<Record<string, unknown>> {
    const u = await this.users.findById(jwt.sub);
    return this.users.toPublic(u);
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
