import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
}

export interface AuthResponse {
  accessToken: string;
  user: Record<string, unknown>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const exists = await this.users.findByEmail(email);
    if (exists) throw new ConflictException('email already registered');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        phone: input.phone,
        roles: ['BACKER'],
      },
    });
    return this.issue(user.id, email, user.roles);
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) throw new UnauthorizedException('invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    return this.issue(user.id, user.email, user.roles);
  }

  private async issue(sub: string, email: string, roles: UserRole[]): Promise<AuthResponse> {
    const payload: JwtPayload = { sub, email, roles };
    const accessToken = await this.jwt.signAsync(payload);
    const user = await this.users.findById(sub);
    return { accessToken, user: this.users.toPublic(user) };
  }
}
