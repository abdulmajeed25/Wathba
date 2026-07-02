import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { PayoutBeneficiaryService } from './payout-beneficiary.service';
import { UpsertBeneficiaryDto } from './dto/payout-beneficiary.dto';

/** Creator payout beneficiary (Sprint 5 / #7). */
@ApiTags('payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payouts/beneficiary')
export class PayoutBeneficiaryController {
  constructor(private readonly svc: PayoutBeneficiaryService) {}

  @Get()
  @ApiOperation({ summary: 'My payout beneficiary (masked IBAN)' })
  async mine(@CurrentUser() jwt: JwtPayload) {
    return { beneficiary: await this.svc.getPublic(jwt.sub) };
  }

  @Put()
  @ApiOperation({ summary: 'Set/replace my payout beneficiary (bank IBAN or wallet)' })
  async upsert(@CurrentUser() jwt: JwtPayload, @Body() dto: UpsertBeneficiaryDto) {
    return this.svc.upsert(jwt.sub, dto);
  }
}
