import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function CommentsPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="التعليقات"
      intro="أدِر تعليقات حملتك — ردّ كمبدع، ثبّت، أو أخفِ المخالفة."
      bullets={[
        'الرد كـ«مبدع» مع شارة مميّزة',
        'تثبيت التعليقات المهمّة (تطفو إلى أعلى القائمة)',
        'إخفاء/الإبلاغ عن المخالفات',
        'فلاتر: المُثبَّت، الجديد، المخفي',
      ]}
    />
  );
}
