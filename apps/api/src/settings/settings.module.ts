import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { SettingsService } from './settings.service';
import { PlatformController } from './platform.controller';

/**
 * Batch OPS (registry completion) — DB-backed platform settings (read side).
 * OPS-GAPS Y2 — promoted to @Global so the already-@Global NotificationsModule
 * and EscrowPaymentsModule can inject SettingsService without an import cycle;
 * the explicit `imports: [SettingsModule]` in other modules remains harmless.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PlatformController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
