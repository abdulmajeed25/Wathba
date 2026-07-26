import { Body, Controller, Delete, Get, HttpCode, Ip, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { HomeService } from './home.service';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { OperationsRegistry } from '../ops/operations.registry';
import { OpsRbacService } from '../ops/ops-rbac.service';
import type { OperationContext } from '../ops/operation.types';

const KINDS = ['HERO_BANNER', 'ANNOUNCEMENT', 'SUCCESS_STORY', 'CREATOR_INTERVIEW', 'RESOURCE', 'TIP', 'TRUST_GUIDE'];

class UpsertCardDto {
  @ApiProperty({ enum: KINDS }) @IsIn(KINDS) kind!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) titleAr!: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(600) bodyAr!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20000) bodyLongAr?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(600) imageUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(400) linkUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) linkLabelAr?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class PatchSectionDto {
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

/** Batch HOME — the public composed payload + article pages. */
@ApiTags('home')
@Controller()
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  @ApiOperation({ summary: 'Batch HOME — the composed magazine-homepage payload (public, cacheable)' })
  compose() {
    return this.home.compose();
  }

  @Get('spotlight')
  @ApiOperation({ summary: 'Batch POLISH — «تحت الأضواء» curated payload (public, cacheable)' })
  spotlight() {
    return this.home.spotlight();
  }

  @Get('stories/:slug')
  @ApiOperation({ summary: 'Batch HOME — editorial article (bodyLongAr) by slug' })
  async article(@Param('slug') slug: string) {
    const card = await this.home.article(slug);
    if (!card) throw new NotFoundException('story not found');
    return card;
  }
}

/** Batch HOME — ADMIN surface. OPS Part 0: every mutation is a registry
 *  operation (CONTENT tier, audited in-transaction); reads live on
 *  HomeService so this controller never touches Prisma. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class HomeAdminController {
  constructor(
    private readonly home: HomeService,
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

  @Get('editorial-cards')
  @ApiOperation({ summary: 'All editorial cards (incl. inactive)' })
  async list() {
    return { items: await this.home.listCardsAdmin() };
  }

  @Post('editorial-cards')
  @ApiOperation({ summary: 'Create an editorial card (registry-governed)' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: UpsertCardDto, @Ip() ip: string) {
    const out = await this.registry.execute('content.editorial.card.create', dto, await this.ctx(jwt, ip));
    return out.result;
  }

  @Patch('editorial-cards/:id')
  @ApiOperation({ summary: 'Update an editorial card' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<UpsertCardDto>,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'content.editorial.card.update',
      { id, ...dto },
      await this.ctx(jwt, ip),
    );
    return out.result;
  }

  @Delete('editorial-cards/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an editorial card' })
  async remove(@CurrentUser() jwt: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    const out = await this.registry.execute('content.editorial.card.delete', { id }, await this.ctx(jwt, ip));
    return out.result;
  }

  @Get('homepage-sections')
  @ApiOperation({ summary: 'All homepage sections (toggle/reorder state)' })
  async sections() {
    return { items: await this.home.listSectionsAdmin() };
  }

  @Patch('homepage-sections/:key')
  @ApiOperation({ summary: 'Toggle/reorder a homepage section' })
  async patchSection(
    @CurrentUser() jwt: JwtPayload,
    @Param('key') key: string,
    @Body() dto: PatchSectionDto,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'content.homepage-section.update',
      { key, ...dto },
      await this.ctx(jwt, ip),
    );
    return out.result;
  }
}
