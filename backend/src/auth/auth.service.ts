import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { stripUserSecrets } from '../common/user-select';
import { Resend } from 'resend';

/**
 * Minimum password length.
 *
 * There was no rule at all before this: a single character was accepted, on an
 * app that guards real money on a public chain.
 */
const MIN_PASSWORD_LENGTH = 10;

/** A verification code is good for this long. */
const OTP_TTL_MS = 15 * 60 * 1000;

/**
 * Wrong codes allowed before the code is burned.
 *
 * A six-digit code with unlimited guesses is a million requests away from
 * being read aloud, and nothing rate-limited those guesses. Counting failures
 * and destroying the code is what makes the short code safe to use.
 */
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
  }

  /**
   * Six-digit code from a cryptographically secure source.
   *
   * `Math.random()` is seeded predictably and is not safe for anything an
   * attacker benefits from guessing — which a login code certainly is.
   */
  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /**
   * Reject passwords that cannot protect an account.
   *
   * Deliberately a length floor plus a character-variety nudge rather than a
   * thicket of rules: length is what actually resists guessing, and ornate
   * composition rules push people toward `Password1!`.
   */
  private assertPasswordAcceptable(password: string) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    if (password.length > 200) {
      throw new BadRequestException('Password must be 200 characters or fewer.');
    }
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password));
    if (classes.length < 2) {
      throw new BadRequestException(
        'Password must mix at least two of: lowercase, uppercase, numbers, symbols.',
      );
    }
  }

  /**
   * Send the verification code.
   *
   * Returns whether it actually went out. The old code swallowed the failure
   * and told the caller "OTP sent to email" regardless, so a misconfigured or
   * down mail provider left people waiting forever for a code that was never
   * sent, with no way to tell and nothing to retry.
   */
  private async sendOtpEmail(email: string, otp: string): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`[Mock Resend] Missing RESEND_API_KEY. OTP is ${otp} for ${email}`);
      return true;
    }
    try {
      const result = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Vouchit <noreply@usevouchit.com>',
        to: email,
        subject: 'Your Vouchit Verification Code',
        html: `<p>Your verification code is: <strong>${otp}</strong></p>
               <p>It expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
      });
      if ((result as any)?.error) {
        console.error('Resend rejected the verification email:', (result as any).error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return false;
    }
  }

  /** Tell someone their account was just signed into, if they asked to know. */
  private async sendLoginAlert(email: string) {
    if (!process.env.RESEND_API_KEY) return;
    try {
      await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Vouchit <noreply@usevouchit.com>',
        to: email,
        subject: 'New sign-in to your Vouchit account',
        html: `<p>Your Vouchit account was just signed into.</p>
               <p>If this wasn't you, change your password and sign out of all devices from Settings → Account.</p>`,
      });
    } catch (error) {
      // A missed alert must never block a legitimate login.
      console.error('Failed to send login alert:', error);
    }
  }

  /**
   * Begin registration.
   *
   * The response is identical whether or not the address is already taken.
   * It used to answer "User already exists" for a known address and
   * "Registration successful" for an unknown one, which — with no rate
   * limiting — let anyone enumerate the entire user base, while every probe
   * of an unknown address posted a real email to it. That made the signup
   * endpoint both a user-directory oracle and a free spam relay.
   */
  async register(email: string, password: string) {
    if (!email || !password) throw new BadRequestException('Email and password required');
    this.assertPasswordAcceptable(password);

    const normalizedEmail = String(email).trim().toLowerCase();
    const uniform = {
      message: 'If that address can be registered, a verification code is on its way.',
      success: true,
    };

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Already a real account: say nothing that distinguishes this case. The
    // owner is not left stranded — they can sign in, or reset their password.
    if (user?.emailVerified) return uniform;

    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    if (user) {
      await this.prisma.user.update({
        where: { email: normalizedEmail },
        data: { otp, otpExpiresAt, otpAttempts: 0 },
      });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.prisma.user.create({
        data: { email: normalizedEmail, password: hashedPassword, otp, otpExpiresAt },
      });
    }

    await this.sendOtpEmail(normalizedEmail, otp);
    return uniform;
  }

  /**
   * Re-send a verification code.
   *
   * A real endpoint, because the frontend used to "resend" by calling
   * register() again with a hardcoded placeholder password. That happened not
   * to overwrite the stored password, but only because register() took a
   * different branch for unverified users — a one-line change away from
   * silently resetting people's passwords to a known string.
   */
  async resendOtp(email: string) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const uniform = {
      message: 'If that address is awaiting verification, a new code is on its way.',
      success: true,
    };
    if (!normalizedEmail) return uniform;

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.emailVerified) return uniform;

    const otp = this.generateOtp();
    await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { otp, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), otpAttempts: 0 },
    });
    await this.sendOtpEmail(normalizedEmail, otp);
    return uniform;
  }

  async verifyEmail(email: string, otp: string) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new UnauthorizedException('Invalid or expired code');

    // An OTP is single-use: once the address is verified this endpoint must not
    // mint another session, or a leaked code stays a login forever.
    if (user.emailVerified) {
      throw new UnauthorizedException('This email is already verified. Please log in.');
    }

    const expired = !user.otpExpiresAt || user.otpExpiresAt < new Date();
    if (!user.otp || expired) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (user.otp !== otp) {
      const attempts = (user.otpAttempts ?? 0) + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        // Burn the code rather than letting guessing continue against it.
        await this.prisma.user.update({
          where: { email: normalizedEmail },
          data: { otp: null, otpExpiresAt: null, otpAttempts: 0 },
        });
        throw new UnauthorizedException(
          'Too many incorrect codes. Request a new one.',
        );
      }
      await this.prisma.user.update({
        where: { email: normalizedEmail },
        data: { otpAttempts: attempts },
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    const verified = await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: true, otp: null, otpExpiresAt: null, otpAttempts: 0 },
    });

    return {
      accessToken: this.issueToken(verified),
      user: stripUserSecrets(verified),
    };
  }

  /**
   * Sign a session token.
   *
   * `sv` pins the token to the account's current session generation, so
   * "sign out of all devices" can invalidate everything already issued.
   */
  private issueToken(user: { id: string; email: string; role: string; sessionsValidFrom: Date }) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sv: Math.floor(user.sessionsValidFrom.getTime() / 1000),
    });
  }

  async login(email: string, password: string) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Compare against a dummy hash when the account is missing so that a
    // wrong address and a wrong password take the same time to answer.
    const storedHash = user?.password ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const isValid = await bcrypt.compare(password ?? '', storedHash);
    if (!user || !isValid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Please verify your email first.');
    }

    // Second factor, when the account asked for one. The toggle used to be a
    // localStorage flag the server never saw, so turning it on changed nothing
    // while telling the user their account now required a code.
    if (user.twoFactorEnabled) {
      const otp = this.generateOtp();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otp, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), otpAttempts: 0 },
      });
      const sent = await this.sendOtpEmail(user.email, otp);
      return {
        twoFactorRequired: true,
        emailSent: sent,
        message: sent
          ? 'Enter the code we just emailed you.'
          : 'We could not send your code right now. Try again shortly.',
      };
    }

    if (user.loginAlertsEnabled) {
      void this.sendLoginAlert(user.email);
    }

    return { accessToken: this.issueToken(user), user: stripUserSecrets(user) };
  }

  /** Second step of a 2FA login. */
  async loginTwoFactor(email: string, otp: string) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.twoFactorEnabled) throw new UnauthorizedException('Invalid or expired code');

    const expired = !user.otpExpiresAt || user.otpExpiresAt < new Date();
    if (!user.otp || expired) throw new UnauthorizedException('Invalid or expired code');

    if (user.otp !== otp) {
      const attempts = (user.otpAttempts ?? 0) + 1;
      const burn = attempts >= MAX_OTP_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: burn
          ? { otp: null, otpExpiresAt: null, otpAttempts: 0 }
          : { otpAttempts: attempts },
      });
      throw new UnauthorizedException(
        burn ? 'Too many incorrect codes. Sign in again to get a new one.' : 'Invalid or expired code',
      );
    }

    const cleared = await this.prisma.user.update({
      where: { id: user.id },
      data: { otp: null, otpExpiresAt: null, otpAttempts: 0 },
    });

    if (cleared.loginAlertsEnabled) void this.sendLoginAlert(cleared.email);

    return { accessToken: this.issueToken(cleared), user: stripUserSecrets(cleared) };
  }

  /**
   * Change the password, then cut every other session loose.
   *
   * Changing a password that an attacker already knows is pointless if their
   * existing token keeps working for the rest of its seven days.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Not signed in');

    const ok = await bcrypt.compare(currentPassword ?? '', user.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    this.assertPasswordAcceptable(newPassword);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        sessionsValidFrom: new Date(),
      },
    });

    // Hand back a fresh token so the device that made the change stays in.
    return { message: 'Password changed. Other devices have been signed out.', accessToken: this.issueToken(updated) };
  }

  /** Invalidate every token issued so far, including this one. */
  async signOutAllDevices(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { sessionsValidFrom: new Date() },
    });
    return { message: 'Signed out everywhere.', accessToken: this.issueToken(updated) };
  }

  /**
   * Start a password reset.
   *
   * There was no way to recover an account at all — forget the password and it
   * was gone, along with any wager history attached to it. Same uniform
   * response as registration, for the same reason.
   */
  async requestPasswordReset(email: string) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const uniform = {
      message: 'If that address has an account, a reset code is on its way.',
      success: true,
    };
    if (!normalizedEmail) return uniform;

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.emailVerified) return uniform;

    const otp = this.generateOtp();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), otpAttempts: 0 },
    });

    if (process.env.RESEND_API_KEY) {
      try {
        await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Vouchit <noreply@usevouchit.com>',
          to: normalizedEmail,
          subject: 'Reset your Vouchit password',
          html: `<p>Your password reset code is: <strong>${otp}</strong></p>
                 <p>It expires in 15 minutes. If you didn't ask for it, ignore this email — nothing has changed.</p>`,
        });
      } catch (error) {
        console.error('Failed to send reset email:', error);
      }
    } else {
      console.log(`[Mock Resend] Reset code ${otp} for ${normalizedEmail}`);
    }
    return uniform;
  }

  /** Finish a password reset and sign every other device out. */
  async resetPassword(email: string, otp: string, newPassword: string) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new UnauthorizedException('Invalid or expired code');

    const expired = !user.otpExpiresAt || user.otpExpiresAt < new Date();
    if (!user.otp || expired) throw new UnauthorizedException('Invalid or expired code');

    if (user.otp !== otp) {
      const attempts = (user.otpAttempts ?? 0) + 1;
      const burn = attempts >= MAX_OTP_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: burn ? { otp: null, otpExpiresAt: null, otpAttempts: 0 } : { otpAttempts: attempts },
      });
      throw new UnauthorizedException(
        burn ? 'Too many incorrect codes. Request a new one.' : 'Invalid or expired code',
      );
    }

    this.assertPasswordAcceptable(newPassword);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        otp: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        sessionsValidFrom: new Date(),
      },
    });

    return { accessToken: this.issueToken(updated), user: stripUserSecrets(updated) };
  }
}
