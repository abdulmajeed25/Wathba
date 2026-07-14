import { Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { FundingModule } from '../funding/funding.module';
import { EscrowPaymentsModule } from '../escrow-payments/escrow-payments.module';

import { OperationsRegistry } from './operations.registry';
import { OpsController } from './ops.controller';
import { OpsAuthService } from './ops-auth.service';
import { OpsAuthController } from './ops-auth.controller';
import { OpsRbacService } from './ops-rbac.service';
import { OpsProposalsService } from './ops-proposals.service';
import { OpsProposalsController } from './ops-proposals.controller';
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';
import { projectsOps } from './operations/projects.ops';
import { moderationOps } from './operations/moderation.ops';
import { usersOps } from './operations/users.ops';
import { moneyOps } from './operations/money.ops';
import { contentOps } from './operations/content.ops';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { FundingService } from '../funding/funding.service';
import { PayoutDisburser } from '../escrow-payments/payout.disburser';

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
  ],
  controllers: [OpsController, OpsAuthController, OpsProposalsController],
  providers: [
    OperationsRegistry,
    OpsAuthService,
    OpsRbacService,
    OpsProposalsService,
    OpsSessionGuard,
    OpsIpAllowlistGuard,
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
    private readonly rbac: OpsRbacService,
  ) {}

  onModuleInit(): void {
    // Part 2 — swap the fail-safe default ports for the live RBAC matrix
    // and the four-eyes switch (auto-on at the 2nd money admin).
    this.registry.permissionPort = this.rbac;
    this.registry.fourEyesPort = this.rbac;
    const defs = [
      ...projectsOps({
        prisma: this.prisma,
        notifications: this.notifications,
        email: this.email,
      }),
      ...moderationOps(),
      ...usersOps(),
      ...moneyOps({
        prisma: this.prisma,
        funding: this.funding,
        disburser: this.disburser,
        notifications: this.notifications,
        email: this.email,
      }),
      ...contentOps(),
    ];
    for (const def of defs) this.registry.register(def);
  }
}
