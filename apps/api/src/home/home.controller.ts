import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { HomeService } from './home.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import { AuditService } from '../identity/audit.service';
import type { JwtPayload } from '../identity/auth.service';

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

  @Get('stories/:slug')
  @ApiOperation({ summary: 'Batch HOME — editorial article (bodyLongAr) by slug' })
  async article(@Param('slug') slug: string) {
    const card = await this.home.article(slug);
    if (!card) throw new NotFoundException('story not found');
    return card;
  }
}

/** Batch HOME — ADMIN surface (CREATOR-NO-MONEY untouched; all AuditLogged). */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class HomeAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('editorial-cards')
  @ApiOperation({ summary: 'All editorial cards (incl. inactive)' })
  async list() {
    return {
      items: await this.prisma.editorialCard.findMany({
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
      }),
    };
  }

  @Post('editorial-cards')
  @ApiOperation({ summary: 'Create an editorial card' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: UpsertCardDto) {
    const row = await this.prisma.editorialCard.create({ data: dto });
    await this.audit.log({ actorId: jwt.sub, action: 'admin.editorial.create', entity: 'EditorialCard', entityId: row.id });
    return row;
  }

  @Patch('editorial-cards/:id')
  @ApiOperation({ summary: 'Update an editorial card' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<UpsertCardDto>,
  ) {
    const row = await this.prisma.editorialCard.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: jwt.sub, action: 'admin.editorial.update', entity: 'EditorialCard', entityId: id });
    return row;
  }

  @Delete('editorial-cards/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an editorial card' })
  async remove(@CurrentUser() jwt: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.editorialCard.delete({ where: { id } });
    await this.audit.log({ actorId: jwt.sub, action: 'admin.editorial.delete', entity: 'EditorialCard', entityId: id });
    return { ok: true };
  }

  @Get('homepage-sections')
  @ApiOperation({ summary: 'All homepage sections (toggle/reorder state)' })
  async sections() {
    return { items: await this.prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } }) };
  }

  @Patch('homepage-sections/:key')
  @ApiOperation({ summary: 'Toggle/reorder a homepage section' })
  async patchSection(
    @CurrentUser() jwt: JwtPayload,
    @Param('key') key: string,
    @Body() dto: PatchSectionDto,
  ) {
    const row = await this.prisma.homepageSection.update({ where: { key }, data: dto });
    await this.audit.log({
      actorId: jwt.sub,
      action: 'admin.homepage-section.update',
      entity: 'HomepageSection',
      entityId: key,
      detail: dto as Record<string, unknown>,
    });
    return row;
  }
}
