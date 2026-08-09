import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

/** Batch DISCOVERY-ENGINE — curated project tags. */
@Module({
  imports: [PrismaModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
