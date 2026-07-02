import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProjectsModule } from '../projects/projects.module';
import { FundingModule } from '../funding/funding.module';

@Module({
  imports: [ProjectsModule, FundingModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
