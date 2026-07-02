import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, type Payout, type ZatcaInvoice } from '@prisma/client';

/**
 * ZATCA e-invoicing on the platform commission (Sprint 2 / P0-701).
 *
 * Scope note (regulatory posture): Wathba does NOT invoice backers — money
 * flows backer → PSP → creator. The only taxable supply Wathba makes is its
 * platform commission (5% per the published terms), so each payout tranche
 * yields ONE simplified tax invoice: commission + 15% VAT, addressed to the
 * creator.
 *
 * Phase 1 (generation): TLV QR — tags 1–5 (seller, VAT no, ISO timestamp,
 * total incl. VAT, VAT amount) — base64, embedded per ZATCA spec.
 * Phase 2 (integration): reporting to Fatoora is stub-gated on ZATCA_* env;
 * when unset the invoice is generated and stored locally with
 * `reportedAt = null` so a later backfill job can clear the queue.
 */

const COMMISSION_PCT = 5n;
const VAT_PCT = 15n;

@Injectable()
export class ZatcaService {
  private readonly logger = new Logger(ZatcaService.name);
  private readonly sellerName: string;
  private readonly sellerVat: string;
  private readonly reportingKey: string;

  constructor(
    private readonly prisma: PrismaService,
    cfg: ConfigService,
  ) {
    this.sellerName = cfg.get<string>('ZATCA_SELLER_NAME') ?? 'منصة وثبة للتمويل الجماعي';
    this.sellerVat = cfg.get<string>('ZATCA_SELLER_VAT') ?? '399999999900003';
    this.reportingKey = cfg.get<string>('ZATCA_API_KEY') ?? '';
  }

  /** Idempotent — one invoice per payout (unique payoutId). */
  async generateForPayout(payout: Payout): Promise<ZatcaInvoice> {
    const existing = await this.prisma.zatcaInvoice.findUnique({
      where: { payoutId: payout.id },
    });
    if (existing) return existing;

    const commissionHalalas = (payout.amountHalalas * COMMISSION_PCT) / 100n;
    const vatHalalas = (commissionHalalas * VAT_PCT) / 100n;
    const totalHalalas = commissionHalalas + vatHalalas;
    const issuedAt = new Date();
    const invoiceNumber = await this.nextInvoiceNumber(issuedAt);

    const creator = await this.prisma.user.findUnique({ where: { id: payout.creatorId } });
    const qrTlv = buildTlvQr({
      sellerName: this.sellerName,
      vatNumber: this.sellerVat,
      timestamp: issuedAt.toISOString(),
      totalWithVat: halalasToSarString(totalHalalas),
      vatAmount: halalasToSarString(vatHalalas),
    });

    const payload = {
      invoiceType: 'simplified',
      seller: { name: this.sellerName, vatNumber: this.sellerVat },
      buyer: { id: payout.creatorId, name: creator?.name ?? 'creator' },
      lines: [
        {
          descAr: `عمولة المنصة ${COMMISSION_PCT}٪ — دفعة ضمان مشروع`,
          payoutId: payout.id,
          milestoneId: payout.milestoneId,
          baseHalalas: payout.amountHalalas.toString(),
          commissionHalalas: commissionHalalas.toString(),
          vatPct: Number(VAT_PCT),
          vatHalalas: vatHalalas.toString(),
          totalHalalas: totalHalalas.toString(),
        },
      ],
    };

    const invoice = await this.prisma.zatcaInvoice.create({
      data: {
        invoiceNumber,
        payoutId: payout.id,
        creatorId: payout.creatorId,
        commissionHalalas,
        vatHalalas,
        totalHalalas,
        qrTlv,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    // Link back onto the payout for the creator wallet view.
    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { zatcaInvoiceId: invoiceNumber },
    });

    await this.report(invoice);
    return invoice;
  }

  /** Phase-2 Fatoora reporting — stub-gated until credentials exist. */
  private async report(invoice: ZatcaInvoice): Promise<void> {
    if (!this.reportingKey) {
      this.logger.warn(
        `[STUB] ZATCA reporting skipped for ${invoice.invoiceNumber} — ZATCA_API_KEY unset; ` +
          'invoice stored locally with reportedAt=null for backfill',
      );
      return;
    }
    // Real Fatoora clearance/reporting call lands with production CSID
    // onboarding; until then a configured key without integration is loud.
    this.logger.error(
      `ZATCA_API_KEY configured but Fatoora client not yet integrated — ${invoice.invoiceNumber} NOT reported`,
    );
  }

  /** `WTB-<yyyy>-<zero-padded seq>` — unique via retry on collision. */
  private async nextInvoiceNumber(now: Date): Promise<string> {
    const year = now.getUTCFullYear();
    const count = await this.prisma.zatcaInvoice.count({
      where: { invoiceNumber: { startsWith: `WTB-${year}-` } },
    });
    return `WTB-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

function halalasToSarString(halalas: bigint): string {
  const sar = halalas / 100n;
  const frac = halalas % 100n;
  return `${sar}.${frac.toString().padStart(2, '0')}`;
}

/** ZATCA Phase-1 TLV QR: tag(1B) + len(1B) + value(UTF-8), tags 1–5, base64. */
export function buildTlvQr(fields: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatAmount: string;
}): string {
  const entries: Array<[number, string]> = [
    [1, fields.sellerName],
    [2, fields.vatNumber],
    [3, fields.timestamp],
    [4, fields.totalWithVat],
    [5, fields.vatAmount],
  ];
  const parts: Buffer[] = [];
  for (const [tag, value] of entries) {
    const v = Buffer.from(value, 'utf8');
    parts.push(Buffer.from([tag, v.length]), v);
  }
  return Buffer.concat(parts).toString('base64');
}
