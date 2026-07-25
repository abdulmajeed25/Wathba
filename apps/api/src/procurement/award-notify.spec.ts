import { notifyAwardOutcome } from './award-notify';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { EmailService } from '../email/email.service';

/**
 * Batch CLOSEOUT C2 — the RFQ award fan-out.
 *
 * OPS-GAPS R2 notified only the winner, so every losing bidder was left in
 * silence with a bid that looked open forever. These tests pin the full
 * fan-out and the two judgement calls inside it:
 *
 *  · a supplier who bid MORE THAN ONCE and won is never also told they lost;
 *  · one failing recipient never costs the others their notice.
 */

const RFQ_ID = 'rfq-1';

function build(bids: Array<{ id: string; supplierId: string }>) {
  const notifications = { create: jest.fn().mockResolvedValue(null) };
  const email = {
    rfqAwarded: jest.fn().mockResolvedValue(undefined),
    rfqDecided: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    rFQ: { findUnique: jest.fn().mockResolvedValue({ project: { titleAr: 'مشروع الطائرة' } }) },
    supplierBid: { findMany: jest.fn().mockResolvedValue(bids) },
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({ email: `${where.id}@supplier.test` }),
      ),
    },
  };
  const deps = {
    prisma: prisma as unknown as PrismaService,
    notifications: notifications as unknown as NotificationsService,
    email: email as unknown as EmailService,
  };
  return { deps, prisma, notifications, email };
}

const kindsSentTo = (notifications: { create: jest.Mock }) =>
  notifications.create.mock.calls.map((c) => [c[0].userId, c[0].kind]);

it('notifies the winner AND every non-winning bidder', async () => {
  const { deps, notifications, email } = build([
    { id: 'bid-win', supplierId: 's-win' },
    { id: 'bid-2', supplierId: 's-2' },
    { id: 'bid-3', supplierId: 's-3' },
  ]);

  const tally = await notifyAwardOutcome(deps, RFQ_ID, 'bid-win');

  expect(tally).toEqual({ winner: 1, others: 2 });
  expect(kindsSentTo(notifications)).toEqual(
    expect.arrayContaining([
      ['s-win', 'RFQ_AWARDED'],
      ['s-2', 'RFQ_DECIDED'],
      ['s-3', 'RFQ_DECIDED'],
    ]),
  );
  expect(email.rfqAwarded).toHaveBeenCalledTimes(1);
  expect(email.rfqDecided).toHaveBeenCalledTimes(2);
});

it('never tells the winner they lost, even with several bids on one RFQ', async () => {
  const { deps, notifications, email } = build([
    { id: 'bid-a', supplierId: 's-win' },
    { id: 'bid-b', supplierId: 's-win' }, // same supplier, losing bid id
    { id: 'bid-c', supplierId: 's-other' },
  ]);

  const tally = await notifyAwardOutcome(deps, RFQ_ID, 'bid-a');

  expect(tally).toEqual({ winner: 1, others: 1 });
  // The winner appears EXACTLY once, and only as the awardee.
  expect(kindsSentTo(notifications).filter(([id]) => id === 's-win')).toEqual([
    ['s-win', 'RFQ_AWARDED'],
  ]);
  expect(email.rfqDecided).toHaveBeenCalledTimes(1);
});

it('deduplicates a losing supplier who submitted multiple bids', async () => {
  const { deps, email } = build([
    { id: 'bid-win', supplierId: 's-win' },
    { id: 'bid-x', supplierId: 's-dup' },
    { id: 'bid-y', supplierId: 's-dup' },
  ]);

  const tally = await notifyAwardOutcome(deps, RFQ_ID, 'bid-win');

  expect(tally).toEqual({ winner: 1, others: 1 });
  expect(email.rfqDecided).toHaveBeenCalledTimes(1);
});

it('one failing recipient does not suppress the others', async () => {
  const { deps, notifications, email } = build([
    { id: 'bid-win', supplierId: 's-win' },
    { id: 'bid-2', supplierId: 's-bad' },
    { id: 'bid-3', supplierId: 's-good' },
  ]);
  (email.rfqDecided as jest.Mock).mockImplementation((to: string) =>
    to.startsWith('s-bad') ? Promise.reject(new Error('smtp down')) : Promise.resolve(undefined),
  );

  const tally = await notifyAwardOutcome(deps, RFQ_ID, 'bid-win');

  // s-bad's email threw, so it is not counted — but s-good still got through
  // and the winner is unaffected.
  expect(tally).toEqual({ winner: 1, others: 1 });
  expect(kindsSentTo(notifications)).toEqual(
    expect.arrayContaining([['s-good', 'RFQ_DECIDED']]),
  );
});

it('never throws — the award has already committed', async () => {
  const { deps, prisma } = build([{ id: 'bid-win', supplierId: 's-win' }]);
  prisma.supplierBid.findMany.mockRejectedValue(new Error('db gone'));

  await expect(notifyAwardOutcome(deps, RFQ_ID, 'bid-win')).resolves.toEqual({
    winner: 0,
    others: 0,
  });
});

it('sends nothing to a winner whose bid is not on the RFQ (no bogus fan-out)', async () => {
  const { deps, notifications, email } = build([{ id: 'bid-2', supplierId: 's-2' }]);

  const tally = await notifyAwardOutcome(deps, RFQ_ID, 'bid-missing');

  // No winner resolved → nobody is congratulated, but the real bidder still
  // learns a decision was made.
  expect(tally).toEqual({ winner: 0, others: 1 });
  expect(email.rfqAwarded).not.toHaveBeenCalled();
  expect(kindsSentTo(notifications)).toEqual([['s-2', 'RFQ_DECIDED']]);
});
