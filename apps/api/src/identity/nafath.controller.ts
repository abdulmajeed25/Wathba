import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { NafathService } from './nafath.service';
import type { JwtPayload } from './auth.service';

class InitiateNafathDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Saudi national ID must be 10 digits' })
  nationalId!: string;
}

class ConfirmNafathDto {
  @ApiProperty({ example: 'stub-12345' })
  @IsString()
  transactionId!: string;
}

@ApiTags('nafath')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nafath')
export class NafathController {
  constructor(private readonly nafath: NafathService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate Nafath KYC verification' })
  async initiate(@CurrentUser() jwt: JwtPayload, @Body() dto: InitiateNafathDto) {
    return this.nafath.initiate(jwt.sub, dto.nationalId);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm Nafath transaction (stub auto-approves)' })
  async confirm(@CurrentUser() jwt: JwtPayload, @Body() dto: ConfirmNafathDto) {
    return this.nafath.confirm(jwt.sub, dto.transactionId);
  }
}
