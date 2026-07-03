import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProjectsService } from './projects.service';

/**
 * CC-20 — scheduled-launch publisher. Every minute, flips SCHEDULED projects
 * whose scheduledLaunchAt has arrived to LIVE. Idempotent (atomic status claim).
 */
@Injectable()
export class LaunchScheduler {
  private readonly logger = new Logger(LaunchScheduler.name);

  constructor(private readonly projects: ProjectsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'project-launch-tick' })
  async tick(): Promise<void> {
    try {
      const { launched } = await this.projects.launchDueScheduled();
      if (launched > 0) this.logger.log(`Launch tick: launched=${launched}`);
    } catch (err) {
      this.logger.error('launch tick failed', err as Error);
    }
  }
}
