import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackEventDto {
  /** STAKES/S-15 (O1) — free-form here; the SERVICE whitelist silently drops
   *  unknown names with a 200 (analytics must never error a page — the DTO
   *  @IsIn used to 400 first, contradicting the documented contract). */
  @ApiProperty({ example: 'page_view' })
  @IsString() @MaxLength(60)
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
