import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UpdatesService } from './updates.service';

/**
 * CC-12 — scheduled-update publisher. Every minute, fans out the notification
 * for any update whose publishAt has arrived but hasn't been notified yet.
 * Idempotent (notifiedAt guard + dedupKey).
 */
@Injectable()
export class UpdatesScheduler {
  private readonly logger = new Logger(UpdatesScheduler.name);

  constructor(private readonly updates: UpdatesService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'update-publish-tick' })
  async tick(): Promise<void> {
    try {
      const { published } = await this.updates.publishDueUpdates();
      if (published > 0) this.logger.log(`Update publish tick: published=${published}`);
    } catch (err) {
      this.logger.error('update publish tick failed', err as Error);
    }
  }
}
