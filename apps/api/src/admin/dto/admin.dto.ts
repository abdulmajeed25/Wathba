import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewProjectDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  reason?: string;

  /** Batch PAY (Part 5) — grant a 61–120 day duration (AuditLogged). */
  @ApiProperty({ required: false, minimum: 61, maximum: 120 })
  @IsOptional() @IsInt() @Min(61) @Max(120)
  approvedDurationDays?: number;
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

/** Batch PAY — audited ops tool: force a deadline (settlement drills + e2e). */
export class DeadlineOverrideDto {
  @ApiProperty({ example: '2026-07-10T00:00:00.000Z' })
  @IsString()
  deadline!: string;
}
