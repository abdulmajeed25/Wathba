import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProjectsModule } from '../projects/projects.module';
import { FundingModule } from '../funding/funding.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [ProjectsModule, FundingModule, IdentityModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
