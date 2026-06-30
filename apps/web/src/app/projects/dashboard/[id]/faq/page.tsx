import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function FaqPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="الأسئلة الشائعة"
      intro="حرّر بنك الأسئلة الشائعة، وأجب على أسئلة الداعمين الواردة."
      bullets={[
        'إضافة/تعديل/إعادة ترتيب الأسئلة الشائعة',
        'الإجابة على أسئلة جديدة وردت من الداعمين (سؤال جديد → بند FAQ)',
        'تمييز السؤال كـ«مخفي» (لا يظهر للجمهور)',
      ]}
    />
  );
}
