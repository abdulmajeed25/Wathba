import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { AuditViewController } from './audit-view.controller';
import { AuditViewService } from './audit-view.service';

/** Creator self-audit view (Creator-CC / CC-18). */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AuditViewController],
  providers: [AuditViewService],
})
export class AuditViewModule {}
