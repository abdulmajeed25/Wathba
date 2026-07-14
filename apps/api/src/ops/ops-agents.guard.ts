import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { OpsAuthService, type OpsPrincipal } from './ops-auth.service';
import { OpsAgentsService, type AgentPrincipal } from './ops-agents.service';

/**
 * OPS Part 4 — the operations surface accepts TWO principals:
 *  · x-ops-token  → a human ops session (Part 1, unchanged)
 *  · x-agent-token → an AgentAccount service token (kill-switch-gated,
 *    expiring, rate-limited — all enforced in OpsAgentsService.resolve)
 *
 * ONLY /v1/ops/operations/* mounts this guard. Auth, proposals decisioning
 * and the audit browser stay behind the human-only OpsSessionGuard — an
 * agent can never approve, never read the audit feed, never mint tokens.
 */
@Injectable()
export class OpsOperationsGuard implements CanActivate {
  constructor(
    private readonly opsAuth: OpsAuthService,
    private readonly agents: OpsAgentsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { opsPrincipal?: OpsPrincipal; agentPrincipal?: AgentPrincipal }>();
    const human = req.header('x-ops-token');
    if (human) {
      req.opsPrincipal = await this.opsAuth.resolve(human);
      return true;
    }
    const agent = req.header('x-agent-token');
    if (agent) {
      req.agentPrincipal = await this.agents.resolve(agent);
      return true;
    }
    throw new UnauthorizedException('مطلوب جلسة عمليات (بشري) أو رمز وكيل صالح');
  }
}
