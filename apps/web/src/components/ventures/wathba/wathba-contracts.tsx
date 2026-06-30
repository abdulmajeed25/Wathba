import { Icon } from './wathba-icons';

/**
 * §6 pluggable contracts layer — neutral Arabic templates for the three
 * support-contract types attached to pledges. Mirrors apps/api
 * src/contracts/contracts.service.ts 1:1.
 */

interface ContractCard {
  id: 'DONATION' | 'ISTISNA' | 'SALAM';
  label: string;
  english: string;
  icon: string;
  body: string;
  useWhen: string;
}

const TYPES: ContractCard[] = [
  {
    id: 'DONATION',
    label: 'تبرّع',
    english: 'Donation',
    icon: 'volunteer_activism',
    body:
      'بدعمك لهذا المشروع، أنت تساهم طوعياً في تمويله. مكافأتك (إن وُجدت) هي شكر رمزي من المبدع، ' +
      'وليست منتجاً مضموناً تجارياً.',
    useWhen: 'يُستخدم في المشاريع غير الربحية والرمزية والإبداعية.',
  },
  {
    id: 'ISTISNA',
    label: 'استصناع',
    english: 'Istisna',
    icon: 'package_2',
    body:
      'بدعمك، تطلب من المبدع صناعة المنتج وفق المواصفات المنشورة وتسليمه بحلول التاريخ المحدد. ' +
      'تُحتسب أموالك في حساب ضمان ولا تُحوَّل إلا عند تحقّق المشروع لشروط النجاح.',
    useWhen: 'متوافق مع الشريعة ومناسب للمنتجات الجديدة.',
  },
  {
    id: 'SALAM',
    label: 'سَلَم',
    english: 'Salam',
    icon: 'inventory_2',
    body:
      'تدفع المبلغ مقدّماً لقاء سلعة موصوفة في الذمة تُسلَّم في موعد لاحق. تُحفظ أموالك في حساب ' +
      'ضمان ولا تُحوَّل قبل بلوغ هدف التمويل.',
    useWhen: 'مناسب للمحاصيل والإنتاج المتسلسل.',
  },
];

export function WathbaContracts() {
  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 26px 80px' }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 10 }}>
          شروط عقود الدعم
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-soft)', lineHeight: 1.65, marginBottom: 30 }}>
          كل مشروع يُحدّد نوع العقد المناسب لطبيعته. هذه نظرة كاملة على الأنواع المتاحة في
          وثبة. النسخة الملزمة هي ما يظهر في صفحة الدعم لكل مشروع بحسب نوع العقد المحدد.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {TYPES.map((t) => (
            <article
              key={t.id}
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 18,
                padding: 24,
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(var(--accent-rgb),.10)',
                    color: 'var(--accent)',
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  <Icon name={t.icon} size={24} color="var(--accent)" />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t.label}</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted2)', letterSpacing: 1 }}>{t.english}</span>
                </div>
              </div>
              <p style={{ fontSize: 15.5, color: 'var(--text-soft)', lineHeight: 1.85, marginBottom: 10 }}>
                {t.body}
              </p>
              <p
                style={{
                  fontSize: 13.5,
                  color: 'var(--muted)',
                  padding: 12,
                  background: 'rgba(var(--ink-rgb),.03)',
                  borderRadius: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon name="info" size={16} color="var(--muted)" />
                {t.useWhen}
              </p>
            </article>
          ))}
        </div>

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            gap: 10,
            background: 'rgba(var(--accent-rgb),.05)',
            border: '1px solid rgba(var(--accent-rgb),.20)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <Icon name="shield" size={20} color="var(--accent)" />
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-soft)' }}>
            تخضع كل عقود الدعم لمراجعة شرعية وقانونية مستمرّة. تجد أحدث الإصدارات والتغييرات في
            «سجلّ الإصدارات» داخل لوحة شفافية كل مشروع.
          </p>
        </div>
      </section>
    </div>
  );
}
