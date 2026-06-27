import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRFQDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    example: 'مطلوب تصنيع ٢,٥٠٠ وحدة من إطار درون من ألياف الكربون بمواصفات…',
  })
  @IsString()
  @MinLength(40)
  @MaxLength(4_000)
  specsAr!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  dueDate!: string;
}

export class SubmitBidDto {
  @ApiProperty({ example: 1_200_000_00 })
  @IsInt()
  @Min(100)
  amountHalalas!: number;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(1)
  leadTimeDays!: number;

  @ApiProperty({ example: 'ملتزمون بكل المواصفات + ضمان جودة سنة.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2_000)
  specComplianceNote!: string;
}

export class ListRFQsQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ required: false, enum: ['OPEN', 'AWARDED', 'CLOSED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: 'OPEN' | 'AWARDED' | 'CLOSED' | 'CANCELLED';
}
