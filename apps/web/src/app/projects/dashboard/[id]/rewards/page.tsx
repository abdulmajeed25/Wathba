import { SectionPlaceholder } from '@/components/ventures/wathba/dashboard/wathba-section-placeholder';

export default function RewardsPage(): React.ReactElement {
  return (
    <SectionPlaceholder
      title="المكافآت والإضافات"
      intro="أنشئ وعدّل باقات المكافآت والإضافات الاختيارية لحملتك."
      bullets={[
        'إضافة باقة جديدة + تحديد سعرها وعدد المتبقي',
        'تعليم باقات «مميّزة» / «محدودة»',
        'قائمة «ما يتضمنه» مع صور المنتجات',
        'إعداد الإضافات (Add-ons) الاختيارية القابلة للتكديس',
        'تحديد دول الشحن وموعد التسليم المتوقع',
      ]}
    />
  );
}
