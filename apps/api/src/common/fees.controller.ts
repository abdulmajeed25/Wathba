import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { METHOD_FEES } from '../config/fees';

/** Batch PAY (Part 4) — public fee transparency, per payment method. */
@ApiTags('fees')
@Controller('fees')
export class FeesController {
  @Get()
  @ApiOperation({ summary: 'Effective platform + processor fees per payment method (bp + fixed halalas)' })
  fees() {
    return { methods: METHOD_FEES };
  }
}
