import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CollectionsService } from './collections.service';
import { OperationsRegistry } from '../ops/operations.registry';
import { OpsRbacService } from '../ops/ops-rbac.service';
import type { OperationContext } from '../ops/operation.types';
import { AssignProjectDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

/** Batch DISC admin CRUD — OPS Part 0: every mutation is a registry
 *  operation (CONTENT tier, audited in-transaction). Reads stay here. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/collections')
export class CollectionsAdminController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly registry: OperationsRegistry,
    private readonly rbac: OpsRbacService,
  ) {}

  private async ctx(jwt: JwtPayload, ip: string): Promise<OperationContext> {
    return {
      actor: {
        id: jwt.sub,
        type: 'HUMAN',
        roles: jwt.roles as unknown as string[],
        // Part 2 — RBAC applies on the legacy seams too.
        permissions: (await this.rbac.permissionsForUser(jwt.sub)).permissions,
      },
      ip,
    };
  }

  @Get()
  @ApiOperation({ summary: 'All collections (incl. inactive) with project counts' })
  async list() {
    return this.collections.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a collection (registry-governed)' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: CreateCollectionDto, @Ip() ip: string) {
    const out = await this.registry.execute('content.collections.create', dto, await this.ctx(jwt, ip));
    return out.result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a collection (activate, show-in-menu, copy)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCollectionDto,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'content.collections.update',
      { id, ...dto },
      await this.ctx(jwt, ip),
    );
    return out.result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a collection' })
  async remove(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string, @Ip() ip: string) {
    const out = await this.registry.execute('content.collections.delete', { id }, await this.ctx(jwt, ip));
    return out.result;
  }

  @Post(':id/projects')
  @ApiOperation({ summary: 'Assign a project to a collection' })
  async assign(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignProjectDto,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'content.collections.assign',
      { collectionId: id, projectId: dto.projectId },
      await this.ctx(jwt, ip),
    );
    return out.result;
  }

  @Delete(':id/projects/:projectId')
  @ApiOperation({ summary: 'Remove a project from a collection' })
  async unassign(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'content.collections.unassign',
      { collectionId: id, projectId },
      await this.ctx(jwt, ip),
    );
    return out.result;
  }
}
