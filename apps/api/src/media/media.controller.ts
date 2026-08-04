import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ALLOWED_KINDS, MediaService, type Kind, type PresignedUpload } from './media.service';

/**
 * Built from ALLOWED_KINDS, not repeated. This DTO and VerifyUploadDto below
 * each carried their own copy of the list, so narrowing the accepted kinds
 * meant remembering three places — and forgetting one leaves the API still
 * accepting an upload the service will reject, or still verifying a key the
 * service can no longer produce.
 */
class UploadUrlDto {
  @IsIn([...ALLOWED_KINDS])
  kind!: Kind;

  @IsString()
  @Matches(/^(image|video|application)\/[\w.+-]+$/)
  mimeType!: string;

  @IsInt() @Min(1) @Max(50 * 1024 * 1024)
  sizeBytes!: number;
}

/** Same source as the DTO above — see the note there. */
const KEY_RE = new RegExp(`^(${ALLOWED_KINDS.join('|')})\\/[\\w/.-]+$`);

/** STAKES/S-14 (P5) — verify an uploaded object by key. */
class VerifyUploadDto {
  @IsString()
  @Matches(KEY_RE)
  key!: string;
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-url')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mint a presigned PUT URL for direct-to-MinIO upload. ' +
      'Client PUTs the file body to `url` with the same Content-Type, then ' +
      'persists `key`/`publicUrl` on the relevant model.',
  })
  async createUploadUrl(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: UploadUrlDto,
  ): Promise<PresignedUpload> {
    return this.media.createPresignedPut({
      userId: jwt.sub,
      kind: dto.kind,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  /** STAKES/S-14 (P5) — post-upload magic-byte verification (image kinds). */
  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify an uploaded object is a real image (magic bytes); deletes + 400s otherwise' })
  async verify(
    @CurrentUser() jwt: JwtPayload,
    @Body() dto: VerifyUploadDto,
  ): Promise<{ ok: true; format: string }> {
    // Batch OPS-PRO P0 — only the uploader may verify (and thus trigger the
    // delete-on-mismatch) of an object.
    return this.media.verifyObject(dto.key, jwt.sub);
  }
}
