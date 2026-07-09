import { Global, Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { FeesController } from './fees.controller';

/** STAKES/S-14 — cross-cutting singletons (captcha slot). */
@Global()
@Module({
  controllers: [FeesController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CommonModule {}
