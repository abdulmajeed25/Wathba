import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { AuditService } from '../identity/audit.service';
import { CollectionsService } from './collections.service';
import { AssignProjectDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

/** Batch DISC — ADMIN CRUD for حملات وثبة collections (all audited). */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/collections')
export class CollectionsAdminController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'All collections (incl. inactive) with project counts' })
  async list() {
    return this.collections.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a collection' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: CreateCollectionDto) {
    const c = await this.collections.create(dto);
    await this.audit.log({ actorId: jwt.sub, action: 'admin.collection.create', entity: 'Collection', entityId: c.id, detail: { slug: c.slug } });
    return c;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a collection (activate, show-in-menu, copy)' })
  async update(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCollectionDto) {
    const c = await this.collections.update(id, dto);
    await this.audit.log({ actorId: jwt.sub, action: 'admin.collection.update', entity: 'Collection', entityId: id, detail: dto as Record<string, unknown> });
    return c;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a collection' })
  async remove(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.collection.delete', entity: 'Collection', entityId: id });
    return this.collections.remove(id);
  }

  @Post(':id/projects')
  @ApiOperation({ summary: 'Assign a project to a collection' })
  async assign(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AssignProjectDto) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.collection.assign', entity: 'Collection', entityId: id, detail: { projectId: dto.projectId } });
    return this.collections.assign(id, dto.projectId);
  }

  @Delete(':id/projects/:projectId')
  @ApiOperation({ summary: 'Remove a project from a collection' })
  async unassign(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.collection.unassign', entity: 'Collection', entityId: id, detail: { projectId } });
    return this.collections.unassign(id, projectId);
  }
}
