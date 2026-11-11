export const metadata = { title: "Responsible Play — Vouchit" };

/**
 * A real-money wagering product shipped with no responsible-gambling
 * messaging of any kind. This page exists so there is somewhere to point
 * people, and somewhere the tier limits are explained honestly.
 */
export default function ResponsiblePlayPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Responsible Play</h1>

      <p className="text-lg">
        Vouchit is for settling bets between people who trust each other enough to bet. It is
        not a way to make money, and it is not an investment.
      </p>

      <h2 className="text-xl font-bold mt-4">The honest facts</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li>A wager is zero-sum: for you to win, someone else loses the same amount.</li>
        <li>Vouchit takes 2.5% of every settled pot, so across many wagers the two of you together end up with less than you started.</li>
        <li>Network fees are on top of that, and you pay them whether you win or lose.</li>
        <li>Crypto stakes change in value, so you can be right about the bet and still end up with less.</li>
        <li>On-chain payouts are irreversible. There is no chargeback and no appeal after settlement.</li>
      </ul>

      <h2 className="text-xl font-bold mt-4">Stake what you can lose</h2>
      <p>
        Never stake money you need for rent, food, bills or anyone who depends on you. Never
        borrow to stake. Never stake to win back something you have already lost — that is the
        single most reliable way to lose a great deal more.
      </p>

      <h2 className="text-xl font-bold mt-4">Signs worth taking seriously</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li>Betting more than you planned, or more often than you meant to</li>
        <li>Chasing losses with bigger stakes</li>
        <li>Hiding your betting from people close to you</li>
        <li>Betting to escape stress, boredom or low mood</li>
        <li>Feeling restless or irritable when you try to stop</li>
      </ul>
      <p>
        If any of those sound familiar, stop and talk to someone. You can delete your account
        from Settings → Account at any time once your wagers are closed.
      </p>

      <h2 className="text-xl font-bold mt-4">Where to get help</h2>
      <ul className="list-disc pl-6 flex flex-col gap-1">
        <li><strong>Gamblers Anonymous</strong> — <a className="underline" href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer">gamblersanonymous.org</a></li>
        <li><strong>GamCare</strong> (UK) — <a className="underline" href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer">gamcare.org.uk</a></li>
        <li><strong>BeGambleAware</strong> — <a className="underline" href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">begambleaware.org</a></li>
      </ul>

      <h2 className="text-xl font-bold mt-4">The limits we apply</h2>
      <p>
        New accounts have a stake ceiling and can only run a few wagers at once. These limits
        exist to bound how much damage a brand-new or bad-faith account can do — to you and to
        the people it wagers against. They are not a safety guarantee and they are not a
        substitute for your own judgement.
      </p>

      <p className="text-sm text-[var(--muted-foreground)] mt-4">
        You must be 18 or over to use Vouchit.
      </p>
    </>
  );
}
