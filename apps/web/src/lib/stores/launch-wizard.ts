'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Launch-wizard state — Zustand store with localStorage persistence so a
 * creator can navigate away (read a how-it-works section, glance at
 * existing projects) and come back without losing their draft.
 *
 * Mirror of the local-useState fields previously declared in
 * wathba-start.tsx. The component still owns step-rail rendering and the
 * publish-mutation glue; this store only persists the form data.
 */

export interface DraftTier {
  id: string;
  price: string;
  title: string;
  desc: string;
}

export interface DraftMilestone {
  id: string;
  titleAr: string;
  descAr: string;
  releasePct: number;
}

interface LaunchWizardState {
  step: number;
  title: string;
  tagline: string;
  categoryId: string;
  goalText: string;
  durationText: string;
  story: string;
  mediaName: string;
  tiers: DraftTier[];
  editingTier: string | null;
  milestones: DraftMilestone[];

  set: <K extends keyof Omit<LaunchWizardState, 'set' | 'reset'>>(
    k: K,
    v: LaunchWizardState[K],
  ) => void;
  reset: () => void;
}

const DEFAULT_TIERS: DraftTier[] = [
  { id: 'dt0', price: '$25',  title: 'داعم مبكر',     desc: 'شارة + تحديثات حصرية' },
  { id: 'dt1', price: '$79',  title: 'الباقة الأساسية', desc: 'وحدة + شحن مجاني' },
  { id: 'dt2', price: '$149', title: 'الباقة المزدوجة', desc: 'وحدتان + إكسسوارات' },
];

const DEFAULT_MILESTONES: DraftMilestone[] = [
  { id: 'dm0', titleAr: 'تأمين خط الإنتاج',        descAr: 'توقيع المصنع + شراء المواد',           releasePct: 25 },
  { id: 'dm1', titleAr: 'الإنتاج الأوّلي والجودة', descAr: 'إنتاج الدفعة الأولى + شهادات الجودة',    releasePct: 35 },
  { id: 'dm2', titleAr: 'الشحن للداعمين',           descAr: 'بدء شحن الباقات للداعمين',              releasePct: 25 },
  { id: 'dm3', titleAr: 'التشغيل والدعم',           descAr: 'دعم فني للداعمين خلال أول ٩٠ يوماً',    releasePct: 15 },
];

const DEFAULTS = {
  step: 1,
  title: '',
  tagline: '',
  categoryId: '',
  goalText: '400,000',
  durationText: '30',
  story: '',
  mediaName: '',
  tiers: DEFAULT_TIERS,
  editingTier: null,
  milestones: DEFAULT_MILESTONES,
} as const;

export const useLaunchWizard = create<LaunchWizardState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (k, v) => set({ [k]: v } as Partial<LaunchWizardState>),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'wathba.launch-wizard.v1',
      partialize: (s) => ({
        step: s.step,
        title: s.title,
        tagline: s.tagline,
        categoryId: s.categoryId,
        goalText: s.goalText,
        durationText: s.durationText,
        story: s.story,
        mediaName: s.mediaName,
        tiers: s.tiers,
        milestones: s.milestones,
      }),
    },
  ),
);
