/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { BeneficiaryType } from '@prisma/client';
import { PayoutBeneficiaryService, maskIban, toDestination } from './payout-beneficiary.service';

function auditMock(): any {
  return { log: jest.fn().mockResolvedValue(undefined) };
}
function makePrisma(over: Record<string, any> = {}): any {
  return {
    payoutBeneficiary: {
      upsert: jest.fn().mockResolvedValue({
        id: 'b1', type: 'BANK_ACCOUNT', iban: 'SA0380000000608010167519',
        name: 'سارة', mobile: '0555000000', country: 'SA', city: 'الرياض',
        moyasarAccountId: null, updatedAt: new Date(),
      }),
      findUnique: jest.fn(),
      ...over,
    },
  };
}

describe('maskIban', () => {
  it('masks the middle, keeps first/last 4', () => {
    expect(maskIban('SA0380000000608010167519')).toMatch(/^SA03•+7519$/);
    expect(maskIban(null)).toBeNull();
  });
});

describe('toDestination', () => {
  it('bank → structured object; wallet → mobile only', () => {
    expect(toDestination({ type: 'BANK_ACCOUNT', iban: 'X', name: 'N', mobile: 'M', country: 'SA', city: 'C' } as any))
      .toEqual({ type: 'bank_account', iban: 'X', name: 'N', mobile: 'M', country: 'SA', city: 'C' });
    expect(toDestination({ type: 'WALLET', mobile: 'M' } as any)).toEqual({ type: 'wallet', mobile: 'M' });
  });
});

describe('PayoutBeneficiaryService', () => {
  it('rejects a bank beneficiary with no IBAN', async () => {
    const svc = new PayoutBeneficiaryService(makePrisma(), auditMock());
    await expect(
      svc.upsert('u1', { type: BeneficiaryType.BANK_ACCOUNT, name: 'X', mobile: '0555000000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts + audits + returns masked IBAN', async () => {
    const audit = auditMock();
    const svc = new PayoutBeneficiaryService(makePrisma(), audit);
    const r = await svc.upsert('u1', {
      type: BeneficiaryType.BANK_ACCOUNT, iban: 'SA0380000000608010167519', name: 'سارة', mobile: '0555000000',
    });
    expect(r.masked).toMatch(/^SA03•+7519$/);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payout-beneficiary.upsert', entity: 'PayoutBeneficiary' }),
    );
  });

  it('resolveDestination → null when none on file (payout stays PENDING)', async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const svc = new PayoutBeneficiaryService(prisma, auditMock());
    expect(await svc.resolveDestination('u1')).toBeNull();
  });

  it('resolveDestination → Moyasar destination when present', async () => {
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        type: 'BANK_ACCOUNT', iban: 'SA0380000000608010167519', name: 'سارة',
        mobile: '0555000000', country: 'SA', city: 'الرياض',
      }),
    });
    const svc = new PayoutBeneficiaryService(prisma, auditMock());
    const dest = await svc.resolveDestination('u1');
    expect(dest).toEqual(expect.objectContaining({ type: 'bank_account', iban: 'SA0380000000608010167519' }));
  });
});
