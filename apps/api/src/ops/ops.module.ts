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

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { FundingService } from '../funding/funding.service';
import { PayoutDisburser } from '../escrow-payments/payout.disburser';
import { EscrowService } from '../escrow-payments/escrow.service';
import { MoyasarAdapter } from '../escrow-payments/moyasar.adapter';
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
  ],
  providers: [
    OperationsRegistry,
    OpsAuthService,
    OpsRbacService,
    OpsProposalsService,
    OpsAuditService,
    OpsAgentsService,
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
    ];
    for (const def of defs) this.registry.register(def);
  }
}
