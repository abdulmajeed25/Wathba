import { Injectable } from '@nestjs/common';

export type ContractType = 'DONATION' | 'ISTISNA' | 'SALAM';

const TEMPLATES_AR: Record<ContractType, string> = {
  DONATION:
    'بدعمك لهذا المشروع، أنت تساهم طوعياً في تمويله. مكافأتك (إن وُجدت) هي شكر رمزي من المبدع، وليست منتجاً مضموناً تجارياً.',
  ISTISNA:
    'بدعمك، تطلب من المبدع صناعة المنتج وفق المواصفات المنشورة وتسليمه بحلول التاريخ المحدد. تُحتسب أموالك في حساب ضمان ولا تُحوَّل إلا عند تحقّق المشروع لشروط النجاح.',
  SALAM:
    'تدفع المبلغ مقدّماً لقاء سلعة موصوفة في الذمة تُسلَّم في موعد لاحق. تُحفظ أموالك في حساب ضمان ولا تُحوَّل قبل بلوغ هدف التمويل.',
};

@Injectable()
export class ContractsService {
  /** Physical → ISTISNA, symbolic → DONATION. */
  inferType(opts: { includesPhysicalProduct: boolean }): ContractType {
    return opts.includesPhysicalProduct ? 'ISTISNA' : 'DONATION';
  }

  renderTerms(type: ContractType): string {
    return TEMPLATES_AR[type];
  }
}
