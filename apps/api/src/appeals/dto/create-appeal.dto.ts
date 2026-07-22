import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Batch OPS-GAPS R1 — the appellant's submission body. */
export class CreateAppealDto {
  @ApiProperty({ enum: ['ACCOUNT_BAN', 'PROJECT_REJECTION'] })
  @IsIn(['ACCOUNT_BAN', 'PROJECT_REJECTION'])
  kind!: 'ACCOUNT_BAN' | 'PROJECT_REJECTION';

  @ApiProperty({
    description: 'المعرّف محل التظلّم: معرّف المستخدم (حظر) أو معرّف المشروع (رفض)',
    format: 'uuid',
  })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ description: 'حيثيات التظلّم (٢٠ حرفاً على الأقل)' })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  reasonAr!: string;
}
