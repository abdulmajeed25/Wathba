import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from './projects.service';

/**
 * CC-20 — scheduled-launch publisher. Every minute, flips SCHEDULED projects
 * whose scheduledLaunchAt has arrived to LIVE. Idempotent (atomic status claim).
 */
@Injectable()
export class LaunchScheduler {
  private readonly logger = new Logger(LaunchScheduler.name);

  constructor(
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'project-launch-tick' })
  async tick(): Promise<void> {
    try {
      const { launched, launchedIds } = await this.projects.launchDueScheduled();
      if (launched > 0) this.logger.log(`Launch tick: launched=${launched}`);
      // STAKES/S-11 F-05 — scheduled launches also pay off the follow loop.
      for (const id of launchedIds) {
        this.notifications
          .fanOutProjectPublished(id)
          .catch((err) => this.logger.warn(`publish fan-out failed project=${id}: ${String(err)}`));
      }
    } catch (err) {
      this.logger.error('launch tick failed', err as Error);
    }
  }
}
