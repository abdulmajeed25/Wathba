import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  UpdateProjectDto,
} from './dto/project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List discoverable projects (filters + sort + pagination)' })
  async list(@Query() q: ListProjectsQueryDto) {
    const { items, nextCursor } = await this.projects.list(q);
    return { items: items.map((i) => this.projects.toPublic(i)), nextCursor };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project detail (includes reward tiers)' })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.projects.findById(id);
    return this.projects.toPublic(p);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a project (status=DRAFT)' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: CreateProjectDto) {
    const p = await this.projects.create(jwt.sub, dto);
    return this.projects.toPublic(p);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update DRAFT/UNDER_REVIEW project (owner only)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const p = await this.projects.update(jwt.sub, id, dto);
    return this.projects.toPublic(p);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a DRAFT project for admin review' })
  async submit(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.projects.submitForReview(jwt.sub, id);
    return this.projects.toPublic(p);
  }
}
