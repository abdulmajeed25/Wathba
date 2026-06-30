import {
  ArrayMaxSize, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID,
  Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';

export class ShippingDto {
  @IsString() name!: string;
  @IsString() address!: string;
  @IsString() city!: string;
  @IsString() country!: string;
  @IsString() postal!: string;
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
