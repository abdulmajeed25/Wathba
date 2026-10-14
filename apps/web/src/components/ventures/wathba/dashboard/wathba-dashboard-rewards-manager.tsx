'use client';

import Image from 'next/image';
import { cloneElement, isValidElement, useId, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiAddOn, ApiRewardTier } from '@/lib/api/wathba';
import { useConfirm, useToast } from '../wathba-feedback';
import { formatSarExact } from '@/lib/i18n/format';

const fmtSAR = (h: number): string => formatSarExact('ar', h / 100);

interface TierFormState {
  titleAr: string;
  amountSAR: string;
  descAr: string;
  estDeliveryDate: string;
  limitQty: string;
  featured: boolean;
  includesPhysicalProduct: boolean;
  requiresShipping: boolean;
  shippingSAR: string;
  shipsTo: string;
  includedItems: Array<{ nameAr: string; qty: string }>;
  // CC-13 — optional time-boxed early-bird price.
  earlyBirdSAR: string;
  earlyBirdUntil: string;
}

const emptyTierForm: TierFormState = {
  titleAr: '',
  amountSAR: '',
  descAr: '',
  estDeliveryDate: '',
  limitQty: '',
  featured: false,
  includesPhysicalProduct: false,
  requiresShipping: false,
  shippingSAR: '',
  shipsTo: 'SA',
  includedItems: [{ nameAr: '', qty: '1' }],
  earlyBirdSAR: '',
  earlyBirdUntil: '',
};

interface AddOnFormState {
  titleAr: string;
  amountSAR: string;
  descAr: string;
  imageUrl: string;
  limitQty: string;
}

const emptyAddOnForm: AddOnFormState = {
  titleAr: '',
  amountSAR: '',
  descAr: '',
  imageUrl: '',
  limitQty: '',
};

