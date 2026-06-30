import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CreatorsService } from './creators.service';
import {
  CreatorProfileResponseDto,
  FollowResponseDto,
  UpdateCreatorProfileDto,
} from './dto/creator-profile.dto';

/**
 * Public creator profile + follow / unfollow surface. Consumed by web
 * `WathbaCreatorTab` (proxies `/api/creators/:userId/...` → `/v1/...`).
 */
@ApiTags('creators')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @Get(':userId')
  // Public read endpoint — tighter limit than the 120/min global default
  // because creator profiles are an obvious scrape target.
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Public creator profile + past projects' })
  @ApiResponse({ status: 200, type: CreatorProfileResponseDto })
  async get(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<CreatorProfileResponseDto> {
    return this.creators.getProfile(userId);
  }

  @Patch(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner-only edit of own creator profile' })
  @ApiResponse({ status: 200, type: CreatorProfileResponseDto })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateCreatorProfileDto,
  ): Promise<CreatorProfileResponseDto> {
    if (jwt.sub !== userId) {
      throw new ForbiddenException('can only edit your own profile');
    }
    return this.creators.updateProfile(userId, dto);
  }

  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow this creator (idempotent)' })
  @ApiResponse({ status: 201, type: FollowResponseDto })
  async follow(
    @CurrentUser() jwt: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<FollowResponseDto> {
    return this.creators.follow(jwt.sub, userId);
  }

  @Delete(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow this creator (idempotent)' })
  @ApiResponse({ status: 200, type: FollowResponseDto })
  async unfollow(
    @CurrentUser() jwt: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<FollowResponseDto> {
    return this.creators.unfollow(jwt.sub, userId);
  }
}
