import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  /**
   * STAKES/B2 — `/me` view enriched with the count of projects this user has
   * created. The web uses it to decide creator-dashboard access (0 created ⇒
   * not yet a creator) and post-login routing, without an extra round-trip.
   */
  async meView(id: string): Promise<Record<string, unknown>> {
    const u = await this.findById(id);
    const createdProjectsCount = await this.prisma.project.count({
      where: { createdById: id },
    });
    return { ...this.toPublic(u), createdProjectsCount };
  }

  /** Strip server-only fields and convert BigInt for JSON. */
  toPublic(u: User): Record<string, unknown> {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      roles: u.roles,
      nafathVerified: u.nafathVerified,
      reputationTier: u.reputationTier,
      totalPledgedHalalas: Number(u.totalPledgedHalalas),
      locale: u.locale,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateProfile(
    id: string,
    patch: Partial<Pick<User, 'name' | 'phone' | 'locale'>>,
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: patch });
  }
}
