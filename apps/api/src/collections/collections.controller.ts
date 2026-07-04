import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';

/** Batch DISC — public curated-collection reader (حملات وثبة). */
@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Active collections (menu=1 for discover-menu ones only)' })
  async list(@Query('menu') menu?: string) {
    return this.collections.listActive(menu === '1' || menu === 'true');
  }
}
