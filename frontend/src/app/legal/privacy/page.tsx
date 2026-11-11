export const metadata = { title: "Privacy Policy — Vouchit" };

/**
 * Plain-language privacy policy. NOT lawyer-reviewed — see the banner.
 *
 * Deliberately specific about the blockchain point, because it is the part
 * people get wrong: a wallet address and every wager made with it are public
 * and permanent, and no privacy setting here can change that.
 */
export default function PrivacyPage() {
  return (
    <>
      <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-xl p-4 text-sm font-medium">
        <strong>Draft pending legal review.</strong> Accurate about what the product does
        today, but not yet checked against GDPR, NDPR or any other regime by a lawyer.
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Last updated: 11 November 2026</p>

      <h2 className="text-xl font-bold mt-4">What we collect</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li><strong>Your email address</strong> — to create your account and send verification and security codes.</li>
        <li><strong>A password</strong> — stored only as a bcrypt hash. We never see or store the password itself.</li>
        <li><strong>Profile details you choose to add</strong> — username, display name, bio, avatar.</li>
        <li><strong>Your wallet address</strong>, once you link one by signing a message.</li>
        <li><strong>Your wagers</strong> — descriptions, stakes, outcomes and any dispute evidence you upload.</li>
      </ul>
      <p>
        We do <strong>not</strong> collect government ID, BVN, NIN, or bank details. We removed
        identity-document checks entirely: verification is based on your wallet and your
        settlement history instead.
      </p>

      <h2 className="text-xl font-bold mt-4">The blockchain part, plainly</h2>
      <p>
        Everything that happens in the escrow contract is <strong>public and permanent</strong>.
        Your wallet address, every stake, every wager you join and every payout you receive can
        be read by anyone on Basescan, forever. That is how public blockchains work.
      </p>
      <p>
        We cannot delete, hide or alter it. If you link a wallet that is already tied to your
        real identity somewhere else, your Vouchit activity can be connected to you. The privacy
        settings in this app control what <em>Vouchit's own</em> pages show — never what the
        chain shows.
      </p>

      <h2 className="text-xl font-bold mt-4">Who else sees it</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li><strong>Resend</strong> — delivers your verification and security emails.</li>
        <li><strong>Cloudinary</strong> — stores avatars and dispute evidence you upload.</li>
        <li><strong>MongoDB Atlas, Render and Vercel</strong> — host the database and the app.</li>
      </ul>
      <p>We do not sell your data and we do not share it for advertising.</p>

      <h2 className="text-xl font-bold mt-4">Your choices</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li><strong>Download everything we hold</strong> — Settings → Privacy → Download My Data.</li>
        <li><strong>Hide your profile and leave the leaderboard</strong> — Settings → Privacy.</li>
        <li><strong>Turn off notification categories</strong> — Settings → Notifications.</li>
        <li><strong>Delete your account</strong> — Settings → Account. This removes your profile, notifications and wager participation from our database. It cannot remove anything from the blockchain.</li>
      </ul>

      <h2 className="text-xl font-bold mt-4">How long we keep it</h2>
      <p>
        While your account exists, and for as long afterwards as we need to resolve disputes
        or meet a legal obligation. Delete your account and the personal data above goes with
        it.
      </p>

      <h2 className="text-xl font-bold mt-4">Security</h2>
      <p>
        Passwords are hashed with bcrypt. Sessions can be revoked, and changing your password
        signs out every other device. Verification codes expire after 15 minutes and are
        destroyed after repeated wrong guesses. No system is perfectly secure; tell us at once
        if you think your account has been compromised.
      </p>

      <h2 className="text-xl font-bold mt-4">Contact</h2>
      <p>
        Privacy questions or requests: <strong>support@usevouchit.com</strong>
      </p>
    </>
  );
}
