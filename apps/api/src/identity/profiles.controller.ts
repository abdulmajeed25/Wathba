import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';

/**
 * STAKES/C1 — the PUBLIC profile surface behind the web's /u/[handle] page.
 * Deliberately a separate controller: UsersController is class-guarded with
 * JwtAuthGuard, and this endpoint must be anonymous (profiles are public).
 *
 * The service resolves handle OR UUID and returns a narrow projection —
 * never email / phone / consent / password fields.
 */
@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly users: UsersService) {}

  @Get(':handle')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public user profile by handle (or UUID fallback)' })
  async byHandle(@Param('handle') handle: string): Promise<Record<string, unknown>> {
    return this.users.publicProfile(handle);
  }
}
