import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewProjectDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  reason?: string;
}

class PlatformStakePayload {
  @ApiProperty({ default: true })
  @IsOptional() @IsBoolean()
  isPartnered?: true;

  @ApiProperty({ enum: ['equity', 'profit-share', 'co-founder'] })
  @IsString()
  stakeType!: 'equity' | 'profit-share' | 'co-founder';

  @ApiProperty()
  @IsString() @MinLength(20)
  disclosureAr!: string;
}

export class SetPlatformPartnerDto {
  /** Null clears the marker. Object sets it. */
  @ApiProperty({ type: PlatformStakePayload, nullable: true })
  @IsOptional() @IsObject() @ValidateNested()
  @Type(() => PlatformStakePayload)
  platformPartner!: PlatformStakePayload | null;
}

export class GrantRoleDto {
  @ApiProperty({ enum: ['CREATOR', 'BACKER', 'SUPPLIER'], example: 'SUPPLIER' })
  @IsIn(['CREATOR', 'BACKER', 'SUPPLIER'])
  role!: 'CREATOR' | 'BACKER' | 'SUPPLIER';
}

/** Batch CAT — toggle the "مختارات وثبة" editorial pick. */
export class SetStaffPickDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isStaffPick!: boolean;
}

/** STAKES/K2 — admin resolution of a reported comment. */
export class ModerateCommentDto {
  @ApiProperty({ enum: ['hide', 'dismiss'] })
  @IsIn(['hide', 'dismiss'])
  action!: 'hide' | 'dismiss';
}
