import { sniffImage } from './media.service';
import { CaptchaService } from '../common/captcha.service';

/** STAKES/S-14 — magic-byte sniffing (P5) + the env-flagged captcha slot (P3). */
describe('sniffImage', () => {
  it('recognizes the four allowed image formats', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(
      sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe('webp');
    const avif = new Uint8Array(12);
    avif.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
    avif.set([0x61, 0x76, 0x69, 0x66], 8); // avif
    expect(sniffImage(avif)).toBe('avif');
  });

  it('rejects text/HTML/short payloads', () => {
    expect(sniffImage(new TextEncoder().encode('<html><script>x'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('hello world!!'))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff]))).toBeNull();
  });
});

describe('CaptchaService (env-flagged)', () => {
  it('is a no-op when TURNSTILE_SECRET_KEY is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const svc = new CaptchaService();
    expect(svc.enabled).toBe(false);
    await expect(svc.assertHuman(undefined, 'test')).resolves.toBeUndefined();
  });

  it('rejects a missing token when the key is set', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const svc = new CaptchaService();
    expect(svc.enabled).toBe(true);
    await expect(svc.assertHuman(undefined, 'test')).rejects.toMatchObject({
      message: expect.stringContaining('روبوت') as unknown,
    });
    delete process.env.TURNSTILE_SECRET_KEY;
  });
});
