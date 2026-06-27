import { Module, type DynamicModule } from '@nestjs/common';
import { InvestmentService } from './investment.service';

/**
 * DORMANT — securities-adjacent.
 *
 * This module is registered so the schema and code compile, but it
 * exposes **no controllers** and **no public providers**. The
 * `INVESTMENT_ENABLED` env flag MUST remain `false` until a Saudi
 * securities license is obtained.
 *
 * No other bounded context imports this module. Advertising or surfacing
 * any of these capabilities in the UI is a regulatory violation.
 */
@Module({})
export class InvestmentModule {
  static register(): DynamicModule {
    const enabled = process.env.INVESTMENT_ENABLED === 'true';
    return {
      module: InvestmentModule,
      providers: enabled ? [InvestmentService] : [],
      exports: enabled ? [InvestmentService] : [],
      controllers: [],
    };
  }
}
