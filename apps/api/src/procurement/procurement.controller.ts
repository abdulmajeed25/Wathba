import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ProcurementService } from './procurement.service';
import {
  CreateRFQDto,
  ListRFQsQueryDto,
  SubmitBidDto,
} from './dto/procurement.dto';

@ApiTags('procurement')
@Controller()
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  // -- RFQs --------------------------------------------------------------------

  @Get('rfqs')
  @ApiOperation({ summary: 'List RFQs (suppliers browse OPEN; creators see their own)' })
  async list(@Query() q: ListRFQsQueryDto) {
    const items = await this.svc.list(q);
    return { items: items.map((r) => this.svc.toPublicRFQ(r)) };
  }

  @Get('rfqs/:id')
  @ApiOperation({ summary: 'Get RFQ with all bids (sorted by amount asc — reverse auction)' })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    const rfq = await this.svc.findById(id);
    return this.svc.toPublicRFQ(rfq);
  }

  @Post('rfqs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator publishes an RFQ for their project' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: CreateRFQDto) {
    const r = await this.svc.create(jwt.sub, dto);
    return this.svc.toPublicRFQ(r);
  }

  // -- Bids --------------------------------------------------------------------

  @Post('rfqs/:rfqId/bids')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supplier submits a bid on an OPEN RFQ' })
  async submitBid(
    @CurrentUser() jwt: JwtPayload,
    @Param('rfqId', new ParseUUIDPipe()) rfqId: string,
    @Body() dto: SubmitBidDto,
  ) {
    const b = await this.svc.submitBid(jwt.sub, rfqId, dto);
    return this.svc.toPublicBid(b);
  }

  @Delete('bids/:bidId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supplier withdraws their own SUBMITTED bid' })
  async withdraw(
    @CurrentUser() jwt: JwtPayload,
    @Param('bidId', new ParseUUIDPipe()) bidId: string,
  ) {
    return this.svc.withdrawBid(jwt.sub, bidId);
  }

  @Post('rfqs/:rfqId/award/:bidId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator awards an RFQ to one bid (rejects all others)' })
  async award(
    @CurrentUser() jwt: JwtPayload,
    @Param('rfqId', new ParseUUIDPipe()) rfqId: string,
    @Param('bidId', new ParseUUIDPipe()) bidId: string,
  ) {
    const r = await this.svc.award(jwt.sub, rfqId, bidId);
    return this.svc.toPublicRFQ(r);
  }

  // -- Supplier views ---------------------------------------------------------

  @Get('bids/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my (supplier) bids' })
  async myBids(@CurrentUser() jwt: JwtPayload) {
    const items = await this.svc.listMyBids(jwt.sub);
    return { items: items.map((b) => this.svc.toPublicBid(b)) };
  }
}
