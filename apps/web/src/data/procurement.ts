export interface RFQItem {
  id: string;
  projectId: string;
  projectTitleAr: string;
  specsAr: string;
  dueDate: string;
  daysLeft: number;
  bidsCount: number;
  status: 'OPEN' | 'AWARDED' | 'CLOSED';
  category: string;
}

export interface BidItem {
  id: string;
  rfqId: string;
  rfqTitle: string;
  amountHalalas: number;
  leadTimeDays: number;
  status: 'SUBMITTED' | 'SHORTLISTED' | 'AWARDED' | 'REJECTED';
  submittedAt: string;
}

export const RFQS: RFQItem[] = [
  {
    id: 'rfq-1', projectId: 'sirb', projectTitleAr: 'سِرب — درون التصوير الذكي',
    specsAr: 'تصنيع ٢,٥٠٠ وحدة من إطار درون من ألياف الكربون بمواصفات IP67، وزن أقل من ٤٨٠g.',
    dueDate: '٢٠٢٦/٠٨/٠١', daysLeft: 21, bidsCount: 7, status: 'OPEN', category: 'تصنيع',
  },
  {
    id: 'rfq-2', projectId: 'hekaya', projectTitleAr: 'حكايا — منصة قصص الأطفال',
    specsAr: 'طباعة وتجليد ١٠,٠٠٠ كتاب أطفال ٤٨ صفحة، ورق عالي الجودة، شحن للسعودية.',
    dueDate: '٢٠٢٦/٠٧/٢٠', daysLeft: 9, bidsCount: 12, status: 'OPEN', category: 'طباعة',
  },
  {
    id: 'rfq-3', projectId: 'sada', projectTitleAr: 'صدى — سمّاعة لاسلكية',
    specsAr: 'توريد ١٢,٠٠٠ بطارية ليثيوم بوليمر ٥٠٠mAh مع شهادات الجودة المعتمدة.',
    dueDate: '٢٠٢٦/٠٧/٣٠', daysLeft: 19, bidsCount: 5, status: 'OPEN', category: 'إلكترونيات',
  },
];

export const MY_BIDS: BidItem[] = [
  { id: 'b1', rfqId: 'rfq-1', rfqTitle: 'سِرب — تصنيع إطار درون', amountHalalas: 192_500_000, leadTimeDays: 45, status: 'SHORTLISTED', submittedAt: 'قبل يومين' },
  { id: 'b2', rfqId: 'rfq-3', rfqTitle: 'صدى — توريد بطاريات',    amountHalalas: 64_000_000,  leadTimeDays: 30, status: 'AWARDED',     submittedAt: 'قبل أسبوع' },
  { id: 'b3', rfqId: 'rfq-2', rfqTitle: 'حكايا — طباعة كتب',     amountHalalas: 88_000_000,  leadTimeDays: 25, status: 'REJECTED',    submittedAt: 'قبل ٣ أيام' },
];
