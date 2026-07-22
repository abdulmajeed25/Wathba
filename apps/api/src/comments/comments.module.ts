import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { SettingsModule } from '../settings/settings.module';

/**
 * Comments — story-tab discussion + creator-side moderation. Depends on the
 * global NotificationsModule (provides reply notifications) and the global
 * PrismaModule.
 */
@Module({
  imports: [SettingsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
