import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { BackersService } from './backers.service';
import {
  BulkRewardStatusDto,
  ExportBackersQueryDto,
  ListBackersQueryDto,
  UpdateRewardStatusDto,
} from './dto/backers.dto';

/**
 * Creator backer roster (Creator-CC / CC-02) + CSV export (CC-03).
 * Owner-gated inside the service. READ-ONLY on money — the only mutation is
 * fulfillment bookkeeping (`rewardStatus`).
 */
@ApiTags('backers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/backers')
export class BackersController {
  constructor(private readonly backers: BackersService) {}

  @Get()
  @ApiOperation({ summary: 'Backer roster (owner only, filter/search, cursor-paginated)' })
  async list(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: ListBackersQueryDto,
  ) {
    return this.backers.list(jwt.sub, projectId, q);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export backer roster as CSV (summary | fulfillment, PDPL-scoped)' })
  async export(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: ExportBackersQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, csv } = await this.backers.exportCsv(jwt.sub, projectId, q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }

  @Post('reward-status/bulk')
  @ApiOperation({ summary: 'Bulk-set fulfillment status (owner only; audited)' })
  async bulk(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: BulkRewardStatusDto,
  ) {
    return this.backers.bulkUpdateRewardStatus(jwt.sub, projectId, dto);
  }

  @Patch(':pledgeId/reward-status')
  @ApiOperation({ summary: 'Set fulfillment status for one pledge (owner only)' })
  async updateOne(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('pledgeId', new ParseUUIDPipe()) pledgeId: string,
    @Body() dto: UpdateRewardStatusDto,
  ) {
    return this.backers.updateRewardStatus(jwt.sub, projectId, pledgeId, dto.rewardStatus);
  }
}
