'use client';

import { useEffect, useState } from 'react';

import type { WathbaProject as WathbaProjectShape } from './wathba-data';
import { resolveCampaign } from './wathba-campaign-shared';
import { WathbaComments } from './wathba-comments';
import { ContestsBanner } from './wathba-contests-banner';
import type { ApiContest } from '@/lib/api/wathba';

/**
 * TABS — التعليقات tab: contests banner (real projects) + the thread with
 * composer and creator-badged replies. Real projects use the live list
 * (compose/edit/delete); fixtures keep the demo thread.
 */
export function WathbaTabComments({ id, project }: { id: string; project?: WathbaProjectShape }) {
  const { rich, isReal, realId } = resolveCampaign(id, project);
  return (
    <div>
      {isReal && <ContestsLoader projectId={realId} />}
      <WathbaComments projectId={realId} comments={rich.comments} live={isReal} />
    </div>
  );
}

function ContestsLoader({ projectId }: { projectId: string }): React.ReactElement | null {
  const [contests, setContests] = useState<ApiContest[] | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch(`/api/contests/${projectId}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: ApiContest[] }) => {
        if (!cancel) setContests(d.items ?? []);
      })
      .catch(() => {
        if (!cancel) setContests([]);
      });
    return () => {
      cancel = true;
    };
  }, [projectId]);
  if (!contests || contests.length === 0) return null;
  return <ContestsBanner contests={contests} />;
}
