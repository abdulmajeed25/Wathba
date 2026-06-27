import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { RewardsService } from './rewards.service';
import { CreateRewardTierDto, UpdateRewardTierDto } from './dto/reward.dto';

@ApiTags('rewards')
@Controller('projects/:projectId/reward-tiers')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  @ApiOperation({ summary: 'List tiers for a project' })
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const items = await this.rewards.listForProject(projectId);
    return { items: items.map((t) => this.rewards.toPublic(t)) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a reward tier (owner only, DRAFT/UNDER_REVIEW)' })
  async create(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateRewardTierDto,
  ) {
    const t = await this.rewards.create(jwt.sub, projectId, dto);
    return this.rewards.toPublic(t);
  }

  @Patch(':tierId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a tier (owner only)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Body() dto: UpdateRewardTierDto,
  ) {
    const t = await this.rewards.update(jwt.sub, projectId, tierId, dto);
    return this.rewards.toPublic(t);
  }

  @Delete(':tierId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unclaimed tier from a DRAFT project' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
  ) {
    return this.rewards.remove(jwt.sub, projectId, tierId);
  }
}
