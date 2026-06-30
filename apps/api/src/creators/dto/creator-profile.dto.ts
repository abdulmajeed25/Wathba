import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Collaborator entry stored on `CreatorProfile.collaborators` (Json column).
 * Shape is creator-supplied — we don't run SQL against it, so we keep it loose.
 */
export class CollaboratorDto {
  @ApiProperty()
  nameAr!: string;

  @ApiProperty({ required: false })
  role?: string;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string;
}

export class PastProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  titleAr!: string;

  @ApiProperty({ description: 'raised (halalas) as decimal string' })
  raisedHalalas!: number;

  @ApiProperty({ description: 'funding goal (halalas) as decimal string' })
  fundingGoalHalalas!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty({
    description: 'rounded percentage funded, one decimal place (e.g. 87.5)',
  })
  fundedPct!: number;

  @ApiProperty({
    description: 'true iff every milestone for the project has status=RELEASED',
  })
  delivered!: boolean;

  @ApiProperty({ nullable: true })
  publishedAt!: string | null;
}

/**
 * Public-safe creator profile contract. Mirrors `ApiCreatorProfile` consumed by
 * `WathbaCreatorTab` on the web. Notably we never include email / phone /
 * nationalIdHash — privacy is enforced at the SELECT level inside the service.
 */
export class CreatorProfileResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  nafathVerified!: boolean;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true })
  bioAr!: string | null;

  @ApiProperty({ nullable: true })
  websiteUrl!: string | null;

  @ApiProperty({ type: [CollaboratorDto] })
  collaborators!: CollaboratorDto[];

  @ApiProperty()
  followersCount!: number;

  @ApiProperty()
  createdProjectsCount!: number;

  @ApiProperty()
  backedProjectsCount!: number;

  @ApiProperty({ nullable: true })
  lastSeenAt!: string | null;

  @ApiProperty({ type: [PastProjectDto] })
  pastProjects!: PastProjectDto[];
}

export class FollowResponseDto {
  @ApiProperty()
  following!: boolean;

  @ApiProperty()
  followersCount!: number;
}

export class UpdateCollaboratorDto {
  @ApiProperty()
  @IsString() @MaxLength(120) nameAr!: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(80) role?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(400) avatarUrl?: string;
}

export class UpdateCreatorProfileDto {
  @ApiProperty({ required: false, description: '0–4000 char Arabic bio' })
  @IsOptional() @IsString() @MaxLength(4000) bioAr?: string;

  @ApiProperty({ required: false, description: 'Optional http(s) URL' })
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(400) websiteUrl?: string;

  @ApiProperty({ required: false, type: [UpdateCollaboratorDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => UpdateCollaboratorDto)
  collaborators?: UpdateCollaboratorDto[];
}
