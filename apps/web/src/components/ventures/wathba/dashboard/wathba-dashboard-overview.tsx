import type { ApiProjectDetail } from '@/lib/api/wathba';

import { Num } from '../wathba-icons';

const fmtSAR = (halalas: number): string =>
  `${(halalas / 100).toLocaleString('en-US')} ر.س`;

const fmtNum = (n: number): string => n.toLocaleString('en-US');

export function DashboardOverview({
  project,
}: {
  project: ApiProjectDetail | null;
}): React.ReactElement {
  if (!project) {
    return <SectionHeader title="نظرة عامة" subtitle="تعذّر تحميل بيانات المشروع." />;
  }

  const goal = project.fundingGoalHalalas;
  const raised = project.raisedHalalas;
  const pct = goal > 0 ? Math.min(999, Math.round((raised / goal) * 100)) : 0;
  const threshold = Math.round(goal * (project.releaseThresholdPct / 100));
  const toThreshold = Math.max(0, threshold - raised);
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(project.deadline).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <>
      <SectionHeader
        title="نظرة عامة"
        subtitle="ملخّص حيّ لتمويل الحملة، الداعمين، والأيام المتبقية."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Stat label="المبلغ المُجمَع" value={fmtSAR(raised)} accent />
        <Stat label="الهدف" value={fmtSAR(goal)} />
        <Stat label="نسبة الإنجاز" value={`${pct}%`} accent={pct >= 80} />
        <Stat label="الداعمون" value={fmtNum(project.backersCount)} />
        <Stat
          label={`المتبقّي حتى ${project.releaseThresholdPct}%`}
          value={toThreshold === 0 ? '✓ تم التجاوز' : fmtSAR(toThreshold)}
          accent={toThreshold === 0}
        />
        <Stat label="الأيام المتبقية" value={fmtNum(daysLeft)} />
      </div>

      <PanelLink
        href={`/projects/${project.id}`}
        label="عرض الحملة كما يراها الزوّار"
        cta="افتح →"
      />
    </>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): React.ReactElement {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 8 }}>
        {label}
      </div>
      <Num
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? 'var(--brand-primary, #05a661)' : 'var(--text-primary, #16201b)',
        }}
      >
        {value}
      </Num>
    </div>
  );
}

function PanelLink({
  href,
  label,
  cta,
}: {
  href: string;
  label: string;
  cta: string;
}): React.ReactElement {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        textDecoration: 'none',
        color: 'var(--text-primary, #16201b)',
        fontSize: 14,
      }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--brand-primary, #05a661)', fontWeight: 700 }}>{cta}</span>
    </a>
  );
}
