import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { IdentityModule } from './identity/identity.module';
import { ProjectsModule } from './projects/projects.module';
import { RewardsModule } from './rewards/rewards.module';
import { AddonsModule } from './addons/addons.module';
import { FundingModule } from './funding/funding.module';
import { EscrowPaymentsModule } from './escrow-payments/escrow-payments.module';
import { MilestonesModule } from './milestones/milestones.module';
import { ProcurementModule } from './procurement/procurement.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContractsModule } from './contracts/contracts.module';
import { InvestmentModule } from './investment/investment.module';
import { AdminModule } from './admin/admin.module';
import { MediaModule } from './media/media.module';
import { CommentsModule } from './comments/comments.module';
import { UpdatesModule } from './updates/updates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    IdentityModule,
    ProjectsModule,
    RewardsModule,
    AddonsModule,
    FundingModule,
    EscrowPaymentsModule,
    MilestonesModule,
    ProcurementModule,
    NotificationsModule,
    ContractsModule,
    InvestmentModule, // DORMANT — see investment/investment.module.ts
    AdminModule,
    MediaModule,
    CommentsModule,
    UpdatesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
