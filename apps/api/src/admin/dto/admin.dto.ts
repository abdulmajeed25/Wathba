import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewProjectDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

class PlatformStakePayload {
  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  isPartnered?: true;

  @ApiProperty({ enum: ['equity', 'profit-share', 'co-founder'] })
  @IsString()
  stakeType!: 'equity' | 'profit-share' | 'co-founder';

  @ApiProperty()
  @IsString()
  @MinLength(20)
  disclosureAr!: string;
}

export class SetPlatformPartnerDto {
  /**
   * Null clears the marker (project is no longer Wathba-partnered).
   * Object value sets the marker.
   */
  @ApiProperty({ type: PlatformStakePayload, nullable: true })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlatformStakePayload)
  platformPartner!: PlatformStakePayload | null;
}
