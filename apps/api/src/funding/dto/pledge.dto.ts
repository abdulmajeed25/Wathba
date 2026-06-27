import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
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

export class CreatePledgeDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsUUID()
  tierId!: string;

  @ApiProperty({ example: 75_000 })
  @IsInt()
  @Min(100)
  amountHalalas!: number;

  /** Tokenized card / pay-method ref from the mobile SDK. */
  @ApiProperty({ example: 'tok_sandbox_4242' })
  @IsString()
  source!: string;

  @ApiProperty({ required: false, type: ShippingDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingDto)
  shipping?: ShippingDto;

  @ApiProperty({ enum: ContractType, required: false, default: ContractType.DONATION })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;
}
