import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SettingsService } from './settings.service';

/**
 * OPS-GAPS Y2 — the public platform-status probe. Unauthenticated + cheap so
 * the web middleware can poll it (cached) to honour the DB-backed
 * maintenance-mode flag without a deploy. Exposes only non-sensitive flags.
 */
@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly settings: SettingsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Public platform status — DB-backed maintenance flag' })
  async status(): Promise<{ maintenance: boolean }> {
    // Env override wins (infra-level lockdown), else the operator-tunable flag.
    const envForced = process.env.MAINTENANCE_MODE === '1';
    const maintenance = envForced || (await this.settings.get('platform.maintenanceMode'));
    return { maintenance: Boolean(maintenance) };
  }
}
