'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  deriveProject,
  wathbaPledgeSteps,
  wathbaProjects,
  wathbaTiers,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * Pledge wizard — literal 1:1 port of WATBHوثبة.dc.html lines 716–833.
 * 4 steps: tier → info → payment → success. Sticky order summary on the right.
 */

export function WathbaPledge({
  projectId,
  initialTier = 't2',
}: {
  projectId: string;
  initialTier?: string;
}) {
  const project =
    wathbaProjects.find((p) => p.id === projectId) ?? wathbaProjects[0]!;
  const active = deriveProject(project);
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState(initialTier);

  const selTier = wathbaTiers.find((t) => t.id === tier) ?? wathbaTiers[1]!;
  const total = selTier.price + 8; // + shipping

  return (
    <div className="wathba-fade">
      {/* ───────── header + stepper ───────── */}
      <section
        style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 26px 0' }}
      >
        <Link
          href={`/projects/${active.id}`}
          style={{
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
            textDecoration: 'none',
          }}
        >
          <Icon name="arrow_forward" size={17} />
          عودة للمشروع
        </Link>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-.6px',
            marginBottom: 6,
          }}
        >
          ادعم: {active.titleAr}
        </h1>
        <p
          style={{
            fontSize: 14.5,
            color: 'var(--muted)',
            marginBottom: 30,
          }}
        >
          دعمك مؤمَّن — لن يُخصم أي مبلغ إلا عند نجاح المشروع.
        </p>

        {/* stepper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 36,
          }}
        >
          {wathbaPledgeSteps.map((s, i) => {
            const reached = step >= s.n;
            const isLast = i === wathbaPledgeSteps.length - 1;
            return (
              <div
                key={s.n}
                style={{ display: 'flex', alignItems: 'center', flex: 1 }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <Num
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: reached
                        ? 'var(--grad)'
                        : 'rgba(var(--ink-rgb),.06)',
                      color: reached ? 'var(--on-accent)' : 'var(--muted2)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                      transition: 'all .3s',
                    }}
                  >
                    {s.n}
                  </Num>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: reached ? 'var(--text)' : 'var(--muted2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {!isLast && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: 'rgba(var(--ink-rgb),.1)',
                      margin: '0 14px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── step body + order summary ───────── */}
      <section
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '0 26px 10px',
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: 28,
          alignItems: 'start',
        }}
      >
        <div>
          {/* STEP 1 — choose tier */}
          {step === 1 && (
            <div className="wathba-fade">
              <h2
                style={{ fontSize: 21, fontWeight: 700, marginBottom: 16 }}
              >
                اختر مستوى الدعم
              </h2>
              {wathbaTiers.map((t) => {
                const selected = tier === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    style={{
                      cursor: 'pointer',
                      background: selected
                        ? 'rgba(var(--accent-rgb),.06)'
                        : 'var(--card)',
                      border: `1.5px solid ${
                        selected
                          ? 'var(--accent)'
                          : 'rgba(var(--ink-rgb),.09)'
                      }`,
                      borderRadius: 16,
                      padding: '18px 20px',
                      marginBottom: 13,
                      transition: 'all .25s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 7,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Num
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: 'var(--accent)',
                          }}
                        >
                          ${t.price.toLocaleString('en-US')}
                        </Num>
                        <h4 style={{ fontSize: 16, fontWeight: 700 }}>
                          {t.title}
                        </h4>
                      </div>
                      <Num style={{ fontSize: 12, color: 'var(--muted2)' }}>
                        {t.backers} داعم
                      </Num>
                    </div>
                    <p
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: 'var(--muted)',
                      }}
                    >
                      {t.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 2 — shipping + contact */}
          {step === 2 && (
            <div className="wathba-fade">
              <h2
                style={{ fontSize: 21, fontWeight: 700, marginBottom: 18 }}
              >
                معلومات الشحن والتواصل
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <PledgeField
                  label="الاسم الكامل"
                  placeholder="مثال: سارة العامري"
                />
                <PledgeField
                  label="البريد الإلكتروني"
                  placeholder="you@email.com"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <PledgeField
                  label="العنوان"
                  placeholder="الشارع، المبنى، الشقة"
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 14,
                }}
              >
                <PledgeField label="المدينة" />
                <PledgeField label="الدولة" defaultValue="الإمارات" />
                <PledgeField label="الرمز البريدي" />
              </div>
            </div>
          )}

          {/* STEP 3 — payment */}
          {step === 3 && (
            <div className="wathba-fade">
              <h2
                style={{ fontSize: 21, fontWeight: 700, marginBottom: 18 }}
              >
                طريقة الدفع
              </h2>
              <div style={{ display: 'flex', gap: 11, marginBottom: 20 }}>
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(var(--accent-rgb),.06)',
                    border: '1.5px solid var(--accent)',
                    borderRadius: 13,
                    padding: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="credit_card" size={22} color="var(--accent)" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    بطاقة ائتمان
                  </span>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(var(--ink-rgb),.03)',
                    border: '1px solid rgba(var(--ink-rgb),.1)',
                    borderRadius: 13,
                    padding: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <Icon
                    name="account_balance_wallet"
                    size={22}
                    color="var(--muted)"
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--muted)',
                    }}
                  >
                    محفظة رقمية
                  </span>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    display: 'block',
                    marginBottom: 7,
                  }}
                >
                  رقم البطاقة
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(var(--ink-rgb),.04)',
                    border: '1px solid rgba(var(--ink-rgb),.12)',
                    borderRadius: 11,
                    padding: '0 14px',
                  }}
                >
                  <input
                    defaultValue="4242 4242 4242 4242"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      padding: '12px 0',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: '"Space Grotesk", sans-serif',
                    }}
                  />
                  <Icon name="lock" size={20} color="var(--accent)" />
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                }}
              >
                <PledgeField
                  label="تاريخ الانتهاء"
                  defaultValue="08 / 28"
                  mono
                />
                <PledgeField label="CVC" defaultValue="•••" />
              </div>
              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  fontSize: 12.5,
                  color: 'var(--pos)',
                  background: 'rgba(52,211,153,.06)',
                  border: '1px solid rgba(52,211,153,.18)',
                  borderRadius: 11,
                  padding: '12px 14px',
                }}
              >
                <Icon name="shield" size={18} />
                الدفع مشفّر بالكامل. لن يُخصم المبلغ إلا عند نجاح المشروع.
              </div>
            </div>
          )}

          {/* STEP 4 — success */}
          {step === 4 && (
            <div
              className="wathba-fade"
              style={{ textAlign: 'center', padding: '24px 0' }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'var(--grad)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 24px',
                  boxShadow: '0 0 50px -10px rgba(var(--accent-rgb),.6)',
                  animation: 'wathba-pulsering 2.5s infinite',
                }}
              >
                <Icon name="check" size={48} fill color="var(--on-accent)" />
              </div>
              <h2
                style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}
              >
                شكراً لدعمك! 🎉
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--text-soft)',
                  maxWidth: 440,
                  margin: '0 auto 22px',
                }}
              >
                أصبحت الآن داعماً لـ«{active.titleAr}». سنوافيك بكل التحديثات
                على بريدك.
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(251,191,36,.1)',
                  border: '1px solid rgba(251,191,36,.3)',
                  borderRadius: 14,
                  padding: '14px 22px',
                  marginBottom: 28,
                }}
              >
                <Icon
                  name="workspace_premium"
                  size={26}
                  fill
                  color="var(--gold)"
                />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    ارتقت رتبتك إلى
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: 'var(--gold)',
                    }}
                  >
                    {selTier.rank}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                <Link
                  href="/projects/me/profile"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--grad)',
                    color: 'var(--on-accent)',
                    fontWeight: 700,
                    fontSize: 15,
                    padding: '13px 24px',
                    borderRadius: 13,
                    textDecoration: 'none',
                  }}
                >
                  ملفي الشخصي
                </Link>
                <Link
                  href="/projects/discover"
                  style={{
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(var(--ink-rgb),.16)',
                    color: 'var(--text)',
                    fontWeight: 600,
                    fontSize: 15,
                    padding: '13px 24px',
                    borderRadius: 13,
                    textDecoration: 'none',
                  }}
                >
                  استكشف المزيد
                </Link>
              </div>
            </div>
          )}

          {/* nav buttons (hidden on success) */}
          {step < 4 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  style={{
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(var(--ink-rgb),.16)',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    fontSize: 15,
                    padding: '14px 24px',
                    borderRadius: 13,
                    fontFamily: 'inherit',
                  }}
                >
                  رجوع
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                style={{
                  flex: 1,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--grad)',
                  color: 'var(--on-accent)',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: 14,
                  borderRadius: 13,
                  fontFamily: 'inherit',
                }}
              >
                {step === 3 ? 'تأكيد الدعم' : 'متابعة'}
              </button>
            </div>
          )}
        </div>

        {/* ───────── order summary ───────── */}
        <div
          style={{
            position: 'sticky',
            top: 90,
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.09)',
            borderRadius: 18,
            padding: 22,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            ملخص الدعم
          </div>
          <div
            className="wathba-ph"
            style={{
              height: 120,
              borderRadius: 13,
              marginBottom: 16,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>
                [ {active.cat} ]
              </Num>
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {active.titleAr}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--muted2)',
              marginBottom: 18,
            }}
          >
            بواسطة {active.creator}
          </div>
          <div
            style={{
              borderTop: '1px solid rgba(var(--ink-rgb),.08)',
              paddingTop: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                marginBottom: 11,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>{selTier.title}</span>
              <Num style={{ fontWeight: 600 }}>
                ${selTier.price.toLocaleString('en-US')}
              </Num>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                marginBottom: 11,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>الشحن</span>
              <Num style={{ fontWeight: 600 }}>$8</Num>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 18,
                fontWeight: 700,
                borderTop: '1px solid rgba(var(--ink-rgb),.08)',
                paddingTop: 14,
                marginTop: 4,
              }}
            >
              <span>الإجمالي</span>
              <Num style={{ color: 'var(--accent)' }}>
                ${total.toLocaleString('en-US')}
              </Num>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              color: 'var(--muted2)',
              background: 'rgba(251,191,36,.06)',
              border: '1px solid rgba(251,191,36,.18)',
              borderRadius: 11,
              padding: '10px 12px',
            }}
          >
            <Icon name="workspace_premium" size={16} color="var(--gold)" />
            هذا الدعم يمنحك رتبة «{selTier.rank}»
          </div>
        </div>
      </section>
    </div>
  );
}

function PledgeField({
  label,
  placeholder,
  defaultValue,
  mono = false,
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          display: 'block',
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      <input
        placeholder={placeholder}
        defaultValue={defaultValue}
        style={{
          width: '100%',
          background: 'rgba(var(--ink-rgb),.04)',
          border: '1px solid rgba(var(--ink-rgb),.12)',
          borderRadius: 11,
          padding: '12px 14px',
          color: 'var(--text)',
          fontSize: 14,
          fontFamily: mono ? '"Space Grotesk", sans-serif' : 'inherit',
        }}
      />
    </div>
  );
}
