import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CollaboratorsController } from './collaborators.controller';
import { CollaboratorsService } from './collaborators.service';
import { ContentWorkspacesController } from './content-workspaces.controller';

/** Per-project collaborators (Creator-CC / CC-24). */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CollaboratorsController, ContentWorkspacesController],
  providers: [CollaboratorsService],
})
export class CollaboratorsModule {}
