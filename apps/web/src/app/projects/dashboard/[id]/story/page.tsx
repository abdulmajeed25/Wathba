import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function StoryPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="القصة"
      intro="حرّر قصة الحملة بمحرّر بلوكات: عناوين، صور، فيديوهات يوتيوب، قوائم."
      bullets={[
        'عناوين رئيسية (تُولِّد جدول محتويات تلقائياً)',
        'تضمين فيديوهات يوتيوب',
        'صور + معارض',
        'قوائم نقطية ومرقّمة',
      ]}
    />
  );
}
