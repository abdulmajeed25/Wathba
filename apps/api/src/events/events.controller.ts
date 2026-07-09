import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { EventsService } from './events.service';
import { TrackEventDto } from './dto/track-event.dto';

/**
 * STAKES/O1 O3 — the product-event ingest. Anonymous allowed (page views);
 * authenticated calls attach the userId from the JWT (never from the body).
 * NO IP / NO user-agent is read or stored — privacy by construction.
 */
@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Track a whitelisted product event (privacy-respecting)' })
  async track(
    @CurrentUser() jwt: JwtPayload | null,
    @Body() dto: TrackEventDto,
  ): Promise<{ ok: true }> {
    return this.events.track({ ...dto, userId: jwt?.sub ?? null });
  }
}
