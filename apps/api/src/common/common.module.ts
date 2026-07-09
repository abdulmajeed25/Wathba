import { Global, Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';

/** STAKES/S-14 — cross-cutting singletons (captcha slot). */
@Global()
@Module({
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CommonModule {}
