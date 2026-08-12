import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { FundingService } from './funding.service';
import { CreatePledgeDto, RetryCaptureDto } from './dto/pledge.dto';
import { BnplService } from '../escrow-payments/bnpl.service';

@ApiTags('funding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pledges')
export class FundingController {
  constructor(
    private readonly funding: FundingService,
    private readonly bnpl: BnplService,
  ) {}

  @Post()
  // Money-write: much tighter than the 120/min global default (P1-404).
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Pledge to a LIVE project (hold-only authorize)' })
  async pledge(@CurrentUser() jwt: JwtPayload, @Body() dto: CreatePledgeDto) {
    const p = await this.funding.pledge(jwt.sub, dto);
    return this.funding.toPublic(p);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Batch PAY (Part 1) — cancel my pledge (free until 48h before the deadline; 403 inside the lock window)',
  })
  async cancel(@CurrentUser() jwt: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.funding.cancelPledge(jwt.sub, id);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Batch PAY (Part 2) — fix a CAPTURE_GRACE card pledge with a new source' })
  async retry(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetryCaptureDto,
  ) {
    return this.funding.retryCapture(jwt.sub, id, dto.source);
  }

  @Post(':id/bnpl/checkout')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Batch PAY (Part 4) — hosted BNPL checkout for a due intent (sandbox)' })
  async bnplCheckout(@CurrentUser() jwt: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bnpl.createCheckout(jwt.sub, id);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my pledges (cursor-paginated); phase=active|past splits «تعهداتي»' })
  async mine(
    @CurrentUser() jwt: JwtPayload,
    @Query() q: CursorQueryDto,
    @Query('phase') phase?: 'active' | 'past',
  ) {
    // Anything other than the two known values is ignored rather than
    // rejected: an unknown phase should show the reader everything, not a 400.
    const p = phase === 'active' || phase === 'past' ? phase : undefined;
    const { items, nextCursor } = await this.funding.listMine(jwt.sub, { ...q, phase: p });
    return { items: items.map((i) => this.funding.toPublic(i)), nextCursor };
  }
}
