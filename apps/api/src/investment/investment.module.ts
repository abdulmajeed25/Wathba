import { Module, type DynamicModule } from '@nestjs/common';
import { InvestmentService } from './investment.service';

/**
 * DORMANT — securities-adjacent (§6).
 *
 * The Prisma model exists so the schema compiles, but the providers are
 * gated behind `INVESTMENT_ENABLED=true` and no controllers are exposed.
 * No other bounded context imports this module. Surfacing this in
 * UI/copy without a Saudi securities license is a regulatory violation.
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
