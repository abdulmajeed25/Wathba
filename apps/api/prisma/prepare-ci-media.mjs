// Only provisions the ephemeral GitHub Actions fixture bucket, never a deployment.
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

if (process.env.CI !== 'true' || process.env.MINIO_ENDPOINT !== 'http://127.0.0.1:9000' ||
    process.env.MEDIA_BUCKET !== 'wathba-ci-media') {
  throw new Error('Only the isolated CI media bucket may be initialized');
}
const client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT, region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY },
});
try {
  await client.send(new CreateBucketCommand({ Bucket: process.env.MEDIA_BUCKET }));
} finally {
  client.destroy();
}
// The catalogue seed applies the existing prefix-scoped public media policy.
