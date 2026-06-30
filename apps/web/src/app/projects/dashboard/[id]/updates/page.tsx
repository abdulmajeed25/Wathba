import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function UpdatesPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="التحديثات"
      intro="انشر تحديثات مرقّمة لداعميك (نص، صور، فيديو، استبيانات)."
      bullets={[
        'تأليف تحديث جديد (#1, #2 …)',
        'إضافة نص + صور + فيديو + يوتيوب',
        'إحصاءات: عدد الإعجابات + عدد التعليقات',
        'إخطار جميع الداعمين تلقائياً عند النشر',
      ]}
    />
  );
}
