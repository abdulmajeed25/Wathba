'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiAddOn, ApiRewardTier } from '@/lib/api/wathba';

const fmtSAR = (h: number): string => `${(h / 100).toLocaleString('en-US')} ر.س`;

interface TierFormState {
  titleAr: string;
  amountSAR: string;
  descAr: string;
  estDeliveryDate: string;
  limitQty: string;
  featured: boolean;
  includesPhysicalProduct: boolean;
  requiresShipping: boolean;
  shipsTo: string;
  includedItems: Array<{ nameAr: string; qty: string }>;
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
  shipsTo: 'SA',
  includedItems: [{ nameAr: '', qty: '1' }],
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
  const [tab, setTab] = useState<'tiers' | 'addons'>('tiers');
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm);
  const [addOnForm, setAddOnForm] = useState<AddOnFormState>(emptyAddOnForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTier = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        titleAr: tierForm.titleAr,
        amountHalalas: Math.round(Number(tierForm.amountSAR) * 100),
        descAr: tierForm.descAr,
        estDeliveryDate: tierForm.estDeliveryDate,
        featured: tierForm.featured,
        includesPhysicalProduct: tierForm.includesPhysicalProduct,
        requiresShipping: tierForm.requiresShipping,
        shipsTo: tierForm.shipsTo
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length === 2),
        includedItems: tierForm.includedItems
          .filter((it) => it.nameAr.trim().length > 0)
          .map((it) => ({ nameAr: it.nameAr, qty: Number(it.qty) || 1 })),
      };
      if (tierForm.limitQty) data.limitQty = Number(tierForm.limitQty);
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

  const deleteTier = async (tierId: string): Promise<void> => {
    if (!confirm('حذف الباقة؟')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'delete', projectId, tierId }),
      });
      if (!res.ok) throw new Error(`فشل الحذف (${res.status})`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
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
    if (!confirm('حذف الإضافة؟')) return;
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
            color: '#b91c1c',
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
          <div>
            {initialTiers.length === 0 && (
              <EmptyState message="لا توجد باقات بعد — أضف أوّل باقة من النموذج بجانبك." />
            )}
            {initialTiers.map((t) => (
              <TierCard key={t.id} tier={t} onDelete={() => deleteTier(t.id)} />
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
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
  color: 'var(--text-primary, #16201b)',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--brand-primary, #05a661)',
  color: '#fff',
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
        color: active ? '#fff' : 'var(--text-primary, #16201b)',
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
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary, #3b4942)' }}>
        {label}
      </div>
      {children}
    </div>
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
  onDelete,
}: {
  tier: ApiRewardTier;
  onDelete: () => void;
}): React.ReactElement {
  const soldOut = tier.limitQty !== null && tier.claimedQty >= tier.limitQty;
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
          {tier.featured && <Pill label="مميّزة" color="#f59e0b" />}
          {tier.limitQty !== null && (
            <Pill
              label={
                soldOut
                  ? 'نفدت'
                  : `${(tier.limitQty - tier.claimedQty).toLocaleString('en-US')} متبقٍ من ${tier.limitQty}`
              }
              color={soldOut ? '#ef4444' : '#6366f1'}
            />
          )}
        </div>
        <div style={{ fontWeight: 700, color: 'var(--brand-primary, #05a661)' }}>
          {fmtSAR(tier.amountHalalas)}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
        <span>الداعمون: {tier.claimedQty.toLocaleString('en-US')}</span>
        <button type="button" onClick={onDelete} style={{ ...ghostBtnStyle, color: '#b91c1c' }}>
          حذف
        </button>
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={addon.imageUrl}
          alt=""
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
                color={soldOut ? '#ef4444' : '#6366f1'}
              />
            )}
          </div>
          <div style={{ fontWeight: 700, color: 'var(--brand-primary, #05a661)' }}>
            +{fmtSAR(addon.amountHalalas)}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', marginTop: 6 }}>
          {addon.descAr}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
          <span>الإجمالي المُدّعى: {addon.claimedQty.toLocaleString('en-US')}</span>
          <button type="button" onClick={onDelete} style={{ ...ghostBtnStyle, color: '#b91c1c' }}>
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
