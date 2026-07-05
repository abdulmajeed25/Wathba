import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * STAKES/S-3 — global so any bounded context can inject EmailService without
 * import churn (mirrors how notifications are wired).
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
