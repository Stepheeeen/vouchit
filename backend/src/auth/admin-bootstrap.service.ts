import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Promote the accounts named in ADMIN_EMAILS when the app starts.
 *
 * There was no way to create the first admin on a deployment. `AdminGuard`
 * refuses every request without the role, nothing in the app can grant it,
 * and the only tool that could — scripts/grant-admin.js — needs a database
 * connection string in the hands of whoever runs it. On a hosted service that
 * means copying a live credential onto a laptop, which is both awkward and a
 * worse thing to be doing routinely than the problem it solves.
 *
 * With zero admins, `POST /disputes/:id/resolve` is unreachable by anyone, a
 * disputed wager stays DISPUTED, and both stakes stay in the escrow contract
 * with nobody able to release them. So "there is no first admin" is not a
 * setup inconvenience; it is money stuck.
 *
 * ADMIN_EMAILS is a comma-separated list set wherever the service's other
 * environment variables live. It is deliberately narrow:
 *
 *   - It only ever PROMOTES. An account dropped from the list is not demoted,
 *     because a typo or a truncated variable would otherwise silently remove
 *     every admin and lock the disputes queue again. Revoking stays a
 *     deliberate act: `grant-admin.js <email> --revoke --apply`.
 *   - It never creates accounts. The person must already have signed up, so
 *     the variable cannot conjure a login that nobody controls.
 *   - It is idempotent, and silent when there is nothing to do.
 *
 * Anyone able to set this variable can already read DATABASE_URL and edit the
 * database directly, so it grants no capability that was not already there.
 * It just makes the safe version of it routine.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger('AdminBootstrap');

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Tests spin the module up against a throwaway database and should not
    // have roles applied underneath them.
    if (process.env.NODE_ENV === 'test') return;

    const emails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) return;

    try {
      // A narrow select on purpose. Reading the whole record would make this
      // fail on any account missing a column added since it was written —
      // Prisma refuses those outright, and this database has been in that
      // state. Startup must not depend on every user document being perfect.
      const found = await this.prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, role: true },
      });

      const missing = emails.filter((e) => !found.some((u) => u.email.toLowerCase() === e));
      if (missing.length) {
        this.logger.warn(
          `ADMIN_EMAILS names ${missing.length} account(s) that do not exist here: ${missing.join(', ')}. ` +
            'They must sign up first, and check this is the database you meant.',
        );
      }

      const toPromote = found.filter((u) => u.role !== 'ADMIN');
      if (toPromote.length === 0) {
        if (found.length) this.logger.log(`Admin roles already correct (${found.length}).`);
        return;
      }

      await this.prisma.user.updateMany({
        where: { id: { in: toPromote.map((u) => u.id) } },
        data: { role: 'ADMIN' },
      });
      this.logger.log(`Promoted to ADMIN: ${toPromote.map((u) => u.email).join(', ')}`);
    } catch (err: any) {
      // Never prevent the API from starting. An unreachable database here
      // would otherwise take the whole service down over a convenience.
      this.logger.error(`Could not apply ADMIN_EMAILS: ${err?.message ?? err}`);
    }
  }
}
