import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';

/** Public transparency change-log (Creator-CC / CC-11 + CC-13). */
@Module({
  imports: [PrismaModule],
  controllers: [ChangelogController],
  providers: [ChangelogService],
})
export class ChangelogModule {}
