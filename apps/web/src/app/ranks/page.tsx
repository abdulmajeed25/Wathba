import { Award, User as UserIcon, ThumbsUp, BadgeCheck, Crown, CheckCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Pill } from '@/components/Pill';
import { ButtonLink } from '@/components/Button';
import { ranks } from '@/data/mock';

const RANK_ICON: Record<string, React.ComponentType<{ className?: string; fill?: string }>> = {
  user: UserIcon, 'thumbs-up': ThumbsUp, 'badge-check': BadgeCheck, award: Award, crown: Crown,
};

export default function RanksPage() {
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-(--container-card) px-[26px] pt-[54px] text-center">
          <div className="mb-[18px] inline-block">
            <Pill tone="gold"><Award className="h-[17px] w-[17px]" fill="currentColor" /> نظام رتب الداعمين</Pill>
          </div>
          <h1 className="mb-[14px] text-[46px] font-bold tracking-[-1.2px]">
            كلما دعمت أكثر،
            <br />
            <span className="gradtext">ارتقت مكانتك</span>
          </h1>
          <p className="mx-auto max-w-[560px] text-[17px] text-text-soft">
            على وثبة، دعمك ليس مجرد تبرّع — إنه رحلة. كل مشروع تدعمه يقرّبك من رتبة أعلى ومزايا
            حصرية تليق بشغفك.
          </p>
        </section>

        <section className="mx-auto mt-[48px] max-w-(--container-card) px-[26px] pb-[10px]">
          <div className="grid gap-[14px] md:grid-cols-5">
            {ranks.map((r) => {
              const Icon = RANK_ICON[r.icon] ?? UserIcon;
              return (
                <div
                  key={r.id}
                  className="lift flex flex-col rounded-(--radius-card-lg) border bg-card px-[18px] py-[24px]"
                  style={{ borderColor: r.color + '33' }}
                >
                  <div
                    className="mb-[16px] grid h-[58px] w-[58px] place-items-center rounded-(--radius-card)"
                    style={{ background: r.bg, color: r.color }}
                  >
                    <Icon className="h-[30px] w-[30px]" fill="currentColor" />
                  </div>
                  <div className="mb-[2px] text-[18px] font-bold" style={{ color: r.color }}>{r.ar}</div>
                  <div className="num mb-[10px] text-[10.5px] tracking-[2px] text-muted-2">{r.en}</div>
                  <div
                    className="mb-[16px] w-fit rounded-(--radius-xs) px-[10px] py-[6px] text-[12.5px] text-text-soft"
                    style={{ background: 'rgba(var(--ink-rgb),0.04)' }}
                  >
                    {r.req}
                  </div>
                  <div
                    className="flex flex-col gap-[10px] border-t pt-[14px]"
                    style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
                  >
                    {r.perks.map((p) => (
                      <div key={p} className="flex gap-[8px] text-[12.5px] leading-[1.5] text-muted">
                        <CheckCircle className="h-[16px] w-[16px] flex-shrink-0" style={{ color: r.color }} />
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-[40px] text-center">
            <ButtonLink href="/explore" size="lg">ابدأ رحلتك — ادعم مشروعاً</ButtonLink>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
