import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Batch DISC — the advanced discover query. All facet state is URL-encoded so
 * pages are shareable/crawlable. Multi-select dimensions arrive as CSV
 * (`?status=live,funded&cat=technology,games`); the service parses + validates.
 */
export class DiscoverQueryDto {
  /** Batch SEARCH Part 3 — free-text query (the unified search page). */
  @ApiProperty({ required: false, example: 'درون' })
  @IsOptional() @IsString() q?: string;

  /** CSV of statuses: `live`, `funded`. */
  @ApiProperty({ required: false, example: 'live,funded' })
  @IsOptional() @IsString() status?: string;

  /** Include ended projects (FAILED/REFUNDED/past-deadline). */
  @ApiProperty({ required: false })
  @IsOptional() @IsString() includeEnded?: string;

  /** CSV of category OR subcategory slugs (OR; a parent includes its children). */
  @ApiProperty({ required: false, example: 'technology,games' })
  @IsOptional() @IsString() cat?: string;

  /** Saudi region enum. */
  @ApiProperty({ required: false, example: 'RIYADH' })
  @IsOptional() @IsString() region?: string;

  @ApiProperty({ required: false, description: 'Funding goal min (SAR).' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) goalMin?: number;
  @ApiProperty({ required: false, description: 'Funding goal max (SAR).' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) goalMax?: number;

  @ApiProperty({ required: false, description: 'Amount raised min (SAR).' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) raisedMin?: number;
  @ApiProperty({ required: false, description: 'Amount raised max (SAR).' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) raisedMax?: number;

  /** Percent-funded bucket: `lt25`, `p25_50`, `p50_75`, `p75_100`, `gt100`. */
  @ApiProperty({ required: false, example: 'p75_100' })
  @IsOptional() @IsString() pct?: string;

  /** CSV "show only": `staff`, `recommended`, `saved`. */
  @ApiProperty({ required: false, example: 'staff' })
  @IsOptional() @IsString() only?: string;

  /** Collection slug (حملات وثبة). */
  @ApiProperty({ required: false })
  @IsOptional() @IsString() collection?: string;

  /** Sort key: relevance|popular|newest|ending|most_funded|most_backed|near_me. */
  @ApiProperty({ required: false, example: 'relevance' })
  @IsOptional() @IsString() sort?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) page?: number;

  @ApiProperty({ required: false, default: 24 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) take?: number;
}
