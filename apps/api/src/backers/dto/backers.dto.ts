import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PledgeStatus, RewardFulfillmentStatus } from '@prisma/client';

/** Query filters for the creator backer roster (Creator-CC / CC-02). */
export class ListBackersQueryDto {
  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  take?: number;

  @ApiProperty({ required: false, description: 'id of the last row of the previous page' })
  @IsOptional() @IsUUID('4')
  cursor?: string;

  @ApiProperty({ required: false, description: 'Filter by reward tier' })
  @IsOptional() @IsUUID('4')
  tierId?: string;

  @ApiProperty({ required: false, enum: PledgeStatus, description: 'Filter by pledge (money) status' })
  @IsOptional() @IsEnum(PledgeStatus)
  status?: PledgeStatus;

  @ApiProperty({ required: false, enum: RewardFulfillmentStatus, description: 'Filter by fulfillment status' })
  @IsOptional() @IsEnum(RewardFulfillmentStatus)
  rewardStatus?: RewardFulfillmentStatus;

  @ApiProperty({ required: false, description: 'true → only pledges on tiers that require shipping' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : undefined))
  shippingRequired?: boolean;

  @ApiProperty({ required: false, description: 'Free-text search on backer name or backer number' })
  @IsOptional() @IsString() @MaxLength(80)
  search?: string;
}

/** Update the fulfillment status of one pledge (Creator-CC / CC-02). */
export class UpdateRewardStatusDto {
  @ApiProperty({ enum: RewardFulfillmentStatus })
  @IsEnum(RewardFulfillmentStatus)
  rewardStatus!: RewardFulfillmentStatus;
}

/** Bulk-set fulfillment status, optionally scoped to a tier (Creator-CC / CC-02). */
export class BulkRewardStatusDto {
  @ApiProperty({ enum: RewardFulfillmentStatus })
  @IsEnum(RewardFulfillmentStatus)
  rewardStatus!: RewardFulfillmentStatus;

  @ApiProperty({ required: false, description: 'Scope the bulk update to a single tier; omit for all backers' })
  @IsOptional() @IsUUID('4')
  tierId?: string;
}

/** CSV export (Creator-CC / CC-03). Level 2 (with addresses) is server-gated on project status. */
export class ExportBackersQueryDto {
  @ApiProperty({ required: false, enum: ['summary', 'fulfillment'], default: 'summary' })
  @IsOptional() @IsIn(['summary', 'fulfillment'])
  level?: 'summary' | 'fulfillment';

  // Export-what-you-see: the roster filters are echoed onto the export.
  @ApiProperty({ required: false })
  @IsOptional() @IsUUID('4')
  tierId?: string;

  @ApiProperty({ required: false, enum: PledgeStatus })
  @IsOptional() @IsEnum(PledgeStatus)
  status?: PledgeStatus;

  @ApiProperty({ required: false, enum: RewardFulfillmentStatus })
  @IsOptional() @IsEnum(RewardFulfillmentStatus)
  rewardStatus?: RewardFulfillmentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : undefined))
  shippingRequired?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(80)
  search?: string;
}
