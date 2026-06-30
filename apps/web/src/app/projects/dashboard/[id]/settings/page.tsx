import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function SettingsPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="الإعدادات"
      intro="بيانات الحملة الأساسية، الهدف، عتبة الإفراج، والمظهر."
      bullets={[
        'العنوان والوصف المختصر والتصنيف',
        'هدف التمويل وعتبة الإفراج (٪ القاعدة الأساسية ٨٠٪)',
        'الموعد النهائي ومدّة الحملة',
        'الصورة الرئيسية (Hero)',
        'الرؤية (مسوّدة / قيد المراجعة / منشور)',
      ]}
    />
  );
}
