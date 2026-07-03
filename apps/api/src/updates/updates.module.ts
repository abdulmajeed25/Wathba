import { Module } from '@nestjs/common';
import { UpdatesController } from './updates.controller';
import { UpdatesService } from './updates.service';
import { UpdatesScheduler } from './updates.scheduler';

/**
 * Project Updates module — numbered creator broadcasts. Depends on the global
 * PrismaModule. UpdatesScheduler publishes scheduled updates (CC-12).
 */
@Module({
  controllers: [UpdatesController],
  providers: [UpdatesService, UpdatesScheduler],
  exports: [UpdatesService],
})
export class UpdatesModule {}
