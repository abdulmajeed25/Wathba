import { Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { FundingModule } from '../funding/funding.module';
import { EscrowPaymentsModule } from '../escrow-payments/escrow-payments.module';
import { CategoriesModule } from '../categories/categories.module';
import { SettingsModule } from '../settings/settings.module';

import { OperationsRegistry } from './operations.registry';
import { OpsController } from './ops.controller';
import { OpsAuthService } from './ops-auth.service';
import { OpsAuthController } from './ops-auth.controller';
import { OpsRbacService } from './ops-rbac.service';
import { OpsProposalsService } from './ops-proposals.service';
import { OpsProposalsController } from './ops-proposals.controller';
import { OpsAuditService } from './ops-audit.service';
import { OpsAuditController } from './ops-audit.controller';
import { OpsAgentsService } from './ops-agents.service';
import { OpsAgentsController } from './ops-agents.controller';
import { OpsReadService } from './read/ops-read.service';
import { OpsReadController } from './read/ops-read.controller';
import { OpsAnalyticsService } from './read/ops-analytics.service';
import { OpsAnalyticsController } from './read/ops-analytics.controller';
import { ImpersonationService } from './impersonation/impersonation.service';
import { OpsImpersonationController } from './impersonation/impersonation.controller';
import { OpsOperationsGuard } from './ops-agents.guard';
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';
import { projectsOps } from './operations/projects.ops';
import { moderationOps } from './operations/moderation.ops';
import { usersOps } from './operations/users.ops';
import { moneyOps } from './operations/money.ops';
import { contentOps } from './operations/content.ops';
import { agentsOps } from './operations/agents.ops';
import { categoriesOps } from './operations/categories.ops';
import { settingsOps } from './operations/settings.ops';
import { supportOps } from './operations/support.ops';
import { integrityOps } from './operations/integrity.ops';
import { projectsLifecycleOps } from './operations/projects-lifecycle.ops';
import { procurementOps } from './operations/procurement.ops';
import { milestonesOps } from './operations/milestones.ops';
import { maintenanceOps } from './operations/maintenance.ops';
import { appealsOps } from './operations/appeals.ops';
import { commsOps } from './operations/comms.ops';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { FundingService } from '../funding/funding.service';
import { PayoutDisburser } from '../escrow-payments/payout.disburser';
import { EscrowService } from '../escrow-payments/escrow.service';
import { MoyasarAdapter } from '../escrow-payments/moyasar.adapter';
import { ZatcaService } from '../escrow-payments/zatca.service';
import { WebhookService } from '../escrow-payments/webhook.service';
import { LedgerService } from '../escrow-payments/ledger.service';
import { PdplService } from '../identity/pdpl.service';
import { CategoriesService } from '../categories/categories.service';
import { SettingsService } from '../settings/settings.service';

/**
 * OPS Part 0 — the operations layer. The registry is the ONLY path a
 * governed capability may take to the database; admin controllers,
 * the Part-5 ops UI and Part-4 agents are all clients of it.
 */
@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    NotificationsModule,
    EmailModule,
    FundingModule,
    EscrowPaymentsModule,
    CategoriesModule,
    SettingsModule,
  ],
  controllers: [
    OpsController,
    OpsAuthController,
    OpsProposalsController,
    OpsAuditController,
    OpsAgentsController,
    OpsReadController,
    OpsAnalyticsController,
    OpsImpersonationController,
  ],
  providers: [
    OperationsRegistry,
    OpsAuthService,
    OpsRbacService,
    OpsProposalsService,
    OpsAuditService,
    OpsAgentsService,
    OpsReadService,
    OpsAnalyticsService,
    ImpersonationService,
    OpsSessionGuard,
    OpsIpAllowlistGuard,
    OpsOperationsGuard,
  ],
  exports: [OperationsRegistry, OpsAuthService, OpsRbacService],
})
export class OpsModule implements OnModuleInit {
  constructor(
    private readonly registry: OperationsRegistry,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly funding: FundingService,
    private readonly disburser: PayoutDisburser,
    private readonly escrow: EscrowService,
    private readonly moyasar: MoyasarAdapter,
    private readonly zatca: ZatcaService,
    private readonly webhook: WebhookService,
    private readonly ledger: LedgerService,
    private readonly pdpl: PdplService,
    private readonly categories: CategoriesService,
    private readonly settings: SettingsService,
    private readonly rbac: OpsRbacService,
    private readonly agents: OpsAgentsService,
  ) {}

  onModuleInit(): void {
    // Part 2 — swap the fail-safe default ports for the live RBAC matrix
    // and the four-eyes switch (auto-on at the 2nd money admin).
    this.registry.permissionPort = this.rbac;
    this.registry.fourEyesPort = this.rbac;
    // Part 4 — the no-blind-writes gate reads the durable AgentDryRun ledger.
    this.registry.agentGatePort = this.agents;
    const defs = [
      ...projectsOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
        settings: this.settings,
      }),
      ...moderationOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
      }),
      ...usersOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
        pdpl: this.pdpl,
      }),
      ...moneyOps({
        prisma: this.prisma,
        funding: this.funding,
        disburser: this.disburser,
        escrow: this.escrow,
        moyasar: this.moyasar,
        zatca: this.zatca,
        notifications: this.notifications,
        email: this.email,
      }),
      ...contentOps(),
      ...agentsOps(),
      // Batch OPS (registry completion) — the groups that closed the census
      // gap: category taxonomy, platform settings, and the support desk.
      ...categoriesOps({ categories: this.categories }),
      ...settingsOps({ settings: this.settings }),
      ...supportOps({ prisma: this.prisma, email: this.email }),
      // Batch OPS-PRO Phase 1 — the last ~17 census operations: money
      // integrity (dispute/revive/backfill/replay/reconcile-siblings),
      // project & user lifecycle, procurement oversight, and maintenance.
      ...integrityOps({ prisma: this.prisma, webhook: this.webhook, ledger: this.ledger }),
      ...projectsLifecycleOps({
        prisma: this.prisma,
        escrow: this.escrow,
        notifications: this.notifications,
        email: this.email,
      }),
      ...procurementOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
      }),
      ...milestonesOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
      }),
      ...maintenanceOps({ prisma: this.prisma, notifications: this.notifications }),
      // OPS-GAPS R1 — appeals (four-eyes moderation review).
      ...appealsOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
      }),
      // OPS-GAPS Y2 — email-template management (edit/reset/test-send).
      ...commsOps({ prisma: this.prisma, email: this.email }),
    ];
    for (const def of defs) this.registry.register(def);
  }
}
