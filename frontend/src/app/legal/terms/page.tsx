export const metadata = { title: "Terms of Service — Vouchit" };

/**
 * Plain-language terms.
 *
 * NOT lawyer-reviewed. Written so the signup checkbox points at something
 * real and so users can see what they are agreeing to; it is a starting
 * draft, not a legal opinion. Have a lawyer in each market you operate in
 * review this before public launch.
 */
export default function TermsPage() {
  return (
    <>
      <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-xl p-4 text-sm font-medium">
        <strong>Draft pending legal review.</strong> These terms are written in plain language
        so you can see how Vouchit works. They have not yet been reviewed by a lawyer in every
        market we serve.
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Last updated: 11 November 2026</p>

      <h2 className="text-xl font-bold mt-4">1. What Vouchit is</h2>
      <p>
        Vouchit lets two people agree a wager and lock equal stakes into a smart contract
        called VouchitEscrow, deployed on the Base blockchain. The contract holds both stakes
        and releases the pot when the outcome is agreed or a dispute is resolved.
      </p>
      <p>
        <strong>Vouchit never holds your money.</strong> There is no Vouchit balance, no
        deposit and no withdrawal. Your stake moves from your wallet to the contract and back
        again. We cannot move your funds and neither can your opponent.
      </p>

      <h2 className="text-xl font-bold mt-4">2. Who may use it</h2>
      <p>
        You must be at least 18 years old. You must not use Vouchit where peer-to-peer
        wagering is unlawful, or where you are personally prohibited from wagering. Deciding
        whether that applies to you is your responsibility, not ours. We may refuse or close
        an account at any time.
      </p>

      <h2 className="text-xl font-bold mt-4">3. Fees</h2>
      <p>
        Vouchit takes <strong>2.5% of the pot</strong> when a wager settles, deducted by the
        contract at the moment of payout. Blockchain network fees (gas) are separate, are paid
        by you to the network, and are never received by us. A wager that nobody joins is
        refunded to you in full with no Vouchit fee.
      </p>

      <h2 className="text-xl font-bold mt-4">4. Settling and disputes</h2>
      <p>
        Both participants vote on the winner. If you agree, the contract pays out
        automatically. If you disagree, either of you can open a dispute and submit evidence,
        and Vouchit will decide the outcome and trigger payment on-chain.
      </p>
      <p>
        Our dispute decisions are final as far as the contract is concerned — once the payout
        transaction is mined it cannot be reversed by us or by anyone. We decide disputes in
        good faith on the evidence you give us. We are not a court and we are not a regulated
        arbitrator.
      </p>

      <h2 className="text-xl font-bold mt-4">5. Your wager, your risk</h2>
      <p>
        You can lose everything you stake. Write wagers that are clear and verifiable: a vague
        or unverifiable wager is hard to settle and hard to dispute fairly. Stakes are crypto
        assets whose value changes, so what you win may be worth more or less than when you
        staked it. Nothing on Vouchit is financial, investment or tax advice.
      </p>

      <h2 className="text-xl font-bold mt-4">6. Things that are not allowed</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li>Wagering on anything illegal, or on outcomes you can influence or already know</li>
        <li>Using Vouchit to launder money or move the proceeds of crime</li>
        <li>Running multiple accounts to manipulate your record or reputation</li>
        <li>Wagering on the death, injury or misfortune of a specific person</li>
        <li>Attacking, probing or overloading the service or the contract</li>
      </ul>

      <h2 className="text-xl font-bold mt-4">7. Smart contract risk</h2>
      <p>
        VouchitEscrow is code. It has been tested and its source is published and verified on
        Basescan so anyone can read it. It has <strong>not</strong> had a third-party security
        audit. Bugs in smart contracts can cause permanent, unrecoverable loss. Stake only
        what you can afford to lose, and start small.
      </p>

      <h2 className="text-xl font-bold mt-4">8. Availability</h2>
      <p>
        We do not promise the service will be available or uninterrupted. The blockchain may
        be congested, slow or expensive, and that is outside our control. Wagers already in
        the contract remain governed by the contract even if our website is down.
      </p>

      <h2 className="text-xl font-bold mt-4">9. Liability</h2>
      <p>
        To the fullest extent the law allows, Vouchit is not liable for wagers you lose, for
        losses caused by blockchain network conditions, for smart contract defects, for losing
        access to your own wallet or passkey, or for the conduct of the people you wager with.
        We cannot recover a wallet you have lost access to — nobody can.
      </p>

      <h2 className="text-xl font-bold mt-4">10. Ending your account</h2>
      <p>
        You can delete your account from Settings → Account at any time, provided you have no
        wagers still open. Deleting your Vouchit account does not and cannot remove anything
        already recorded on the blockchain.
      </p>

      <h2 className="text-xl font-bold mt-4">11. Changes</h2>
      <p>
        We may update these terms. If we change something that materially affects you, we will
        say so in the app. Continuing to use Vouchit after a change means you accept it.
      </p>

      <h2 className="text-xl font-bold mt-4">12. Contact</h2>
      <p>
        Questions about these terms: <strong>support@usevouchit.com</strong>
      </p>
    </>
  );
}
