export type CampaignChangeTerms = { fundingGoalHalalas: string; durationDays: number };
export type CampaignChangeRow = {
  id: string; projectId: string; status: string; reasonAr: string;
  before: CampaignChangeTerms; proposed: CampaignChangeTerms;
  reviewNoteAr: string | null; createdAt: string;
};
export const changeStatus: Record<string, string> = {
  SUBMITTED: 'بانتظار مراجعة الإدارة', ACCEPTED_FOR_PREPARATION: 'مقبول مبدئيًا — لم يطبّق',
  REJECTED: 'مرفوض', WITHDRAWN: 'مسحوب',
  CONSENT_OPEN: 'مفتوح لردود الداعمين — لم يطبّق',
};
