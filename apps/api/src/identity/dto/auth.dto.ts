import { IsEmail, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ example: 'سارة العامري' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'sara@example.sa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass!23' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false, example: '+9665XXXXXXXX' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be E.164-ish' })
  phone?: string;
}

export class SignInDto {
  @ApiProperty({ example: 'sara@example.sa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass!23' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'سارة' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiProperty({ required: false, example: '+9665XXXXXXXX' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{8,15}$/)
  phone?: string;

  @ApiProperty({ required: false, example: 'ar' })
  @IsOptional()
  @IsString()
  locale?: string;
}
