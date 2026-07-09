import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { DiscoverService } from './discover.service';
import { DiscoverQueryDto } from './dto/discover-query.dto';

/** Batch DISC — the advanced discover page query + facets + bookmarks. */
@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Advanced discover query (composable filters + sort + paging)' })
  async list(@CurrentUser() jwt: JwtPayload | null, @Query() q: DiscoverQueryDto) {
    return this.discover.list(q, jwt?.sub);
  }

  @Get('facets')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Live facet counts respecting the other active filters' })
  async facets(@CurrentUser() jwt: JwtPayload | null, @Query() q: DiscoverQueryDto) {
    return this.discover.facets(q, jwt?.sub);
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'STAKES/J4 — "لأنك دعمت…": LIVE projects in the categories you backed' })
  async recommended(@CurrentUser() jwt: JwtPayload) {
    return this.discover.recommendedForUser(jwt.sub);
  }

  @Post('saved/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookmark a project (المشاريع المحفوظة)' })
  async save(@CurrentUser() jwt: JwtPayload, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.discover.bookmark(jwt.sub, projectId);
  }

  @Delete('saved/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a bookmark' })
  async unsave(@CurrentUser() jwt: JwtPayload, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.discover.unbookmark(jwt.sub, projectId);
  }
}