export function DashboardRewardsManager({
  projectId,
  initialTiers,
  initialAddOns,
}: {
  projectId: string;
  initialTiers: ApiRewardTier[];
  initialAddOns: ApiAddOn[];
}): React.ReactElement {
  const router = useRouter();
  const confirmDlg = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<'tiers' | 'addons'>('tiers');
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm);
  const [addOnForm, setAddOnForm] = useState<AddOnFormState>(emptyAddOnForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTier = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (tierForm.requiresShipping && tierForm.shippingSAR.trim() === '') {
        throw new Error('حدد تكلفة الشحن؛ أدخل صفرًا إذا كان مشمولًا في السعر.');
      }
      const data: Record<string, unknown> = {
        titleAr: tierForm.titleAr,
        amountHalalas: Math.round(Number(tierForm.amountSAR) * 100),
        descAr: tierForm.descAr,
        estDeliveryDate: tierForm.estDeliveryDate,
        featured: tierForm.featured,
        includesPhysicalProduct: tierForm.includesPhysicalProduct,
        requiresShipping: tierForm.requiresShipping,
        shippingHalalas: tierForm.requiresShipping ? Math.round(Number(tierForm.shippingSAR) * 100) : 0,
        shipsTo: tierForm.shipsTo
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        includedItems: tierForm.includedItems
          .filter((it) => it.nameAr.trim().length > 0)
          .map((it) => ({ nameAr: it.nameAr, qty: Number(it.qty) || 1 })),
      };
      if (tierForm.limitQty) data.limitQty = Number(tierForm.limitQty);
      // CC-13 — early-bird price + deadline (both required together).
      if (tierForm.earlyBirdSAR && tierForm.earlyBirdUntil) {
        data.earlyBirdAmountHalalas = Math.round(Number(tierForm.earlyBirdSAR) * 100);
        data.earlyBirdUntil = new Date(tierForm.earlyBirdUntil).toISOString();
      }
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'create', projectId, data }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 120)}`);
      }
      setTierForm(emptyTierForm);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // CC-13 — close/reopen a tier for new pledges.
  const updateShipping = async (tierId: string, value: string): Promise<void> => {
    setBusy(true); setError(null);
    try {
      if (value.trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('أدخل تكلفة شحن صحيحة أو صفرًا للشحن المشمول.');
      const res = await fetch('/api/rewards', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'update', projectId, tierId, data: { shippingHalalas: Math.round(Number(value) * 100) } }) });
      if (!res.ok) {
        const body = await res.json() as { message?: string | string[] };
        throw new Error(Array.isArray(body.message) ? body.message.join('، ') : body.message ?? 'تعذر حفظ تكلفة الشحن');
      }
      toast('success', 'حُفظت تكلفة الشحن.'); router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const toggleActive = async (tierId: string, next: boolean): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'update', projectId, tierId, data: { isActive: next } }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`تعذّر التحديث (${res.status}): ${body.slice(0, 120)}`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateDestinations = async (tierId: string, value: string): Promise<void> => {
    setBusy(true); setError(null);
    try {
      const shipsTo = [...new Set(value.split(/[,،]/).map(s => s.trim().toUpperCase()).filter(Boolean))];
      if (!shipsTo.length) throw new Error('حدد دولة شحن واحدة على الأقل قبل قبول دعم جديد.');
      const res = await fetch('/api/rewards', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'update', projectId, tierId, data: { shipsTo } }) });
      if (!res.ok) {
        const body = await res.json() as { message?: string | string[] };
        throw new Error(Array.isArray(body.message) ? body.message.join('، ') : body.message ?? 'تعذر حفظ الوجهات');
      }
      toast('success', 'حُفظت وجهات الشحن.'); router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const deleteTier = async (tierId: string): Promise<void> => {
    if (!(await confirmDlg({ title: 'حذف الباقة؟', body: 'لا يمكن التراجع عن الحذف.', confirmLabel: 'حذف', danger: true }))) return;
    
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'delete', projectId, tierId }),
      });
      if (!res.ok) throw new Error(`فشل الحذف (${res.status})`);
      toast('success', 'حُذفت الباقة.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitAddOn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        titleAr: addOnForm.titleAr,
        amountHalalas: Math.round(Number(addOnForm.amountSAR) * 100),
        descAr: addOnForm.descAr,
      };
      if (addOnForm.imageUrl) data.imageUrl = addOnForm.imageUrl;
      if (addOnForm.limitQty) data.limitQty = Number(addOnForm.limitQty);
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'create', projectId, data }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 120)}`);
      }
      setAddOnForm(emptyAddOnForm);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAddOn = async (addOnId: string): Promise<void> => {
    if (!(await confirmDlg({ title: 'حذف الإضافة؟', confirmLabel: 'حذف', danger: true }))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'delete', projectId, addOnId }),
      });
      if (!res.ok) throw new Error(`فشل الحذف (${res.status})`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          المكافآت والإضافات
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          باقات المكافآت تظهر في تبويب «المكافآت» على صفحة الحملة. الإضافات تُكدَّس فوق
          الباقة عند التبرّع.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: 'var(--err-ink)',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <TabBtn active={tab === 'tiers'} onClick={() => setTab('tiers')}>
          باقات المكافآت ({initialTiers.length})
        </TabBtn>
        <TabBtn active={tab === 'addons'} onClick={() => setTab('addons')}>
          الإضافات الاختيارية ({initialAddOns.length})
        </TabBtn>
      </div>

      {tab === 'tiers' && (
        <div className="wathba-dash-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24 }}>
          <div>
            {initialTiers.length === 0 && (
              <EmptyState message="لا توجد باقات بعد — أضف أوّل باقة من النموذج بجانبك." />
            )}
            {initialTiers.map((t) => (
              <TierCard
                key={t.id}
                tier={t}
                busy={busy}
                onShippingChange={(value) => updateShipping(t.id, value)}
                onDestinationsChange={(value) => updateDestinations(t.id, value)}
                onDelete={() => deleteTier(t.id)}
                onToggleActive={() => void toggleActive(t.id, !(t.isActive ?? true))}
              />
            ))}
          </div>
          <FormCard title="باقة جديدة">
            <Field label="العنوان">
              <input
                type="text"
                value={tierForm.titleAr}
                onChange={(e) => setTierForm({ ...tierForm, titleAr: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="السعر (ر.س)">
              <input
                type="number"
                min={1}
                value={tierForm.amountSAR}
                onChange={(e) => setTierForm({ ...tierForm, amountSAR: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="الوصف">
              <textarea
                value={tierForm.descAr}
                onChange={(e) => setTierForm({ ...tierForm, descAr: e.target.value })}
                rows={3}
                style={{ ...inputStyle, fontFamily: 'inherit' }}
              />
            </Field>
            <Field label="تاريخ التسليم المتوقع">
              <input
                type="date"
                value={tierForm.estDeliveryDate}
                onChange={(e) => setTierForm({ ...tierForm, estDeliveryDate: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="عدد محدود (اختياري)">
              <input
                type="number"
                min={1}
                value={tierForm.limitQty}
                onChange={(e) => setTierForm({ ...tierForm, limitQty: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="سعر مبكر (ر.س، اختياري)">
              <input
                type="number"
                min={1}
                value={tierForm.earlyBirdSAR}
                onChange={(e) => setTierForm({ ...tierForm, earlyBirdSAR: e.target.value })}
                style={inputStyle}
                placeholder="أقل من السعر الأساسي"
              />
            </Field>
            <Field label="ينتهي السعر المبكر (اختياري)">
              <input
                type="datetime-local"
                value={tierForm.earlyBirdUntil}
                onChange={(e) => setTierForm({ ...tierForm, earlyBirdUntil: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="دول الشحن (مفصولة بفاصلة)">
              <input
                type="text"
                value={tierForm.shipsTo}
                onChange={(e) => setTierForm({ ...tierForm, shipsTo: e.target.value })}
                style={inputStyle}
                placeholder="SA, AE, KW"
              />
            </Field>
            <Field label="ما يتضمنه">
              {tierForm.includedItems.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    type="text"
                    placeholder="اسم العنصر"
                    value={it.nameAr}
                    onChange={(e) => {
                      const next = [...tierForm.includedItems];
                      next[idx] = { ...next[idx]!, nameAr: e.target.value };
                      setTierForm({ ...tierForm, includedItems: next });
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => {
                      const next = [...tierForm.includedItems];
                      next[idx] = { ...next[idx]!, qty: e.target.value };
                      setTierForm({ ...tierForm, includedItems: next });
                    }}
                    style={{ ...inputStyle, width: 70 }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setTierForm({
                    ...tierForm,
                    includedItems: [...tierForm.includedItems, { nameAr: '', qty: '1' }],
                  })
                }
                style={ghostBtnStyle}
              >
                + إضافة عنصر
              </button>
            </Field>
            <Field label="خيارات">
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={tierForm.featured}
                  onChange={(e) => setTierForm({ ...tierForm, featured: e.target.checked })}
                />
                مميّزة
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={tierForm.includesPhysicalProduct}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, includesPhysicalProduct: e.target.checked })
                  }
                />
                تتضمّن منتجاً مادياً
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={tierForm.requiresShipping}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, requiresShipping: e.target.checked })
                  }
                />
                تتطلّب عنوان شحن
              </label>
            </Field>
            {tierForm.requiresShipping && <Field label="تكلفة الشحن (ريال)">
              <input aria-label="تكلفة الشحن للمكافأة الجديدة" type="number" min="0" step="0.01" value={tierForm.shippingSAR}
                onChange={e => setTierForm({ ...tierForm, shippingSAR: e.target.value })} style={inputStyle} />
              <p style={{ fontSize: 12 }}>تضاف إلى سعر المكافأة وتظهر قبل الدفع. أدخل صفرًا إذا كان الشحن مشمولًا. تطبق حدود الإدارة.</p>
            </Field>}
            <button
              type="button"
              disabled={busy}
              onClick={submitTier}
              style={primaryBtnStyle}
            >
              {busy ? 'جارٍ الحفظ…' : 'إنشاء الباقة'}
            </button>
          </FormCard>
        </div>
      )}

      {tab === 'addons' && (
        <div className="wathba-dash-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24 }}>
          <div>
            {initialAddOns.length === 0 && (
              <EmptyState message="لا توجد إضافات بعد — أنشئ أوّل إضافة من النموذج." />
            )}
            {initialAddOns.map((a) => (
              <AddOnCard key={a.id} addon={a} onDelete={() => deleteAddOn(a.id)} />
            ))}
          </div>
          <FormCard title="إضافة جديدة">
            <Field label="العنوان">
              <input
                type="text"
                value={addOnForm.titleAr}
                onChange={(e) => setAddOnForm({ ...addOnForm, titleAr: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="السعر (ر.س)">
              <input
                type="number"
                min={1}
                value={addOnForm.amountSAR}
                onChange={(e) => setAddOnForm({ ...addOnForm, amountSAR: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="الوصف">
              <textarea
                value={addOnForm.descAr}
                onChange={(e) => setAddOnForm({ ...addOnForm, descAr: e.target.value })}
                rows={3}
                style={{ ...inputStyle, fontFamily: 'inherit' }}
              />
            </Field>
            <Field label="رابط الصورة (اختياري)">
              <input
                type="url"
                value={addOnForm.imageUrl}
                onChange={(e) => setAddOnForm({ ...addOnForm, imageUrl: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="عدد محدود (اختياري)">
              <input
                type="number"
                min={1}
                value={addOnForm.limitQty}
                onChange={(e) => setAddOnForm({ ...addOnForm, limitQty: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <button
              type="button"
              disabled={busy}
              onClick={submitAddOn}
              style={primaryBtnStyle}
            >
              {busy ? 'جارٍ الحفظ…' : 'إنشاء الإضافة'}
            </button>
          </FormCard>
        </div>
      )}
    </>
  );
}

// ─────── Visual atoms ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--bg-elevated, #fff)',
  color: 'var(--text-primary, var(--text-primary))',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--brand-primary, #05a661)',
  color: 'var(--on-brand, #08130d)',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--text-secondary, #3b4942)',
  fontFamily: 'inherit',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  marginBottom: 4,
};

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? 'var(--brand-primary, #05a661)' : 'transparent',
        color: active ? 'var(--on-brand, #08130d)' : 'var(--text-primary, var(--text-primary))',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function FormCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: 'fit-content',
        position: 'sticky',
        top: 24,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  const id = useId();
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary, #3b4942)' };
  if (isValidElement<{ id?: string }>(children) && ['input', 'textarea', 'select'].includes(String(children.type))) {
    const controlId = children.props.id ?? id;
    return <div>
      <label htmlFor={controlId} style={labelStyle}>{label}</label>
      {cloneElement(children, { id: controlId })}
    </div>;
  }
  return (
    <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
      <legend style={labelStyle}>{label}</legend>
      {children}
    </fieldset>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: 32,
        background: 'var(--bg-elevated, #fff)',
        border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
        borderRadius: 12,
        textAlign: 'center',
        color: 'var(--text-secondary, #3b4942)',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

function TierCard({
  tier,
  busy,
  onShippingChange,
  onDestinationsChange,
  onDelete,
  onToggleActive,
}: {
  tier: ApiRewardTier;
  busy: boolean;
  onShippingChange: (value: string) => Promise<void>;
  onDestinationsChange: (value: string) => Promise<void>;
  onDelete: () => void;
  onToggleActive: () => void;
}): React.ReactElement {
  const soldOut = tier.limitQty !== null && tier.claimedQty >= tier.limitQty;
  const closed = tier.isActive === false;
  const hasBackers = tier.claimedQty > 0;
  const [shippingSAR, setShippingSAR] = useState(tier.shippingHalalas == null ? '' : String(tier.shippingHalalas / 100));
  const [destinations, setDestinations] = useState((tier.shipsTo ?? []).join(', '));
  const earlyBird = tier.earlyBirdActive === true;
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{tier.titleAr}</div>
          {tier.featured && <Pill label="مميّزة" color="var(--gold-ink)" />}
          {closed && <Pill label="مغلقة" color="var(--err-ink)" />}
          {earlyBird && <Pill label="سعر مبكر" color="var(--pos-ink)" />}
          {hasBackers && <Pill label="لها داعمون — مقفلة جزئياً" color="var(--purple-ink)" />}
          {tier.limitQty !== null && (
            <Pill
              label={
                soldOut
                  ? 'نفدت'
                  : `${(tier.limitQty - tier.claimedQty).toLocaleString('en-US')} متبقٍ من ${tier.limitQty}`
              }
              color={soldOut ? 'var(--err-ink)' : 'var(--purple-ink)'}
            />
          )}
        </div>
        <div style={{ fontWeight: 700, color: 'var(--brand-ink, var(--pos-ink))', textAlign: 'end' }}>
          {earlyBird && tier.earlyBirdAmountHalalas != null ? (
            <>
              {fmtSAR(tier.earlyBirdAmountHalalas)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary, var(--muted2))', textDecoration: 'line-through', marginInlineStart: 6 }}>
                {fmtSAR(tier.amountHalalas)}
              </span>
            </>
          ) : (
            fmtSAR(tier.amountHalalas)
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', marginTop: 6 }}>
        {tier.descAr}
      </div>
      {tier.includedItems.length > 0 && (
        <ul style={{ margin: '8px 0 0 0', paddingInlineStart: 18, fontSize: 13 }}>
          {tier.includedItems.map((it, idx) => (
            <li key={idx}>
              {it.nameAr}
              {it.qty && it.qty > 1 ? ` × ${it.qty}` : ''}
            </li>
          ))}
        </ul>
      )}
      {tier.requiresShipping && <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.7 }}>وجهات الشحن (رموز الدول، مثل SA, AE)
          <input aria-label={`وجهات شحن ${tier.titleAr}`} value={destinations} disabled={busy}
            onChange={e => setDestinations(e.target.value)} style={inputStyle} dir="ltr" />
        </label>
        <button type="button" disabled={busy} onClick={() => void onDestinationsChange(destinations)} style={{ ...ghostBtnStyle, minHeight: 40, justifySelf: 'start' }}>حفظ وجهات الشحن</button>
        {!tier.shipsTo?.length && <p>لم تُحدد الوجهات؛ يلزم تحديدها لقبول دعم جديد.</p>}
        {hasBackers && <p>يمكن إضافة وجهات؛ سحب وجهة سبق إتاحتها يحتاج اعتماد تغيير الاتفاق.</p>}
        <label style={{ display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.7 }}>تكلفة الشحن (ريال)
          <input aria-label={`تكلفة شحن ${tier.titleAr}`} type="number" min="0" step="0.01" value={shippingSAR}
            disabled={hasBackers || busy} onChange={e => setShippingSAR(e.target.value)} style={inputStyle} />
        </label>
        {hasBackers ? <p>تعديل تكلفة شحن مكافأة لها داعمون يحتاج مسار اعتماد تغيير الاتفاق.</p>
          : <button type="button" disabled={busy} onClick={() => void onShippingChange(shippingSAR)} style={{ ...ghostBtnStyle, minHeight: 40, justifySelf: 'start' }}>حفظ تكلفة الشحن</button>}
        {tier.shippingHalalas == null && <p>التكلفة غير محددة؛ لا يُقبل دعم جديد لهذه المكافأة حتى تحديدها.</p>}
      </div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary, var(--muted2))' }}>
        <span>الداعمون: {tier.claimedQty.toLocaleString('en-US')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onToggleActive} style={{ ...ghostBtnStyle, color: closed ? 'var(--brand-ink, var(--pos-ink))' : 'var(--gold-ink)' }}>
            {closed ? 'إعادة فتح' : 'إغلاق للدعم'}
          </button>
          {!hasBackers && (
            <button type="button" onClick={onDelete} style={{ ...ghostBtnStyle, color: 'var(--err-ink)' }}>
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddOnCard({
  addon,
  onDelete,
}: {
  addon: ApiAddOn;
  onDelete: () => void;
}): React.ReactElement {
  const soldOut = addon.limitQty !== null && addon.claimedQty >= addon.limitQty;
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {addon.imageUrl && (
        <Image
          src={addon.imageUrl}
          alt=""
          width={64}
          height={64}
          style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }}
        />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>{addon.titleAr}</div>
            {addon.limitQty !== null && (
              <Pill
                label={
                  soldOut
                    ? 'نفدت'
                    : `${(addon.limitQty - addon.claimedQty).toLocaleString('en-US')} متبقٍ`
                }
                color={soldOut ? 'var(--err-ink)' : 'var(--purple-ink)'}
              />
            )}
          </div>
          <div style={{ fontWeight: 700, color: 'var(--brand-ink, var(--pos-ink))' }}>
            +{fmtSAR(addon.amountHalalas)}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', marginTop: 6 }}>
          {addon.descAr}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary, var(--muted2))' }}>
          <span>الإجمالي المُدّعى: {addon.claimedQty.toLocaleString('en-US')}</span>
          <button type="button" onClick={onDelete} style={{ ...ghostBtnStyle, color: 'var(--err-ink)' }}>
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 30,
        background: `${color}15`,
        color,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}
