import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  const svc = new ContractsService();

  it('symbolic tier → DONATION', () => {
    expect(svc.inferType({ includesPhysicalProduct: false })).toBe('DONATION');
  });

  it('physical-product tier → ISTISNA', () => {
    expect(svc.inferType({ includesPhysicalProduct: true })).toBe('ISTISNA');
  });

  it('renders Arabic terms for every contract type', () => {
    for (const t of ['DONATION', 'ISTISNA', 'SALAM'] as const) {
      const text = svc.renderTerms(t);
      expect(text.length).toBeGreaterThan(30);
      expect(/[؀-ۿ]/.test(text)).toBe(true); // Arabic block
    }
  });
});
