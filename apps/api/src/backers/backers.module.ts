import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { BackersController } from './backers.controller';
import { BackersService } from './backers.service';

/**
 * Backer roster + CSV export (Creator-CC / CC-02 + CC-03). Depends on
 * IdentityModule for JWT auth + AuditService.
 */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [BackersController],
  providers: [BackersService],
})
export class BackersModule {}
