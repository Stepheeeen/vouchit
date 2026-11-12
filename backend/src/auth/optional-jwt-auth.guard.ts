import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attach the user if a valid token is present; otherwise carry on anonymously.
 *
 * Needed for routes that serve both: a public wager anyone may read, and a
 * private one that has to know who is asking. `JwtAuthGuard` would reject
 * every signed-out visitor, and no guard at all — which is what this route
 * had — means the service cannot tell a participant from a stranger.
 *
 * An invalid or expired token is treated as no token rather than as an
 * error, so a stale session still sees everything that is public.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(_err: any, user: any) {
    return user || undefined;
  }
}
