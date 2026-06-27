import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FundingService } from './funding.service';

/**
 * Deadline tick — every minute (cheap), settles any LIVE projects whose
 * deadlines have passed. Idempotent; if a settlement is in-flight, the
 * next tick will be a no-op for it.
 *
 * For real production traffic this should be replaced with a BullMQ job
 * scheduled per-project at the deadline (more efficient at scale, see
 * Phase 2). The cron is a safety net.
 */
@Injectable()
export class DeadlineScheduler {
  private readonly logger = new Logger(DeadlineScheduler.name);

  constructor(private readonly funding: FundingService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'funding-deadline-tick' })
  async tick(): Promise<void> {
    if (process.env.DEADLINE_TICK_DISABLED === 'true') return;
    try {
      const { scanned, settled } = await this.funding.settleDueProjects();
      if (settled > 0) this.logger.log(`Deadline tick: scanned=${scanned} settled=${settled}`);
    } catch (err) {
      this.logger.error('deadline tick failed', err as Error);
    }
  }
}
