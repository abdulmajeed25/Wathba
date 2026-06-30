import { Module } from '@nestjs/common';
import { UpdatesController } from './updates.controller';
import { UpdatesService } from './updates.service';

/**
 * Project Updates module — numbered creator broadcasts. Depends on the global
 * PrismaModule.
 */
@Module({
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
