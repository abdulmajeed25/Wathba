import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { HeartbeatService } from '../common/heartbeat.service';

/** STAKES/Q5 — version/build stamp: package version + optional git sha env. */
const VERSION = {
  version: process.env.npm_package_version ?? '0.1.0',
  sha: process.env.GIT_SHA ?? null,
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  /** Back-compat summary (used by existing probes/dashboards). */
  @Get()
  async check(): Promise<{
    status: string;
    db: 'up' | 'down';
    uptime: number;
    ts: string;
    version: string;
    sha: string | null;
  }> {
    let db: 'up' | 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    // STAKES/Q5 — version/build stamp for ops ("which build is live?").
    return {
      status: 'ok', db, uptime: process.uptime(), ts: new Date().toISOString(),
      version: VERSION.version, sha: VERSION.sha,
    };
  }

  /** Liveness — process is up; never touches dependencies. */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (no dependency checks)' })
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  /**
   * Readiness — DB reachable, money workers ticking, kill-flags visible.
   * 503 when the DB is down; degraded-but-200 when a worker beat is stale
   * (the LB keeps routing, the ops alert fires on `workers.*`).
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — DB + money-worker heartbeats + kill-flags' })
  async ready(): Promise<{
    status: 'ok' | 'degraded';
    db: 'up';
    workers: Record<string, number | null>;
    flags: Record<string, boolean>;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('database unreachable');
    }
    const workers = this.heartbeat.ages();
    const deadlineAge = this.heartbeat.age('deadline-tick');
    const payoutAge = this.heartbeat.age('payout-tick');
    const flags = {
      deadlineTickDisabled: process.env.DEADLINE_TICK_DISABLED === 'true',
      payoutTickDisabled: process.env.PAYOUT_TICK_DISABLED === 'true',
    };
    // deadline cron = 1/min → stale after 3 min; payout cron = 1/5min → 15 min.
    const degraded =
      flags.deadlineTickDisabled ||
      flags.payoutTickDisabled ||
      (deadlineAge !== null && deadlineAge > 180) ||
      (payoutAge !== null && payoutAge > 900);
    return { status: degraded ? 'degraded' : 'ok', db: 'up', workers, flags };
  }
}
