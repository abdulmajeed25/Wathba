import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function CommunityPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="المجتمع"
      intro="إحصاءات الداعمين — جغرافيا وحركة جديد/عائد."
      bullets={[
        'أهم المدن (عدد الداعمين لكل مدينة)',
        'أهم الدول (ISO-3166)',
        'الداعمون الجدد مقابل العائدين',
        'إجمالي الداعمين',
      ]}
    />
  );
}
