import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ImpersonationService } from './impersonation.service';
import type { AuditService } from '../../identity/audit.service';
import type { OpsPrincipal } from '../ops-auth.service';
import type { OpsReadService } from '../read/ops-read.service';

/**
 * OPS-360 Unit-2 — READ-ONLY view-as impersonation. Asserts:
 *   · OWNER-only (the '*' wildcard) — every other principal is 403,
 *   · start mints a signed 15-min handle AND writes an audit row,
 *   · a good handle round-trips; tamper/expiry/revocation are all refused,
 *   · view enforces subject↔handle match and returns the read layer's snapshot,
 *   · NOTHING here touches a business entity (audit rows only).
 */

function owner(): OpsPrincipal {
  return { userId: 'op-1', permissions: ['*'] } as unknown as OpsPrincipal;
}
function nonOwner(): OpsPrincipal {
  return { userId: 'op-2', permissions: ['support.tickets', 'users.lifecycle'] } as unknown as OpsPrincipal;
}

function build() {
  const auditLog = jest.fn().mockResolvedValue(undefined);
  const audit = { log: auditLog } as unknown as AuditService;
  const read = {
    userDetail: jest.fn().mockResolvedValue({ id: 'u-9', name: 'Aisha' }),
    viewAsSnapshot: jest.fn().mockResolvedValue({ readOnly: true, profile: { id: 'u-9' }, pledges: [], projects: [] }),
  } as unknown as OpsReadService;
  const cfg = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
  const svc = new ImpersonationService(read, audit, cfg);
  return { svc, audit, auditLog, read };
}

describe('ImpersonationService', () => {
  describe('OWNER-only gate', () => {
    it('refuses a non-OWNER on start/stop/view', async () => {
      const { svc } = build();
      await expect(svc.start(nonOwner(), 'u-9', 'looking into a report')).rejects.toThrow(ForbiddenException);
      await expect(svc.stop(nonOwner(), 'x.y', 'done')).rejects.toThrow(ForbiddenException);
      await expect(svc.view(nonOwner(), 'u-9', 'x.y')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('start', () => {
    it('mints a handle, sets a ~15-min expiry, and writes the start audit row', async () => {
      const { svc, auditLog, read } = build();
      const out = await svc.start(owner(), 'u-9', 'investigating report #123', '1.2.3.4');
      expect(out.readOnly).toBe(true);
      expect(out.userId).toBe('u-9');
      expect(out.handle).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      const ttlMin = (new Date(out.expiresAt).getTime() - Date.now()) / 60_000;
      expect(ttlMin).toBeGreaterThan(14);
      expect(ttlMin).toBeLessThanOrEqual(15);
      // subject existence checked via the read layer (NotFound propagates)
      expect(read.userDetail).toHaveBeenCalledWith('u-9');
      // audited: actor=operator, subject=User, reason captured
      const row = auditLog.mock.calls[0]![0];
      expect(row.action).toBe('ops.impersonation.start');
      expect(row.actorId).toBe('op-1');
      expect(row.entity).toBe('User');
      expect(row.entityId).toBe('u-9');
      expect(row.detail.reason).toBe('investigating report #123');
    });

    it('requires a written reason', async () => {
      const { svc } = build();
      await expect(svc.start(owner(), 'u-9', 'x')).rejects.toThrow(ForbiddenException);
    });

    it('propagates NotFound for an unknown subject', async () => {
      const { svc, read } = build();
      (read.userDetail as jest.Mock).mockRejectedValue(new NotFoundException('nope'));
      await expect(svc.start(owner(), 'ghost', 'valid reason here')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handle lifecycle — view + stop', () => {
    it('a fresh handle round-trips through view and returns the snapshot', async () => {
      const { svc, read, auditLog } = build();
      const { handle } = await svc.start(owner(), 'u-9', 'valid reason here');
      const snap = await svc.view(owner(), 'u-9', handle);
      expect(snap.readOnly).toBe(true);
      expect(read.viewAsSnapshot).toHaveBeenCalledWith('u-9');
      // view is itself audited
      expect(auditLog.mock.calls.some((c) => c[0].action === 'ops.impersonation.view')).toBe(true);
    });

    it('rejects a handle whose subject differs from the requested user', async () => {
      const { svc } = build();
      const { handle } = await svc.start(owner(), 'u-9', 'valid reason here');
      await expect(svc.view(owner(), 'someone-else', handle)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a tampered handle', async () => {
      const { svc } = build();
      const { handle } = await svc.start(owner(), 'u-9', 'valid reason here');
      const [body] = handle.split('.');
      await expect(svc.view(owner(), 'u-9', `${body}.deadbeef`)).rejects.toThrow(ForbiddenException);
    });

    it('stop revokes the handle so a subsequent view is refused', async () => {
      const { svc, auditLog } = build();
      const { handle } = await svc.start(owner(), 'u-9', 'valid reason here');
      const res = await svc.stop(owner(), handle, 'finished');
      expect(res.stopped).toBe(true);
      expect(auditLog.mock.calls.some((c) => c[0].action === 'ops.impersonation.stop')).toBe(true);
      await expect(svc.view(owner(), 'u-9', handle)).rejects.toThrow(ForbiddenException);
    });

    it('rejects an expired handle', async () => {
      const { svc } = build();
      const { handle } = await svc.start(owner(), 'u-9', 'valid reason here');
      const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60_000);
      try {
        await expect(svc.view(owner(), 'u-9', handle)).rejects.toThrow(ForbiddenException);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
