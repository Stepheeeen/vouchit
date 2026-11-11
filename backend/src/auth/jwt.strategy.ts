import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getJwtSecret } from './jwt-secret';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /**
   * Accept the token only if it belongs to the account's current session
   * generation.
   *
   * Tokens used to be trusted on signature alone for their full seven days,
   * so a stolen one could not be cut off: changing the password did nothing to
   * it, and "sign out of all devices" had nothing it could possibly do. `sv`
   * is stamped at issue time and compared here against `sessionsValidFrom`,
   * which those actions move forward.
   *
   * This costs one indexed lookup per authenticated request. That is the price
   * of being able to revoke a session at all, and it also means a deleted
   * account's token stops working immediately rather than lingering.
   */
  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload?.sub },
      select: { id: true, email: true, role: true, sessionsValidFrom: true },
    });
    if (!user) throw new UnauthorizedException('Session is no longer valid');

    const issuedFor = Number(payload?.sv ?? 0);
    const validFrom = Math.floor(user.sessionsValidFrom.getTime() / 1000);
    if (!Number.isFinite(issuedFor) || issuedFor < validFrom) {
      throw new UnauthorizedException('Session has been signed out');
    }

    // Role comes from the record, not the token, so a revoked admin cannot
    // keep acting as one until their token expires.
    return { userId: user.id, email: user.email, role: user.role };
  }
}
