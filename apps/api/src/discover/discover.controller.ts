import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { DiscoverService } from './discover.service';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { PopularFacetsService } from './popular-facets.service';

/** Batch DISC — the advanced discover page query + facets + bookmarks. */
@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly discover: DiscoverService,
    private readonly popular: PopularFacetsService,
  ) {}

  /**
   * Batch DISCOVERY-ENGINE Unit 5 — the learned chip row.
   *
   * Public and unauthenticated: it is the same aggregate for everyone. There is
   * deliberately no per-viewer variant — a personalised filter row would need a
   * per-user filter profile, which this batch does not build (PDPL).
   */
  @Get('popular')
  @ApiOperation({ summary: 'Facets promoted by the nightly 30-day window (aggregate, not personal)' })
  async popularFacets() {
    return { items: await this.popular.promoted() };
  }

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

  /* ── Batch ACCOUNT — «متابعة المشروع», the subscribe half ─────────────────
   * Sits beside the bookmark routes on purpose: same guard, same shape, same
   * idempotency, so the only difference between the two acts is the WORD. A
   * save is silent; a follow is what puts project updates in your
   * notifications. Holding one never implies the other.
   */

  @Post('follows/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a project — subscribe to its updates (متابعة المشروع)' })
  async followProject(@CurrentUser() jwt: JwtPayload, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.discover.followProject(jwt.sub, projectId);
  }

  @Delete('follows/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a project' })
  async unfollowProject(@CurrentUser() jwt: JwtPayload, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.discover.unfollowProject(jwt.sub, projectId);
  }

  @Get('follows')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Projects I follow (مشاريع أتابعها)' })
  async myFollowedProjects(@CurrentUser() jwt: JwtPayload) {
    return this.discover.listFollowedProjects(jwt.sub);
  }

  @Get('relations/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Do I follow / have I saved this project? (initial button state)' })
  async projectRelations(@CurrentUser() jwt: JwtPayload, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.discover.projectRelations(jwt.sub, projectId);
  }
}
