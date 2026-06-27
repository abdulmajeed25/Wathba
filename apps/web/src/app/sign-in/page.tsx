'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/v1';
      const res = await fetch(`${base}/auth/signin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept-language': 'ar' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('invalid');
      const data = await res.json();
      sessionStorage.setItem('wathba.token', data.accessToken);
      window.location.href = '/profile';
    } catch {
      setErr('بيانات الدخول غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[480px] px-[26px] pt-[60px] pb-[80px]">
        <Link href="/" className="navlink mb-[22px] inline-flex items-center gap-[6px] text-[13px] text-muted">
          <ArrowRight className="h-[18px] w-[18px]" />الرئيسية
        </Link>
        <h1 className="mb-[8px] text-[32px] font-bold tracking-[-0.6px]">تسجيل الدخول</h1>
        <p className="mb-[26px] text-[14px] text-muted">ادخل بريدك وكلمة السر للوصول لحسابك.</p>

        <Card radius="cardLg" className="p-[28px]">
          <form onSubmit={submit}>
            <Field label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
            <Field label="كلمة السر" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {err && (
              <div
                className="mb-[14px] flex items-center gap-[8px] rounded-(--radius-lg) p-[12px] text-[13px]"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
              >
                <AlertCircle className="h-[18px] w-[18px]" />{err}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btnp w-full rounded-(--radius-brand) py-[15px] text-[16px] font-bold text-on-accent disabled:opacity-60"
              style={{ background: 'var(--grad)' }}
            >
              {loading ? 'جاري الدخول…' : 'دخول'}
            </button>
            <div className="mt-[22px] flex justify-center gap-[5px] text-[14px]">
              <span className="text-muted">ليس لديك حساب؟</span>
              <Link href="/sign-up" className="font-bold" style={{ color: 'var(--accent)' }}>أنشئ حساباً</Link>
            </div>
          </form>
        </Card>
      </main>
      <Footer />
    </>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <div className="mb-[16px]">
      <label className="mb-[8px] block text-[13px] text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-(--radius-pad) border px-[14px] py-[12px] text-[15px]"
        style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
      />
    </div>
  );
}
