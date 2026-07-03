import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth (Creator-CC / CC-12). Populates req.user when a valid bearer
 * is present, but NEVER rejects — anonymous requests pass through with user=null.
 * Used on public endpoints whose response varies by viewer (e.g. backer-only
 * updates are shown only to CAPTURED backers).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      /* no/invalid token — proceed as anonymous */
    }
    return true;
  }

  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    // Return the user if authenticated, otherwise null (never throw).
    return (user ?? null) as TUser;
  }
}
