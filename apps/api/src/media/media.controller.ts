import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { PrismaService } from '../prisma/prisma.service';
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

  /**
   * Required for `evidence`, ignored otherwise — see assertMayUpload below.
   * Optional here rather than in a second DTO because the kinds share one
   * endpoint; the real requirement is enforced in code, where it can say why.
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;
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
  constructor(
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `evidence` is the one kind that is not the caller's own to write.
   *
   * The other kinds land in publicly readable prefixes and belong to whoever
   * uploaded them — a story image, an avatar. `evidence/` is milestone proof
   * and KYC documents, it is the ONE prefix deliberately kept private, and it
   * is what a payout is released against. Until now the endpoint asked only for
   * a valid JWT, so any signed-up account could mint a presigned PUT into it.
   *
   * Not a leak — the prefix is private and keys are UUIDs — but "who may write
   * payout evidence" should not be "anyone with an account", and an attacker
   * who can write there is writing into the review queue for money.
   *
   * OWNER only, deliberately not collaborators: ProjectCollaborator grants
   * CONTENT access (updates + FAQ) and the schema is explicit that money and
   * lifecycle stay owner-only (CREATOR-NO-MONEY). Milestone evidence is money.
   */
  private async assertMayUpload(userId: string, dto: UploadUrlDto): Promise<void> {
    if (dto.kind !== 'evidence') return;

    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for evidence uploads');
    }
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { createdById: true },
    });
    // Same response for "no such project" and "not yours", so this cannot be
    // used to probe which project ids exist.
    if (!project || project.createdById !== userId) {
      throw new ForbiddenException('not your project');
    }
  }

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
    await this.assertMayUpload(jwt.sub, dto);
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
