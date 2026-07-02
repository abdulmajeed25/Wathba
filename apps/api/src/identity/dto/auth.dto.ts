import {
  Equals, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';
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
