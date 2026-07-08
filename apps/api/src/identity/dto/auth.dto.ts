import {
  ArrayMaxSize, Equals, IsArray, IsBoolean, IsEmail, IsIn, IsOptional,
  IsString, IsUrl, Matches, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ example: 'سارة العامري' })
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'sara@example.sa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass!23' })
  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false, example: '+9665XXXXXXXX' })
  @IsOptional() @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be E.164-ish' })
  phone?: string;

  /** PDPL (Sprint 2 / P0-702): explicit consent is mandatory at signup. */
  @ApiProperty({ example: true, description: 'must be true — consent to Terms + Privacy (PDPL)' })
  @IsBoolean() @Equals(true, { message: 'you must accept the terms and privacy policy' })
  acceptTerms!: boolean;
}

export class SignInDto {
  @ApiProperty({ example: 'sara@example.sa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass!23' })
  @IsString() @MinLength(8)
  password!: string;
}

/** STAKES/C4 — one optional, validated social link. */
export class SocialLinkDto {
  @ApiProperty({ enum: ['x', 'instagram', 'linkedin', 'youtube', 'tiktok'] })
  @IsIn(['x', 'instagram', 'linkedin', 'youtube', 'tiktok'])
  platform!: string;

  @ApiProperty({ example: 'https://x.com/wathba' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(300)
  url!: string;
}

/** STAKES/E2 — per-type notification toggles. */
export class NotificationPrefsDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  projectUpdates?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  campaignOutcomes?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  comments?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  marketing?: boolean;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @Matches(/^\+?\d{8,15}$/)
  phone?: string;

  @ApiProperty({ required: false, example: 'ar' })
  @IsOptional() @IsString()
  locale?: string;

  /** STAKES/C7 — user-chosen URL handle; lowercased server-side. */
  @ApiProperty({ required: false, example: 'sara-alamri' })
  @IsOptional() @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,29}$/, {
    message: 'handle must be 3-30 chars: letters, digits, _ . -',
  })
  handle?: string;

  @ApiProperty({ required: false, description: 'null clears the avatar' })
  @IsOptional() @IsUrl({ require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(600)
  bioAr?: string;

  @ApiProperty({ required: false, example: 'الرياض' })
  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUrl({ require_protocol: true })
  @MaxLength(300)
  websiteUrl?: string;

  @ApiProperty({ required: false, type: [SocialLinkDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(5)
  @ValidateNested({ each: true }) @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  /** STAKES/E2 — notification preferences (settings toggles). */
  @ApiProperty({ required: false, type: NotificationPrefsDto })
  @IsOptional() @ValidateNested() @Type(() => NotificationPrefsDto)
  notificationPrefs?: NotificationPrefsDto;

  /** STAKES/E3 — privacy controls. */
  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  profilePublic?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  showBackedCount?: boolean;
}

export class RefreshDto {
  @ApiProperty({ description: 'the rotating refresh token issued at signin/signup/refresh' })
  @IsString() @MinLength(32)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'sara@example.sa' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'the one-time token from the reset link' })
  @IsString() @MinLength(24)
  token!: string;

  @ApiProperty({ example: 'NewStrongPass!23' })
  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;
}

/** STAKES/E1 — password change (settings), current-password checked. */
export class ChangePasswordDto {
  @ApiProperty()
  @IsString() @MinLength(8) @MaxLength(128)
  currentPassword!: string;

  @ApiProperty()
  @IsString() @MinLength(8) @MaxLength(128)
  newPassword!: string;
}

/** STAKES/E1 — email change (settings), current-password checked. */
export class ChangeEmailDto {
  @ApiProperty()
  @IsString() @MinLength(8) @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'new@example.sa' })
  @IsEmail()
  newEmail!: string;
}
