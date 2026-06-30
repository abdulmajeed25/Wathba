import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function MilestonesPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="المراحل والشفافية"
      intro="عرّف مراحل المشروع، ارفع الإثباتات، وراقب صرف الضمان والمصاريف."
      bullets={[
        'تعريف المراحل ونسب الإفراج',
        'رفع الإثبات لكل مرحلة',
        'سجل الصرف الشفّاف (Spend Log)',
        'نسبة الإفراج المتراكمة',
      ]}
    />
  );
}
