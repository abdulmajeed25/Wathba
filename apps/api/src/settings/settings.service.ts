import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  SETTINGS_CATALOG,
  type SettingKey,
  type SettingValue,
} from './settings.catalog';

/**
 * Batch OPS (registry completion) — the read side of platform settings.
 *
 * Precedence per key: PlatformSetting row (zod-validated) → catalog default.
 * A row that fails its schema is treated as ABSENT — loud log, safe default —
 * because a poisoned setting must degrade to known-good behavior, never
 * take the pledge path down with a parse throw.
 *
 * Rows are memoised for a short TTL (same posture as CategoriesService);
 * the settings.update operation calls invalidate() after commit so a change
 * is visible on the next read.
 */

const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private cache: { at: number; rows: Map<string, unknown> } | null = null;

  /** Effective value for a catalog key: validated DB row, else the default. */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const rows = await this.load();
    const def = SETTINGS_CATALOG[key];
    if (!rows.has(key)) return def.defaultValue as SettingValue<K>;
    const parsed = def.schema.safeParse(rows.get(key));
    if (!parsed.success) {
      this.logger.error(
        `PlatformSetting "${key}" holds a value that fails its catalog schema — ` +
          `falling back to the default (${JSON.stringify(def.defaultValue)}): ` +
          parsed.error.issues.map((i) => i.message).join('; '),
      );
      return def.defaultValue as SettingValue<K>;
    }
    return parsed.data as SettingValue<K>;
  }

  /** Every catalog key with its effective value + source (future ops screen). */
  async getAll(): Promise<
    Array<{
      key: SettingKey;
      titleAr: string;
      descriptionAr: string;
      value: unknown;
      source: 'db' | 'default';
    }>
  > {
    const rows = await this.load();
    return Promise.all(
      (Object.keys(SETTINGS_CATALOG) as SettingKey[]).map(async (key) => {
        const def = SETTINGS_CATALOG[key];
        const value = await this.get(key);
        const source: 'db' | 'default' =
          rows.has(key) && def.schema.safeParse(rows.get(key)).success ? 'db' : 'default';
        return { key, titleAr: def.titleAr, descriptionAr: def.descriptionAr, value, source };
      }),
    );
  }

  /** Drop the memoised rows — called by settings.update after commit. */
  invalidate(): void {
    this.cache = null;
  }

  private async load(): Promise<Map<string, unknown>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.rows;
    }
    const rows = await this.prisma.platformSetting.findMany();
    const map = new Map<string, unknown>(rows.map((r) => [r.key, r.value as unknown]));
    this.cache = { at: Date.now(), rows: map };
    return map;
  }
}
