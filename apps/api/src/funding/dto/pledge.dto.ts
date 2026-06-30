import {
  ArrayMaxSize, IsArray, IsEnum, IsInt, IsISO31661Alpha2, IsObject, IsOptional, IsString,
  IsUUID, Matches, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';

/**
 * Backer's shipping address — required for tiers that ship a physical
 * product. Length caps and a Saudi postal-code regex keep adversarial input
 * out (oversized strings → DB bloat; non-numeric postal → ZATCA / shipping
 * integration errors downstream).
 */
export class ShippingDto {
  @ApiProperty({ example: 'سارة العامري', maxLength: 80 })
  @IsString() @MinLength(2) @MaxLength(80) name!: string;

  @ApiProperty({ example: 'حي العليا، شارع الأمير سلطان، مبنى 14', maxLength: 240 })
  @IsString() @MinLength(4) @MaxLength(240) address!: string;

  @ApiProperty({ example: 'الرياض', maxLength: 80 })
  @IsString() @MinLength(2) @MaxLength(80) city!: string;

  /** ISO-3166 alpha-2 country code (e.g. SA, AE). */
  @ApiProperty({ example: 'SA', minLength: 2, maxLength: 2 })
  @IsISO31661Alpha2() country!: string;

  /** Saudi postal codes are 5 digits; we accept any 4–10 digit string for
   *  GCC neighbours but reject anything non-numeric or absurdly long. */
  @ApiProperty({ example: '11564', maxLength: 10 })
  @IsString() @Matches(/^\d{4,10}$/, { message: 'postal must be 4–10 digits' })
  postal!: string;
}

/** Optional add-on stacked onto a pledge. */
export class PledgeAddOnDto {
  @ApiProperty() @IsUUID() addOnId!: string;
  @ApiProperty({ default: 1, minimum: 1 })
  @IsOptional() @IsInt() @Min(1)
  qty?: number;
}

export class CreatePledgeDto {
  @ApiProperty() @IsUUID() projectId!: string;
  @ApiProperty() @IsUUID() tierId!: string;

  @ApiProperty({ example: 75_000 })
  @IsInt() @Min(100) amountHalalas!: number;

  /** Tokenized card / pay-method ref from the web SDK. */
  @ApiProperty({ example: 'tok_sandbox_4242' })
  @IsString() source!: string;

  @ApiProperty({ required: false, type: ShippingDto })
  @IsOptional() @IsObject() @ValidateNested()
  @Type(() => ShippingDto)
  shipping?: ShippingDto;

  @ApiProperty({ enum: ContractType, required: false, default: ContractType.DONATION })
  @IsOptional() @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiProperty({ required: false, type: [PledgeAddOnDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => PledgeAddOnDto)
  addOns?: PledgeAddOnDto[];
}
