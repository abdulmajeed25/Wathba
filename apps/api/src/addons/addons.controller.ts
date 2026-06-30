import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { AddonsService } from './addons.service';
import { CreateAddOnDto, UpdateAddOnDto } from './dto/addon.dto';

@ApiTags('addons')
@Controller('projects/:projectId/addons')
export class AddonsController {
  constructor(private readonly addons: AddonsService) {}

  @Get()
  @ApiOperation({ summary: 'List add-ons for a project (public)' })
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const items = await this.addons.listForProject(projectId);
    return { items: items.map((a) => this.addons.toPublic(a)) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an add-on (owner only)' })
  async create(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateAddOnDto,
  ) {
    const a = await this.addons.create(jwt.sub, projectId, dto);
    return this.addons.toPublic(a);
  }

  @Patch(':addOnId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an add-on (owner only)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('addOnId', new ParseUUIDPipe()) addOnId: string,
    @Body() dto: UpdateAddOnDto,
  ) {
    const a = await this.addons.update(jwt.sub, projectId, addOnId, dto);
    return this.addons.toPublic(a);
  }

  @Delete(':addOnId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unclaimed add-on from a DRAFT project' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('addOnId', new ParseUUIDPipe()) addOnId: string,
  ) {
    return this.addons.remove(jwt.sub, projectId, addOnId);
  }
}
