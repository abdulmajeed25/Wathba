import { createHash } from 'node:crypto';
import { CreatePledgeDto } from './dto/pledge.dto';

/** Transient tokens are excluded: replay with a new token still cannot authorize again. */
export function pledgeRequestHash(dto: CreatePledgeDto): string {
  const s = dto.shipping;
  return createHash('sha256').update(JSON.stringify({
    projectId: dto.projectId, tierId: dto.tierId ?? null,
    amountHalalas: dto.amountHalalas, paymentMethod: dto.paymentMethod ?? 'CARD',
    shippingHalalas: dto.shippingHalalas ?? 0,
    contractType: dto.contractType ?? null,
    shipping: s ? [s.name, s.address, s.city, s.country, s.postal] : null,
    addOns: (dto.addOns ?? []).map(a => [a.addOnId, a.qty ?? 1])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  })).digest('hex');
}
