'use client';

import { useCallback, useState } from 'react';

export type UploadKind = 'hero' | 'story' | 'reward' | 'evidence' | 'avatar';

export interface UploadResult {
  key: string;
  publicUrl: string;
  bucket: string;
}

interface UploadState {
  progress: number;
  uploading: boolean;
  error: string | null;
  result: UploadResult | null;
}

interface PresignedResponse {
  url: string;
  key: string;
  bucket: string;
  publicUrl: string;
  expiresAt: string;
}

const INITIAL: UploadState = { progress: 0, uploading: false, error: null, result: null };

/**
 * Two-step direct-to-MinIO upload: ask the API for a presigned PUT URL,
 * then PUT the file body straight to object storage. Node never sees the
 * bytes, so we can handle 50 MB videos without proxy overhead.
 */
export function useUpload(): UploadState & {
  upload: (file: File, kind: UploadKind) => Promise<UploadResult | null>;
  reset: () => void;
} {
  const [state, setState] = useState<UploadState>(INITIAL);

  const upload = useCallback(
    async (file: File, kind: UploadKind): Promise<UploadResult | null> => {
      setState({ progress: 0, uploading: true, error: null, result: null });
      try {
        const presignRes = await fetch('/api/media/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        });
        if (!presignRes.ok) {
          const msg = await presignRes.text();
          throw new Error(msg || `presign failed (${presignRes.status})`);
        }
        const presigned = (await presignRes.json()) as PresignedResponse;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presigned.url);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.upload.onprogress = (e): void => {
            if (e.lengthComputable) {
              setState((s) => ({ ...s, progress: Math.round((e.loaded / e.total) * 100) }));
            }
          };
          xhr.onload = (): void => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`upload failed (${xhr.status})`));
          };
          xhr.onerror = (): void => reject(new Error('network error during upload'));
          xhr.send(file);
        });

        const result: UploadResult = {
          key: presigned.key,
          publicUrl: presigned.publicUrl,
          bucket: presigned.bucket,
        };
        setState({ progress: 100, uploading: false, error: null, result });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'upload failed';
        setState({ progress: 0, uploading: false, error: message, result: null });
        return null;
      }
    },
    [],
  );

  const reset = useCallback((): void => setState(INITIAL), []);

  return { ...state, upload, reset };
}
