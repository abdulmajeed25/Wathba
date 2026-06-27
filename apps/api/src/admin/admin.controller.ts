import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ProjectsService } from '../projects/projects.service';
import { AdminService } from './admin.service';
import { ReviewProjectDto, SetPlatformPartnerDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly projects: ProjectsService,
  ) {}

  // -- Project review ---------------------------------------------------------

  @Get('review-queue')
  @ApiOperation({ summary: 'Projects awaiting review (status=UNDER_REVIEW)' })
  async queue() {
    const items = await this.admin.reviewQueue();
    return { items: items.map((p) => this.projects.toPublic(p)) };
  }

  @Post('projects/:id/review')
  @ApiOperation({ summary: 'Approve or reject a project under review' })
  async review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewProjectDto,
  ) {
    const updated = dto.decision === 'approve'
      ? await this.admin.approve(id)
      : await this.admin.reject(id, dto.reason);
    return this.projects.toPublic(updated);
  }

  // -- §6 Platform-partner ----------------------------------------------------

  @Put('projects/:id/platform-partner')
  @ApiOperation({
    summary:
      'Set or clear the Wathba-venture marker on a project. Setting it makes the badge appear on cards + detail.',
  })
  async setPartner(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPlatformPartnerDto,
  ) {
    const updated = await this.admin.setPlatformPartner(id, dto.platformPartner);
    return this.projects.toPublic(updated);
  }

  // -- KYC --------------------------------------------------------------------

  @Get('kyc-queue')
  @ApiOperation({ summary: 'Users awaiting KYC verification' })
  async kyc() {
    const items = await this.admin.kycQueue();
    return { items };
  }

  @Post('users/:id/force-verify')
  @ApiOperation({ summary: 'Admin override — mark a user Nafath-verified' })
  async forceVerify(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.forceVerifyKyc(id);
  }
}
