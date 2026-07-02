/**
 * Client-side Moyasar tokenization (Sprint 1 / P0-305).
 *
 * Card data goes browser → Moyasar Tokens API directly, authenticated with
 * the PUBLISHABLE key. Wathba servers only ever see the resulting token
 * (`dto.source` on POST /v1/pledges) — raw PAN/CVC never touches us, which
 * is what keeps PCI scope at SAQ-A.
 *
 * When NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY is unset (local/dev), we mint a
 * deterministic stub token instead so the full pledge → hold → settle
 * pipeline still runs against the API's MoyasarAdapter stub.
 */

export interface CardInput {
  name: string;
  /** Digits, spaces allowed — normalised before sending. */
  number: string;
  /** MM, 1–12 */
  month: string;
  /** YY or YYYY */
  year: string;
  cvc: string;
}

export type TokenResult = { token: string } | { error: string };

const MOYASAR_TOKENS_URL = 'https://api.moyasar.com/v1/tokens';

export function publishableKey(): string {
  return process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY ?? '';
}

export async function createCardToken(card: CardInput): Promise<TokenResult> {
  const pk = publishableKey();
  if (!pk) {
    // Dev / stub mode — mirrors the API-side [STUB] adapter.
    const rand = Math.random().toString(36).slice(2, 10);
    return { token: `tok_stub_${rand}` };
  }
  try {
    const res = await fetch(MOYASAR_TOKENS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${btoa(`${pk}:`)}`,
      },
      body: JSON.stringify({
        name: card.name,
        number: card.number.replace(/[\s-]/g, ''),
        month: card.month,
        year: card.year.length === 2 ? `20${card.year}` : card.year,
        cvc: card.cvc,
        save_only: true,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json['id'] !== 'string') {
      const msg =
        typeof json['message'] === 'string' ? json['message'] : 'tokenization failed';
      return { error: msg };
    }
    return { token: json['id'] };
  } catch {
    return { error: 'network error while tokenizing card' };
  }
}
