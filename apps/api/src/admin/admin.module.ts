import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProjectsModule } from '../projects/projects.module';
import { IdentityModule } from '../identity/identity.module';
import { OpsModule } from '../ops/ops.module';

/** OPS Part 0 — mutations flow through OpsModule's registry; this module
 *  keeps only the read queues + response projections. */
@Module({
  imports: [ProjectsModule, IdentityModule, OpsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
