'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface FundingTick {
  projectId: string;
  raisedHalalas: string;
  backersCount: number;
  at: number;
}

/**
 * Subscribe to live funding updates for a project. Returns the latest
 * tick (or null until one arrives), so the funding rail can patch
 * raised/backers in place without invalidating TanStack Query.
 *
 * Connection is shared across all consumers of the same socket
 * namespace (socket.io de-dupes), and the room is `project:<id>`.
 *
 * Re-renders only when this project's tick arrives — other projects
 * sharing the connection don't trigger updates here.
 */
export function useLiveFunding(projectId: string | null | undefined): FundingTick | null {
  const [tick, setTick] = useState<FundingTick | null>(null);

  useEffect(() => {
    if (!projectId) return;

    // Same-origin so the browser uses ws://<host>:3000/funding — Next
    // dev server doesn't proxy WS by default, so we hit the API host
    // directly via NEXT_PUBLIC_API_URL (falls back to localhost).
    const wsBase =
      process.env.NEXT_PUBLIC_API_URL ??
      (typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, ':4001') : 'http://localhost:4001');

    const socket: Socket = io(`${wsBase}/funding`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      socket.emit('subscribe', { projectId });
    });

    const onTick = (payload: FundingTick): void => {
      if (payload?.projectId === projectId) setTick(payload);
    };
    socket.on('funding.tick', onTick);

    return () => {
      try {
        socket.emit('unsubscribe', { projectId });
      } catch {
        // socket already disconnected — fine
      }
      socket.off('funding.tick', onTick);
      socket.disconnect();
    };
  }, [projectId]);

  return tick;
}
