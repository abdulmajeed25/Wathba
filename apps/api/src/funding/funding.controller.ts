import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { FundingService } from './funding.service';
import { CreatePledgeDto } from './dto/pledge.dto';

@ApiTags('funding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pledges')
export class FundingController {
  constructor(private readonly funding: FundingService) {}

  @Post()
  // Money-write: much tighter than the 120/min global default (P1-404).
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Pledge to a LIVE project (hold-only authorize)' })
  async pledge(@CurrentUser() jwt: JwtPayload, @Body() dto: CreatePledgeDto) {
    const p = await this.funding.pledge(jwt.sub, dto);
    return this.funding.toPublic(p);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my pledges (cursor-paginated)' })
  async mine(@CurrentUser() jwt: JwtPayload, @Query() q: CursorQueryDto) {
    const { items, nextCursor } = await this.funding.listMine(jwt.sub, q);
    return { items: items.map((i) => this.funding.toPublic(i)), nextCursor };
  }
}
