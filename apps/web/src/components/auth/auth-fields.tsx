'use client';

import { useMemo, useState } from 'react';

/**
 * STAKES/S-5 (A1 A2 A3) — client-side auth field atoms shared by the
 * sign-in / sign-up / reset pages. Server actions still validate everything;
 * these only make failure visible BEFORE submit:
 *  - live (on-blur) Arabic validation messages
 *  - show/hide password toggle
 *  - password strength meter (signup + reset)
 */

const inputCls =
  'rounded-lg border bg-elevated px-3 py-2 text-sm focus:border-brand focus:outline-none w-full';

export function LiveEmailField({ label = 'البريد الإلكتروني' }: { label?: string }) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = touched && value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        dir="ltr"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid || undefined}
        className={`${inputCls} ${invalid ? 'border-err' : 'border-edge-strong'}`}
      />
      {invalid && (
        <span role="alert" className="text-xs text-err">
          صيغة البريد الإلكتروني غير صحيحة.
        </span>
      )}
    </label>
  );
}

export function LiveNameField() {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = touched && value.trim().length > 0 && value.trim().length < 2;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">الاسم</span>
      <input
        type="text"
        name="name"
        required
        minLength={2}
        maxLength={80}
        autoComplete="name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid || undefined}
        className={`${inputCls} ${invalid ? 'border-err' : 'border-edge-strong'}`}
      />
      {invalid && (
        <span role="alert" className="text-xs text-err">
          الاسم يجب أن يتكون من حرفين على الأقل.
        </span>
      )}
    </label>
  );
}

/** 0–4 score: length ≥8 (gate), then ≥12 / case-mix / digit / symbol. */
export function scorePassword(pw: string): number {
  if (pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH: Array<{ label: string; color: string }> = [
  { label: 'قصيرة جداً — ٨ أحرف على الأقل', color: '#dc2626' },
  { label: 'ضعيفة', color: '#dc2626' },
  { label: 'متوسطة', color: '#d97706' },
  { label: 'جيدة', color: '#059669' },
  { label: 'قوية', color: '#047857' },
];

export function PasswordField({
  label = 'كلمة المرور',
  autoComplete = 'current-password',
  withStrength = false,
  hint,
}: {
  label?: string;
  autoComplete?: string;
  withStrength?: boolean;
  hint?: string;
}) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const score = useMemo(() => scorePassword(value), [value]);
  const tooShort = touched && value.length > 0 && value.length < 8;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name="password"
          required
          minLength={8}
          autoComplete={autoComplete}
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={tooShort || undefined}
          className={`${inputCls} pl-10 ${tooShort ? 'border-err' : 'border-edge-strong'}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          aria-pressed={show}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:text-fg"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {withStrength && value.length > 0 && (
        <div aria-live="polite">
          <div className="mt-1 flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{ background: i <= score ? STRENGTH[score]!.color : 'rgba(0,0,0,.10)' }}
              />
            ))}
          </div>
          <span className="mt-0.5 block text-xs" style={{ color: STRENGTH[score]!.color }}>
            {STRENGTH[score]!.label}
          </span>
        </div>
      )}
      {tooShort && !withStrength && (
        <span role="alert" className="text-xs text-err">
          كلمة المرور يجب أن تتكون من ٨ أحرف على الأقل.
        </span>
      )}
      {hint && !tooShort && <span className="text-xs text-fg-muted">{hint}</span>}
    </label>
  );
}

function EyeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
