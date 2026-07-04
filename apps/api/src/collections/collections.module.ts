import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CollectionsController } from './collections.controller';
import { CollectionsAdminController } from './collections-admin.controller';
import { CollectionsService } from './collections.service';

/** Batch DISC — curated collections (حملات وثبة) + admin CRUD. */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CollectionsController, CollectionsAdminController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
