import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FundingService } from './funding.service';

/**
 * Deadline tick — every minute, settles LIVE projects whose deadlines
 * have passed. Idempotent. A BullMQ per-project deadline job is a future
 * scale optimization; the cron is the always-on safety net.
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
