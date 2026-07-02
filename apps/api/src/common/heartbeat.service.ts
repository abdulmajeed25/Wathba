import { Global, Injectable, Module } from '@nestjs/common';

/**
 * Worker heartbeat registry (Sprint 4 / P1-801). Cron workers beat() after
 * every tick; /v1/health/ready reports the age of each beat so a silently
 * dead money worker (settlement, payouts) is visible to the LB and alerts.
 */
@Injectable()
export class HeartbeatService {
  private readonly beats = new Map<string, number>();

  beat(name: string): void {
    this.beats.set(name, Date.now());
  }

  ages(): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const [k, v] of this.beats) out[k] = Math.round((Date.now() - v) / 1000);
    return out;
  }

  age(name: string): number | null {
    const v = this.beats.get(name);
    return v == null ? null : Math.round((Date.now() - v) / 1000);
  }
}

@Global()
@Module({ providers: [HeartbeatService], exports: [HeartbeatService] })
export class HeartbeatModule {}
