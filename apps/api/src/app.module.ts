import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { SubjectThrottlerGuard } from './common/subject-throttler.guard';
import { CommonModule } from './common/common.module';
import { SupportModule } from './support/support.module';
import { OpsModule } from './ops/ops.module';
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
import { AppealsModule } from './appeals/appeals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    // CLOSEOUT C5 — env-tunable like the three route-level knobs already are
    // (AUTH_SIGNIN / AUTH_SIGNUP / OPS_AUTH). The default is unchanged at 120,
    // so deployed behaviour is identical; the golden e2e stack drives one
    // account through ~60 serial operator journeys and needs headroom the
    // limiter is right to deny a real single user.
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT ?? 120) },
    ]),
    HeartbeatModule,
    CommonModule,
    SupportModule,
    OpsModule,
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
    AppealsModule,
  ],
  controllers: [HealthController],
  // CLOSEOUT C5 — per-subject buckets (see subject-throttler.guard.ts); the
  // stock IP tracker made every signed-in user share one bucket behind the BFF.
  providers: [{ provide: APP_GUARD, useClass: SubjectThrottlerGuard }],
})
export class AppModule {}
