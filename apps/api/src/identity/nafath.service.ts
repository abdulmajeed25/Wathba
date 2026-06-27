import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Nafath KYC adapter — Phase 1 stub.
 *
 * Real integration (Phase 4 / pre-prod) will call the Saudi Nafath API
 * to verify the user against the national-ID register; here we model the
 * full flow (initiate → callback) so the mobile UI can be built end-to-
 * end against it.
 *
 * The stub auto-approves after a short delay so QA can exercise the
 * "verified" state without an actual Nafath request.
 */
@Injectable()
export class NafathService {
  private readonly logger = new Logger(NafathService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Begin verification — returns a transactionId the client polls or shows
   * to the user. In production this is a national-ID push to the user's
   * Nafath app.
   */
  async initiate(
    userId: string,
    nationalId: string,
  ): Promise<{ transactionId: string; expiresInSec: number }> {
    this.logger.log(`Nafath initiate (stub) user=${userId} nationalId=${maskNid(nationalId)}`);
    const transactionId = `stub-${userId.slice(0, 8)}-${Date.now()}`;
    return { transactionId, expiresInSec: 60 };
  }

  /**
   * Stub: marks the user verified immediately. Real callback would
   * validate signature + match the transactionId against a cached row.
   */
  async confirm(userId: string, transactionId: string): Promise<{ verified: true }> {
    this.logger.log(`Nafath confirm (stub) user=${userId} tx=${transactionId}`);
    await this.prisma.user.update({
      where: { id: userId },
      data: { nafathVerified: true, nafathVerifiedAt: new Date() },
    });
    return { verified: true };
  }
}

function maskNid(id: string): string {
  return id.length <= 4 ? '****' : `${id.slice(0, 2)}******${id.slice(-2)}`;
}
