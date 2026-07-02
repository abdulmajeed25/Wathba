import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import { BeneficiaryType, type PayoutBeneficiary } from '@prisma/client';
import type { PayoutBeneficiary as MoyasarDestination } from './payout.disburser';

export interface UpsertBeneficiaryInput {
  type: BeneficiaryType;
  iban?: string;
  name: string;
  mobile: string;
  city?: string;
}

/**
 * Creator payout beneficiary (Sprint 5 / #7). Stores the Moyasar `destination`
 * for real payouts — one per creator, PDPL-relevant PII. The IBAN is masked
 * on read; changes are audited.
 */
@Injectable()
export class PayoutBeneficiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsert(userId: string, input: UpsertBeneficiaryInput): Promise<{ masked: string | null }> {
    if (input.type === BeneficiaryType.BANK_ACCOUNT && !input.iban) {
      throw new BadRequestException('IBAN is required for a bank-account beneficiary');
    }
    const row = await this.prisma.payoutBeneficiary.upsert({
      where: { userId },
      create: {
        userId,
        type: input.type,
        iban: input.iban ?? null,
        name: input.name,
        mobile: input.mobile,
        city: input.city ?? null,
        // Registration as a Moyasar payout account is credential-gated (#4);
        // stored NULL until that step runs.
        moyasarAccountId: null,
      },
      update: {
        type: input.type,
        iban: input.iban ?? null,
        name: input.name,
        mobile: input.mobile,
        city: input.city ?? null,
        moyasarAccountId: null, // details changed → re-register before paying
        verifiedAt: null,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'payout-beneficiary.upsert',
      entity: 'PayoutBeneficiary',
      entityId: row.id,
      detail: { type: row.type, ibanMasked: maskIban(row.iban) },
    });
    return { masked: maskIban(row.iban) };
  }

  /** Masked public view for the creator's own dashboard. */
  async getPublic(userId: string): Promise<Record<string, unknown> | null> {
    const b = await this.prisma.payoutBeneficiary.findUnique({ where: { userId } });
    if (!b) return null;
    return {
      type: b.type,
      name: b.name,
      ibanMasked: maskIban(b.iban),
      mobile: b.mobile,
      city: b.city,
      registered: b.moyasarAccountId != null,
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  /**
   * Resolve the Moyasar `destination` for a disbursement. Returns null when
   * no beneficiary is on file — the disburser then keeps the payout PENDING.
   */
  async resolveDestination(userId: string): Promise<MoyasarDestination | null> {
    const b = await this.prisma.payoutBeneficiary.findUnique({ where: { userId } });
    if (!b) return null;
    return toDestination(b);
  }
}

export function toDestination(b: PayoutBeneficiary): MoyasarDestination {
  if (b.type === BeneficiaryType.WALLET) {
    return { type: 'wallet', mobile: b.mobile };
  }
  return {
    type: 'bank_account',
    iban: b.iban ?? undefined,
    name: b.name,
    mobile: b.mobile,
    country: b.country,
    city: b.city ?? undefined,
  };
}

export function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  const clean = iban.replace(/\s/g, '');
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)}${'•'.repeat(clean.length - 8)}${clean.slice(-4)}`;
}
