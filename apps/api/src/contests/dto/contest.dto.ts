import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContestDto {
  @ApiProperty({ example: 'علّق بأطرف تعليق على آخر تحديث ✨' })
  @IsString() @MinLength(4) @MaxLength(500) promptAr!: string;

  @ApiProperty({ required: false, description: 'UUID of a RewardTier to give as the prize.' })
  @IsOptional() @IsUUID(4) prizeRewardTierId?: string;

  @ApiProperty({ required: false, description: 'UUID of an AddOn to give as the prize.' })
  @IsOptional() @IsUUID(4) prizeAddOnId?: string;

  @ApiProperty({ required: false, description: 'Custom Arabic prize label (free text).' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) prizeCustomAr?: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 50 })
  @IsInt() @Min(1) @Max(50) winnersCount!: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString() startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString() endsAt?: string;
}

export class UpdateContestDto {
  @IsOptional() @IsString() @MinLength(4) @MaxLength(500) promptAr?: string;
  @IsOptional() @IsUUID(4) prizeRewardTierId?: string | null;
  @IsOptional() @IsUUID(4) prizeAddOnId?: string | null;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) prizeCustomAr?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(50) winnersCount?: number;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
}

export class AnnounceContestDto {
  @ApiProperty({ type: [String], description: 'Backer user UUIDs picked as winners.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(4, { each: true })
  winnerBackerIds!: string[];
}
