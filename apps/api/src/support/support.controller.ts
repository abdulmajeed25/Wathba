import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';

/**
 * STAKES/S-15 (H4) — «اتصل بنا» finally DELIVERS: the ticket is stored
 * (auditable) and forwarded to the support inbox. Anonymous-friendly
 * (optional auth attaches the userId when present), tightly throttled.
 */

const TOPICS = ['support', 'billing', 'report', 'partnership', 'other'];

class CreateTicketDto {
  @ApiProperty({ example: 'سارة العامري' })
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'sara@example.sa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: TOPICS })
  @IsIn(TOPICS)
  topic!: string;

  @ApiProperty()
  @IsString() @MinLength(10) @MaxLength(4000)
  messageAr!: string;
}

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'STAKES/S-15 H4 — submit a contact/support request (stored + emailed)' })
  async create(
    @CurrentUser() jwt: JwtPayload | null,
    @Body() dto: CreateTicketDto,
  ): Promise<{ ok: true; ticketId: string }> {
    const row = await this.prisma.supportTicket.create({
      data: {
        userId: jwt?.sub ?? null,
        name: dto.name,
        email: dto.email.toLowerCase(),
        topic: dto.topic,
        messageAr: dto.messageAr,
      },
    });
    // Forward to the inbox humans actually read (best-effort, never blocks).
    void this.email
      .deliver(process.env.SUPPORT_INBOX ?? 'support@wathba.sa', {
        subject: `[تذكرة ${dto.topic}] من ${dto.name} <${dto.email}>`,
        html: `<div dir="rtl"><p><strong>${dto.name}</strong> (${dto.email})${jwt?.sub ? ` · user ${jwt.sub}` : ''}</p><p style="white-space:pre-wrap">${dto.messageAr.replace(/</g, '&lt;')}</p><p>ticket: ${row.id}</p></div>`,
      })
      .catch(() => undefined);
    return { ok: true, ticketId: row.id };
  }
}
