import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Batch OPS-GAPS R1 — the appellant's submission body. */
export class CreateAppealDto {
  // CLOSEOUT C4 — CONTENT_TAKEDOWN must be accepted here too, or the whole
  // comment-appeal path is unreachable behind a 400 at the HTTP boundary.
  @ApiProperty({ enum: ['ACCOUNT_BAN', 'PROJECT_REJECTION', 'CONTENT_TAKEDOWN'] })
  @IsIn(['ACCOUNT_BAN', 'PROJECT_REJECTION', 'CONTENT_TAKEDOWN'])
  kind!: 'ACCOUNT_BAN' | 'PROJECT_REJECTION' | 'CONTENT_TAKEDOWN';

  @ApiProperty({
    description:
      'المعرّف محل التظلّم: معرّف المستخدم (حظر) أو المشروع (رفض) أو التعليق (إخفاء)',
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
