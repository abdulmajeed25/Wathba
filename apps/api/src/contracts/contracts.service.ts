import { Injectable } from '@nestjs/common';

export type ContractType = 'DONATION' | 'ISTISNA' | 'SALAM';

/**
 * Neutral default templates. The legal team will replace these without
 * touching the call sites — that's the whole point of having the layer.
 */
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
  /** Decide the contract type for a tier — physical → ISTISNA, symbolic → DONATION. */
  inferType(opts: { includesPhysicalProduct: boolean }): ContractType {
    return opts.includesPhysicalProduct ? 'ISTISNA' : 'DONATION';
  }

  /** Return the Arabic text shown to backers at the pledge step. */
  renderTerms(type: ContractType): string {
    return TEMPLATES_AR[type];
  }
}
