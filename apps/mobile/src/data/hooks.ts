import { useQuery } from '@tanstack/react-query';
import {
  categories,
  featuredProject,
  projects,
  rewardTiersFor,
  budgetSplit,
  transparencyTimeline,
  projectUpdates,
  projectComments,
  projectFaqs,
  ranks,
  howSteps,
  type ProjectCard,
  type RewardTierItem,
} from './mock';

/**
 * Mock-first data layer. Each hook returns the same shape the API will
 * return, so screens written today work unchanged once the real API is
 * reachable — only the implementation here flips from mock to fetch.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      await wait(50);
      return categories;
    },
    staleTime: Infinity,
  });
}

export function useFeaturedProject() {
  return useQuery({
    queryKey: ['featured'],
    queryFn: async (): Promise<ProjectCard> => {
      await wait(50);
      return featuredProject;
    },
    staleTime: 60_000,
  });
}

export function useTrendingProjects() {
  return useQuery({
    queryKey: ['projects', 'trending'],
    queryFn: async (): Promise<ProjectCard[]> => {
      await wait(50);
      return [...projects]
        .sort((a, b) => b.backersCount - a.backersCount)
        .slice(0, 8);
    },
    staleTime: 60_000,
  });
}

export function useDiscover(filters?: {
  category?: string;
  sort?: 'trending' | 'new' | 'ending_soon' | 'most_funded';
  includePartnered?: boolean;
}) {
  return useQuery({
    queryKey: ['projects', 'discover', filters],
    queryFn: async (): Promise<ProjectCard[]> => {
      await wait(50);
      let list = [...projects];
      if (filters?.category && filters.category !== 'all') {
        list = list.filter((p) => p.category === filters.category);
      }
      if (filters?.includePartnered === false) {
        list = list.filter((p) => !p.platformPartner);
      }
      if (filters?.sort === 'new') list = list; // mock order
      else if (filters?.sort === 'ending_soon') list = list.sort((a, b) => a.daysLeft - b.daysLeft);
      else if (filters?.sort === 'most_funded')
        list = list.sort((a, b) => b.raisedHalalas - a.raisedHalalas);
      else list = list.sort((a, b) => b.backersCount - a.backersCount);
      return list;
    },
    staleTime: 30_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      await wait(50);
      const p = projects.find((x) => x.id === id);
      if (!p) throw new Error('not found');
      return p;
    },
    staleTime: 60_000,
  });
}

export function useRewardTiers(projectId: string) {
  return useQuery({
    queryKey: ['tiers', projectId],
    queryFn: async (): Promise<RewardTierItem[]> => {
      await wait(50);
      return rewardTiersFor(projectId);
    },
    staleTime: 60_000,
  });
}

export function useTransparency(projectId: string) {
  return useQuery({
    queryKey: ['transparency', projectId],
    queryFn: async () => {
      await wait(50);
      return { budget: budgetSplit, timeline: transparencyTimeline };
    },
    staleTime: 60_000,
  });
}

export function useProjectUpdates(projectId: string) {
  return useQuery({
    queryKey: ['updates', projectId],
    queryFn: async () => {
      await wait(50);
      return projectUpdates;
    },
    staleTime: 60_000,
  });
}

export function useProjectComments(projectId: string) {
  return useQuery({
    queryKey: ['comments', projectId],
    queryFn: async () => {
      await wait(50);
      return projectComments;
    },
    staleTime: 30_000,
  });
}

export function useProjectFaqs(projectId: string) {
  return useQuery({
    queryKey: ['faqs', projectId],
    queryFn: async () => {
      await wait(50);
      return projectFaqs;
    },
    staleTime: Infinity,
  });
}

export function useRanks() {
  return useQuery({
    queryKey: ['ranks'],
    queryFn: async () => {
      await wait(50);
      return ranks;
    },
    staleTime: Infinity,
  });
}

export function useHowSteps() {
  return useQuery({
    queryKey: ['howSteps'],
    queryFn: async () => {
      await wait(50);
      return howSteps;
    },
    staleTime: Infinity,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: async (): Promise<ProjectCard[]> => {
      await wait(80);
      if (!q.trim()) return projects;
      const needle = q.trim().toLowerCase();
      return projects.filter(
        (p) =>
          p.titleAr.toLowerCase().includes(needle) ||
          p.shortDescAr.toLowerCase().includes(needle) ||
          p.creator.toLowerCase().includes(needle),
      );
    },
    staleTime: 5_000,
  });
}
