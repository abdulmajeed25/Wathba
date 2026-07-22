import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';

/**
 * Batch OPS-GAPS R1 — the public appeal submission surface. Depends on
 * IdentityModule for AppealAccessGuard (the suspended-token carve-out);
 * Prisma/Notifications/Email are global.
 */
@Module({
  imports: [IdentityModule],
  controllers: [AppealsController],
  providers: [AppealsService],
})
export class AppealsModule {}
