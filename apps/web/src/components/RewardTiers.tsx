import Link from 'next/link';
import { CheckCircle, Gift } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Card } from './Card';

interface Tier {
  id: string;
  amountHalalas: number;
  titleAr: string;
  descAr: string;
  estDelivery: string;
  popular?: boolean;
  backers: number;
  limitQty?: number;
  claimedQty: number;
  items: string[];
}

const SAMPLE_TIERS = (projectId: string): Tier[] => [
  {
    id: `${projectId}-t1`, amountHalalas: 75 * 100,
    titleAr: 'الداعم الأول',
    descAr: 'شكر شخصي من المبدع + تحديثات داخلية حصرية طوال فترة التطوير.',
    estDelivery: 'أبريل ٢٠٢٦', backers: 412, claimedQty: 412,
    items: ['شارة "داعم مبكر" على ملفك', 'وصول حصري للتحديثات', 'دعوة لمجموعة الواتساب الخاصة'],
  },
  {
    id: `${projectId}-t2`, amountHalalas: 750 * 100,
    titleAr: 'الإصدار المبكر',
    descAr: 'احصل على المنتج بسعر مخفّض ٢٥٪، وكُن من أوائل من يجرّبه.',
    estDelivery: 'يونيو ٢٠٢٦', backers: 1840, claimedQty: 1840, limitQty: 2500, popular: true,
    items: ['وحدة من المنتج النهائي', 'شحن مجاني داخل الخليج', 'كل مزايا الرتب السابقة'],
  },
  {
    id: `${projectId}-t3`, amountHalalas: 2_400 * 100,
    titleAr: 'حزمة الاستوديو',
    descAr: 'حزمة احترافية كاملة + ملحقات حصرية للمحترفين والمصورين.',
    estDelivery: 'يوليو ٢٠٢٦', backers: 312, claimedQty: 312, limitQty: 500,
    items: ['وحدتان من المنتج + الملحقات', 'تجربة استوديو حصرية', 'دعم فني مباشر لمدة عام'],
  },
  {
    id: `${projectId}-t4`, amountHalalas: 7_500 * 100,
    titleAr: 'الراعي الذهبي',
    descAr: 'كن جزءاً من رحلة المشروع — اسمك على المنتج وعشاء حصري مع الفريق.',
    estDelivery: 'أغسطس ٢٠٢٦', backers: 38, claimedQty: 38, limitQty: 50,
    items: ['كل ما سبق', 'اسمك مطبوع على الوحدة', 'عشاء حصري مع الفريق المؤسس'],
  },
];

export function RewardTiers({ projectId }: { projectId: string }) {
  const tiers = SAMPLE_TIERS(projectId);
  return (
    <div>
      <h3 className="mb-[14px] flex items-center gap-[8px] text-[16px] font-bold">
        <Gift className="h-[20px] w-[20px]" style={{ color: 'var(--gold)' }} />
        اختر مكافأتك
      </h3>
      <div className="space-y-[14px]">
        {tiers.map((t) => (
          <Link key={t.id} href={`/pledge/${projectId}?tier=${t.id}`} className="block">
            <Card radius="card" lift className="relative p-[18px]" >
              {t.popular && (
                <div
                  className="absolute top-[-9px] right-[16px] rounded-(--radius-pill) px-[11px] py-[3px] text-[11px] font-bold"
                  style={{
                    background: 'linear-gradient(135deg,var(--gold),#f59e0b)',
                    color: 'var(--on-accent)',
                  }}
                >
                  الأكثر شعبية
                </div>
              )}
              <div className="mb-[8px] flex items-baseline justify-between">
                <span className="num text-[22px] font-bold" style={{ color: 'var(--accent)' }}>
                  {(t.amountHalalas / 100).toLocaleString('en-US')} ر.س
                </span>
                <span className="num text-[12px] text-muted-2">{toArabicDigits(t.backers)} داعم</span>
              </div>
              <h4 className="mb-[7px] text-[16px] font-bold">{t.titleAr}</h4>
              <p className="mb-[13px] text-[13px] leading-[1.6] text-muted">{t.descAr}</p>
              <div className="space-y-[7px] border-t pt-[12px]" style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}>
                {t.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-[8px] text-[13px] text-text-soft">
                    <CheckCircle className="h-[16px] w-[16px]" style={{ color: 'var(--pos)' }} />
                    {it}
                  </div>
                ))}
              </div>
              <div
                className="mt-[12px] flex items-center justify-between border-t pt-[12px] text-[11.5px] text-muted-2"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
              >
                <span className="num">التسليم: {t.estDelivery}</span>
                {t.limitQty && (
                  <span className="font-bold" style={{ color: 'var(--gold)' }}>
                    تبقى {toArabicDigits(t.limitQty - t.claimedQty)} وحدة
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
