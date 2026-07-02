import { IsEnum, IsIBAN, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BeneficiaryType } from '@prisma/client';

export class UpsertBeneficiaryDto {
  @ApiProperty({ enum: BeneficiaryType, example: 'BANK_ACCOUNT' })
  @IsEnum(BeneficiaryType)
  type!: BeneficiaryType;

  /** Required for BANK_ACCOUNT; validated with an IBAN checksum. */
  @ApiProperty({ required: false, example: 'SA0380000000608010167519' })
  @ValidateIf((o: UpsertBeneficiaryDto) => o.type === BeneficiaryType.BANK_ACCOUNT)
  @IsIBAN({ message: 'invalid IBAN' })
  iban?: string;

  @ApiProperty({ example: 'سارة العامري' })
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '+9665XXXXXXXX' })
  @IsString() @Matches(/^\+?\d{9,15}$/, { message: 'mobile must be 9–15 digits' })
  mobile!: string;

  @ApiProperty({ required: false, example: 'الرياض' })
  @IsOptional() @IsString() @MaxLength(80)
  city?: string;
}
