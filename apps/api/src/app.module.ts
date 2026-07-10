import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { SupportModule } from './support/support.module';
import { HomeModule } from './home/home.module';
import { HeartbeatModule } from './common/heartbeat.service';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { IdentityModule } from './identity/identity.module';
import { ProjectsModule } from './projects/projects.module';
import { RewardsModule } from './rewards/rewards.module';
import { AddonsModule } from './addons/addons.module';
import { FundingModule } from './funding/funding.module';
import { EscrowPaymentsModule } from './escrow-payments/escrow-payments.module';
import { EventsModule } from './events/events.module';
import { MilestonesModule } from './milestones/milestones.module';
import { ProcurementModule } from './procurement/procurement.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContractsModule } from './contracts/contracts.module';
import { AdminModule } from './admin/admin.module';
import { MediaModule } from './media/media.module';
import { CommentsModule } from './comments/comments.module';
import { UpdatesModule } from './updates/updates.module';
import { ContestsModule } from './contests/contests.module';
import { FaqModule } from './faq/faq.module';
import { CommunityModule } from './community/community.module';
import { CreatorsModule } from './creators/creators.module';
import { BackersModule } from './backers/backers.module';
import { AuditViewModule } from './audit-view/audit-view.module';
import { ChangelogModule } from './changelog/changelog.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { CategoriesModule } from './categories/categories.module';
import { DiscoverModule } from './discover/discover.module';
import { CollectionsModule } from './collections/collections.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    HeartbeatModule,
    CommonModule,
    SupportModule,
    HomeModule,
    PrismaModule,
    IdentityModule,
    ProjectsModule,
    RewardsModule,
    AddonsModule,
    FundingModule,
    EscrowPaymentsModule,
    EventsModule,
    MilestonesModule,
    ProcurementModule,
    NotificationsModule,
    ContractsModule,
    AdminModule,
    MediaModule,
    CommentsModule,
    UpdatesModule,
    ContestsModule,
    FaqModule,
    CommunityModule,
    CreatorsModule,
    BackersModule,
    AuditViewModule,
    ChangelogModule,
    AnalyticsModule,
    CollaboratorsModule,
    CategoriesModule,
    DiscoverModule,
    CollectionsModule,
    EmailModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
