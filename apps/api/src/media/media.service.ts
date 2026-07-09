import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * MinIO-backed media uploads.
 *
 * Uses the S3 SDK pointed at our local MinIO (S3-compatible). The web
 * client asks for a presigned PUT URL, then uploads the file directly
 * to MinIO (no proxy through Node, no memory bloat on big files).
 *
 * Each upload is keyed `<bucket>/<kind>/<yyyy>/<mm>/<uuid>.<ext>` so the
 * objects sort chronologically on the filesystem.
 *
 * Buckets live on the same MinIO that's already hosting Karaji and the
 * Wathba demo evidence buckets. We use the existing `venture-evidence`
 * bucket for project media; can be split later by `kind`.
 */

const ALLOWED_KINDS = ['hero', 'story', 'reward', 'evidence', 'avatar'] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

const MIME_BY_KIND: Record<Kind, RegExp> = {
  hero:     /^image\/(jpeg|png|webp|avif)$/,
  story:    /^(image\/(jpeg|png|webp|avif|gif)|video\/(mp4|webm))$/,
  reward:   /^image\/(jpeg|png|webp|avif)$/,
  evidence: /^(image\/.*|application\/pdf|video\/.*)$/,
  avatar:   /^image\/(jpeg|png|webp|avif)$/,
};

const MAX_BYTES_BY_KIND: Record<Kind, number> = {
  hero:     8 * 1024 * 1024,   // 8 MB
  story:   25 * 1024 * 1024,   // 25 MB
  reward:   6 * 1024 * 1024,   // 6 MB
  evidence:50 * 1024 * 1024,   // 50 MB
  avatar:   2 * 1024 * 1024,   // 2 MB
};

export interface PresignedUpload {
  /** Pre-signed PUT URL the client uses directly. Expires in 5 minutes. */
  url: string;
  /** Object key inside the bucket. Returned to the client so it can save it. */
  key: string;
  /** The bucket name (in case we split later by `kind`). */
  bucket: string;
  /** Public read URL (works once the upload completes). */
  publicUrl: string;
  /** Expiry timestamp the client should respect. */
  expiresAt: string;
}

@Injectable()
export class MediaService {
  private readonly log = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  private readonly bucket: string;

  constructor(cfg: ConfigService) {
    this.endpoint = cfg.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    this.publicEndpoint = cfg.get<string>('MINIO_PUBLIC_ENDPOINT', this.endpoint);
    this.bucket = cfg.get<string>('MEDIA_BUCKET', 'venture-evidence');
    this.s3 = new S3Client({
      region: 'us-east-1', // any value works for MinIO; required by the SDK
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: cfg.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
    });
  }

  /**
   * STAKES/S-14 (P5) — post-upload verification: fetch the first bytes from
   * storage and require real image magic numbers for the image kinds. A
   * mismatch deletes the object and 400s — a text/HTML payload can no longer
   * live behind an image/* declared type.
   */
  async verifyObject(key: string): Promise<{ ok: true; format: string }> {
    let bytes: Uint8Array;
    try {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: 'bytes=0-15' }),
      );
      bytes = new Uint8Array(await res.Body!.transformToByteArray());
    } catch {
      throw new BadRequestException('الملف غير موجود — أعد الرفع');
    }
    const format = sniffImage(bytes);
    if (!format) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch(() => {});
      this.log.warn(`magic-byte check failed for key=${key} — object deleted`);
      throw new BadRequestException('الملف ليس صورة صالحة (JPEG/PNG/WebP/AVIF)');
    }
    return { ok: true, format };
  }

  async createPresignedPut(opts: {
    userId: string;
    kind: Kind;
    mimeType: string;
    sizeBytes: number;
    ext?: string;
  }): Promise<PresignedUpload> {
    if (!ALLOWED_KINDS.includes(opts.kind)) {
      throw new BadRequestException(`unsupported kind: ${opts.kind}`);
    }
    if (!MIME_BY_KIND[opts.kind].test(opts.mimeType)) {
      throw new BadRequestException(
        `mimeType ${opts.mimeType} not allowed for kind ${opts.kind}`,
      );
    }
    if (opts.sizeBytes <= 0 || opts.sizeBytes > MAX_BYTES_BY_KIND[opts.kind]) {
      throw new BadRequestException(
        `sizeBytes ${opts.sizeBytes} exceeds max for kind ${opts.kind}`,
      );
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extFromMime = opts.mimeType.split('/')[1]?.split('+')[0] ?? 'bin';
    const ext = opts.ext ?? extFromMime;
    const key = `${opts.kind}/${yyyy}/${mm}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.mimeType,
      // ContentLength would be enforced via signed-headers — we keep the
      // signed URL simple here and let MinIO reject oversize PUTs via the
      // bucket policy if one is set.
      Metadata: { uploader: opts.userId, kind: opts.kind },
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const publicUrl = `${this.publicEndpoint}/${this.bucket}/${key}`;
    const expiresAt = new Date(now.getTime() + 300 * 1000).toISOString();

    this.log.log(`presigned PUT user=${opts.userId} kind=${opts.kind} key=${key}`);
    return { url, key, bucket: this.bucket, publicUrl, expiresAt };
  }
}

/**
 * STAKES/S-14 (P5) — magic-byte signatures for the image kinds. The presign
 * flow means the API never touches upload bytes, so declared MIME was the
 * only check; verifyObject() closes that by reading the first bytes back
 * from storage after the PUT.
 */
export function sniffImage(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'avif' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand.startsWith('avif') || brand.startsWith('avis') || brand.startsWith('mif1')) return 'avif';
  }
  return null;
}
