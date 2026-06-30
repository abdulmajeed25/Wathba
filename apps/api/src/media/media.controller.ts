import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-url')
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
}
