import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function ContestsPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="علّق واربح"
      intro="أنشئ جولات «علّق واربح» — اختر الجائزة، عدد الفائزين، وأعلن النتائج."
      bullets={[
        'إنشاء جولة جديدة (سؤال + جائزة + عدد فائزين + موعد)',
        'الجائزة من مكافآت/إضافات الحملة أو مخصّصة',
        'اختيار الفائزين بالرقم #1234 (حفاظاً على الخصوصية)',
        'إعلان النتائج → تعليق مثبَّت من المبدع تلقائياً',
        'تتبّع جولات متعدّدة (الجولة 1، 2، 3 …)',
      ]}
    />
  );
}
