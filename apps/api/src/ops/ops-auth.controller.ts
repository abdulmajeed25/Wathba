import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { OpsAuthService, STEP_UP_WINDOW_MS, type OpsPrincipal } from './ops-auth.service';
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';

class EnterDto {
  @IsString() @MinLength(1) password!: string;
  @IsOptional() @IsString() totp?: string;
}
class StepUpDto {
  @IsString() @MinLength(1) password!: string;
  @IsOptional() @IsString() totp?: string;
}
class TotpSetupDto {
  @IsString() @MinLength(1) password!: string;
}
class TotpConfirmDto {
  @IsString() @MinLength(1) code!: string;
}
class TotpDisableDto {
  @IsString() @MinLength(1) password!: string;
  @IsString() @MinLength(1) code!: string;
}

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

/**
 * OPS Part 1 — the ops-session lifecycle:
 *   POST /v1/ops/auth/enter     «دخول إلى مركز العمليات» (public ADMIN JWT + password [+TOTP])
 *   GET  /v1/ops/auth/session   introspection for the /ops shell
 *   POST /v1/ops/auth/step-up   fresh re-auth → 10-minute MONEY/SENSITIVE window
 *   POST /v1/ops/auth/leave     revoke the ops session
 *   POST /v1/ops/auth/totp/*    setup / confirm (backup codes shown ONCE) / disable
 *
 * Throttled harder than any public route; every failure is an audit row.
 */
@ApiTags('ops-auth')
@UseGuards(OpsIpAllowlistGuard)
@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Controller('ops/auth')
export class OpsAuthController {
  constructor(private readonly opsAuth: OpsAuthService) {}

  @Post('enter')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Explicit entry to the Ops Center — separate short-TTL session' })
  async enter(@CurrentUser() jwt: JwtPayload, @Body() dto: EnterDto, @Ip() ip: string) {
    return this.opsAuth.enter({
      userId: jwt.sub,
      email: jwt.email,
      roles: jwt.roles as unknown as string[],
      password: dto.password,
      totp: dto.totp,
      ip,
    });
  }

  @Get('session')
  @UseGuards(OpsSessionGuard)
  @ApiOperation({ summary: 'Ops-session introspection (roles, step-up freshness, TOTP state)' })
  session(@Req() req: OpsRequest) {
    const p = req.opsPrincipal;
    const stepUpMs = p.session.stepUpAt?.getTime() ?? 0;
    return {
      email: p.email,
      roles: p.roles,
      totpEnabled: p.totpEnabled,
      totpRequired: p.totpRequired,
      totpPending: p.totpRequired && !p.totpEnabled,
      stepUpFresh: Date.now() - stepUpMs <= STEP_UP_WINDOW_MS,
      stepUpAt: p.session.stepUpAt,
      enteredAt: p.session.createdAt,
    };
  }

  @Post('step-up')
  @HttpCode(200)
  @UseGuards(OpsSessionGuard)
  @ApiOperation({ summary: 'Re-authenticate — unlocks MONEY/SENSITIVE for 10 minutes' })
  async stepUp(@Req() req: OpsRequest, @Body() dto: StepUpDto, @Ip() ip: string) {
    const at = await this.opsAuth.stepUp(req.opsPrincipal, dto.password, dto.totp, ip);
    return { stepUpAt: at };
  }

  @Post('leave')
  @HttpCode(200)
  @UseGuards(OpsSessionGuard)
  @ApiOperation({ summary: 'Revoke the ops session' })
  async leave(@Req() req: OpsRequest) {
    await this.opsAuth.leave(req.opsPrincipal);
    return { ok: true };
  }

  @Post('totp/setup')
  @HttpCode(200)
  @UseGuards(OpsSessionGuard)
  @ApiOperation({ summary: 'Begin TOTP enrollment (password-gated) — returns secret + otpauth URI' })
  totpSetup(@Req() req: OpsRequest, @Body() dto: TotpSetupDto) {
    return this.opsAuth.totpSetup(req.opsPrincipal, dto.password);
  }

  @Post('totp/confirm')
  @HttpCode(200)
  @UseGuards(OpsSessionGuard)
  @ApiOperation({ summary: 'Confirm TOTP with a live code — returns the 10 backup codes ONCE' })
  totpConfirm(@Req() req: OpsRequest, @Body() dto: TotpConfirmDto) {
    return this.opsAuth.totpConfirm(req.opsPrincipal, dto.code);
  }

  @Post('totp/disable')
  @HttpCode(200)
  @UseGuards(OpsSessionGuard)
  @ApiOperation({ summary: 'Disable TOTP (refused while OPS_TOTP_REQUIRED=1)' })
  async totpDisable(@Req() req: OpsRequest, @Body() dto: TotpDisableDto) {
    await this.opsAuth.totpDisable(req.opsPrincipal, dto.password, dto.code);
    return { ok: true };
  }
}
