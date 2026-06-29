import { z } from 'zod';

/**
 * Shared zod schemas — used by RHF resolvers in the supplier/nafath/
 * settings forms and also accepted by future server-action validation.
 */

export const supplierBidSchema = z.object({
  rfqId: z.string().min(1, 'اختر طلباً'),
  amount: z
    .coerce.number({ message: 'أدخل قيمة رقمية' })
    .min(1, 'أدخل قيمة أكبر من صفر')
    .max(10_000_000, 'القيمة مرتفعة جداً'),
  leadTimeDays: z
    .coerce.number({ message: 'أدخل عدد أيام' })
    .int('عدد أيام صحيح فقط')
    .min(1, 'يوم واحد على الأقل')
    .max(365, 'حتى ٣٦٥ يوماً'),
  compliancePct: z
    .coerce.number({ message: 'أدخل نسبة' })
    .min(0, '٠٪ كحد أدنى')
    .max(100, '١٠٠٪ كحد أعلى'),
});
export type SupplierBidInput = z.infer<typeof supplierBidSchema>;

export const nafathSchema = z.object({
  nationalId: z
    .string()
    .regex(/^\d{10}$/, 'رقم الهوية يجب أن يتكون من ١٠ أرقام بالضبط'),
});
export type NafathInput = z.infer<typeof nafathSchema>;

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'الاسم على الأقل حرفان')
    .max(80, 'حتى ٨٠ حرفاً'),
  phone: z
    .string()
    .regex(/^\+?\d{8,15}$/, 'صيغة الجوال غير صحيحة (+9665XXXXXXXX)')
    .or(z.literal('')),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
