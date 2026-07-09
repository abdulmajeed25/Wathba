import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { MediaService, type PresignedUpload } from './media.service';

class UploadUrlDto {
  @IsIn(['hero', 'story', 'reward', 'evidence', 'avatar'])
  kind!: 'hero' | 'story' | 'reward' | 'evidence' | 'avatar';

  @IsString()
  @Matches(/^(image|video|application)\/[\w.+-]+$/)
  mimeType!: string;

  @IsInt() @Min(1) @Max(50 * 1024 * 1024)
  sizeBytes!: number;
}

/** STAKES/S-14 (P5) — verify an uploaded object by key. */
class VerifyUploadDto {
  @IsString()
  @Matches(/^(hero|story|reward|evidence|avatar)\/[\w/.-]+$/)
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
  async verify(@Body() dto: VerifyUploadDto): Promise<{ ok: true; format: string }> {
    return this.media.verifyObject(dto.key);
  }
}
