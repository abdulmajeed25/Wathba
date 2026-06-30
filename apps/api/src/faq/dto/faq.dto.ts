import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFaqItemDto {
  @ApiProperty({ example: 'متى يصل المنتج؟' })
  @IsString() @MinLength(3) @MaxLength(200) questionAr!: string;

  @ApiProperty({ example: 'نتوقّع التسليم خلال الربع الثاني من 2026 إن شاء الله.' })
  @IsString() @MinLength(3) @MaxLength(4000) answerAr!: string;

  @ApiProperty({ default: 0, required: false })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateFaqItemDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) questionAr?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(4000) answerAr?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class AskFaqDto {
  @ApiProperty({ example: 'هل ستتوفر نسخة بألوان مختلفة؟' })
  @IsString() @MinLength(5) @MaxLength(1000) bodyAr!: string;
}

export class AnswerFaqQuestionDto {
  @ApiProperty({ example: 'نعم — نسخة كحلية ونسخة رمادية ستتوفّران بعد الإطلاق.' })
  @IsString() @MinLength(3) @MaxLength(4000) answerAr!: string;

  @ApiProperty({
    default: true,
    description:
      'When true (default), the answer is published as a new FaqItem and the question is linked to it.',
  })
  @IsOptional() @IsBoolean() publish?: boolean;
}
