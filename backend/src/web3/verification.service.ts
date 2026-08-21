import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tiering for a non-custodial app.
 *
 * We never hold user funds, so tiers cannot gate withdrawals — there is nothing
 * to withhold. Instead they bound how much damage one account can do: stake
 * size, how many wagers run at once, and whether it can create open wagers that
 * any stranger can join.
 *
 * No government ID is involved anywhere. The signals are a signature-linked
 * wallet, wallet age, an optional on-chain attestation, and settlement history.
 */
export enum VerificationTier {
  NEWCOMER = 0,
  VERIFIED = 1,
  TRUSTED = 2,
}

export interface TierLimits {
  /** Maximum concurrent wagers that are open or awaiting settlement. */
  maxConcurrentWagers: number;
  /** Whether this tier may create wagers anyone can join. */
  canCreateOpenWagers: boolean;
}

export const TIER_LIMITS: Record<VerificationTier, TierLimits> = {
  [VerificationTier.NEWCOMER]: { maxConcurrentWagers: 3, canCreateOpenWagers: false },
  [VerificationTier.VERIFIED]: { maxConcurrentWagers: 10, canCreateOpenWagers: true },
  [VerificationTier.TRUSTED]: { maxConcurrentWagers: Number.MAX_SAFE_INTEGER, canCreateOpenWagers: true },
};

/** Wallet must be at least this old to count toward VERIFIED. */
const MIN_WALLET_AGE_DAYS = 30;
/** Settled wagers, against this many DISTINCT opponents, to reach TRUSTED. */
const TRUSTED_MIN_SETTLED = 5;
const TRUSTED_MIN_DISTINCT_OPPONENTS = 3;

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Age of a wallet in days, from its first outbound transaction.
   *
   * Requires a block explorer key. Without one the signal is simply unavailable
   * — we return null rather than guessing, and the caller treats that as "not
   * proven" instead of silently granting the tier.
   */
  private async getWalletAgeDays(address: string): Promise<number | null> {
    const apiKey = process.env.BASESCAN_API_KEY;
    const apiUrl = process.env.BASESCAN_API_URL ?? 'https://api.basescan.org/api';
    if (!apiKey) return null;

    try {
      const url = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const body: any = await res.json();
      const firstTx = Array.isArray(body?.result) ? body.result[0] : null;
      if (!firstTx?.timeStamp) return null;

      const firstSeen = Number(firstTx.timeStamp) * 1000;
      return Math.floor((Date.now() - firstSeen) / (24 * 60 * 60 * 1000));
    } catch (error) {
      console.error('[VerificationService] Wallet age lookup failed:', error);
      return null;
    }
  }

  /**
   * Whether the wallet holds a Coinbase Verification attestation on Base.
   *
   * Coinbase issues these free via EAS, attesting the wallet belongs to a
   * KYC-passed Coinbase account. We read one boolean on-chain and never see,
   * store, or become responsible for anyone's identity documents.
   *
   * Not wired to the indexer yet — returns false so it can never grant a tier
   * it hasn't actually proven.
   */
  private async hasCoinbaseAttestation(_address: string): Promise<boolean> {
    return false;
  }

  /**
   * Settlement record, counting only DISTINCT opponents.
   *
   * Wallets are free, so an attacker can wager against their own second account
   * all day. Counting distinct counterparties is what makes that worthless —
   * without it this signal would be trivially farmable.
   */
  private async getSettlementRecord(userId: string) {
    const participations = await this.prisma.wagerParticipant.findMany({
      where: { userId, wager: { status: 'SETTLED' } },
      include: { wager: { include: { participants: { select: { userId: true } } } } },
    });

    const opponents = new Set<string>();
    for (const p of participations) {
      for (const other of p.wager.participants) {
        if (other.userId !== userId) opponents.add(other.userId);
      }
    }

    return { settled: participations.length, distinctOpponents: opponents.size };
  }

  /** Compute the tier a user currently qualifies for, with its reasoning. */
  async computeTier(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { tier: VerificationTier.NEWCOMER, method: null, signals: {} };
    }

    // Everything above NEWCOMER requires a signature-linked wallet.
    if (!user.web3Address) {
      return { tier: VerificationTier.NEWCOMER, method: null, signals: { linkedWallet: false } };
    }

    const [walletAgeDays, attested, record] = await Promise.all([
      this.getWalletAgeDays(user.web3Address),
      this.hasCoinbaseAttestation(user.web3Address),
      this.getSettlementRecord(userId),
    ]);

    const signals = {
      linkedWallet: true,
      emailVerified: user.emailVerified,
      walletAgeDays,
      coinbaseAttestation: attested,
      ...record,
    };

    const hasTrustedRecord =
      record.settled >= TRUSTED_MIN_SETTLED &&
      record.distinctOpponents >= TRUSTED_MIN_DISTINCT_OPPONENTS;

    if (attested) {
      return { tier: VerificationTier.TRUSTED, method: 'COINBASE_ATTESTATION', signals };
    }
    if (hasTrustedRecord) {
      return { tier: VerificationTier.TRUSTED, method: 'SETTLEMENT_RECORD', signals };
    }
    if (user.emailVerified && walletAgeDays !== null && walletAgeDays >= MIN_WALLET_AGE_DAYS) {
      return { tier: VerificationTier.VERIFIED, method: 'WALLET_AGE', signals };
    }

    return { tier: VerificationTier.NEWCOMER, method: null, signals };
  }

  /** Recompute, persist, and return the user's tier. */
  async refreshTier(userId: string) {
    const result = await this.computeTier(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { verificationTier: result.tier, verificationMethod: result.method },
    });
    return { ...result, limits: TIER_LIMITS[result.tier] };
  }
}
