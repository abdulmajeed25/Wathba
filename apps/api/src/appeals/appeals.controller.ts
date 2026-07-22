import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AppealAccessGuard } from '../identity/appeal-access.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { AppealsService, type MyAppealView } from './appeals.service';
import { CreateAppealDto } from './dto/create-appeal.dto';

/**
 * Batch OPS-GAPS R1 — the appeal endpoints. Guarded by AppealAccessGuard, the
 * one guard that accepts a suspended-flagged token: a banned user (whose token
 * grants NO product access) can still plead their case, and a rejected-project
 * creator (a normal, non-suspended token) uses the same routes seamlessly.
 */
@ApiTags('appeals')
@Controller('appeals')
@UseGuards(AppealAccessGuard)
export class AppealsController {
  constructor(private readonly appeals: AppealsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'OPS-GAPS R1 — submit an appeal against a ban or a project rejection' })
  async submit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAppealDto,
  ): Promise<{ ok: true; appealId: string; status: string }> {
    const appeal = await this.appeals.submit(user.sub, dto);
    return { ok: true, appealId: appeal.id, status: appeal.status };
  }

  @Get('mine')
  @ApiOperation({ summary: 'OPS-GAPS R1 — the appellant’s own appeals + their statuses' })
  async mine(@CurrentUser() user: JwtPayload): Promise<{ appeals: MyAppealView[] }> {
    return { appeals: await this.appeals.mine(user.sub) };
  }
}
