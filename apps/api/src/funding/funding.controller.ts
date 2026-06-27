import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { FundingService } from './funding.service';
import { CreatePledgeDto } from './dto/pledge.dto';

@ApiTags('funding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pledges')
export class FundingController {
  constructor(private readonly funding: FundingService) {}

  @Post()
  @ApiOperation({ summary: 'Pledge to a LIVE project (hold-only authorize)' })
  async pledge(@CurrentUser() jwt: JwtPayload, @Body() dto: CreatePledgeDto) {
    const p = await this.funding.pledge(jwt.sub, dto);
    return this.funding.toPublic(p);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my pledges' })
  async mine(@CurrentUser() jwt: JwtPayload) {
    const items = await this.funding.listMine(jwt.sub);
    return { items: items.map((i) => this.funding.toPublic(i)) };
  }
}
