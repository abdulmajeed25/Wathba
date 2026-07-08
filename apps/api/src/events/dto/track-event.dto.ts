import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const EVENT_NAMES = [
  'page_view', 'signup', 'verify', 'pledge_started', 'pledge_completed', 'project_submitted',
];

export class TrackEventDto {
  @ApiProperty({ enum: EVENT_NAMES })
  @IsIn(EVENT_NAMES)
  name!: string;

  /** Random client id from localStorage — never derived from anything identifying. */
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(64)
  anonId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(300)
  path?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsObject()
  props?: Record<string, unknown>;
}
