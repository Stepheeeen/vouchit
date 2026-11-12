# How a Vouch is decided

This is the whole of it. Nothing here is at anyone's discretion except the
disputed case at the end, and that part says what we judge by.

The rules below are enforced by the escrow contract, not by our servers. We
cannot override them, skip a step, or reach into a Vouch that is following
them — so this page is a description of code, not a promise of good behaviour.

## 1. You both agree

Both people pick the same winner. The contract pays out the moment the second
vote lands. No one at Vouchit is involved and nothing can delay it.

This is how almost every Vouch should end.

## 2. One of you votes, the other goes quiet

Once the Vouch's deadline passes, you both have **3 days** to vote. If only one
vote has been cast when that window closes, **that vote decides it.**

Saying nothing is not a defence. If you lost and you ignore the app, the
3 days run out and your opponent is paid.

Anyone can trigger this once the window closes — your opponent, us, or a
stranger. You never need the other person's co-operation to be paid what the
votes already decided.

Conceding counts the same as claiming. Voting *for* the other person works
exactly like voting for yourself, so an honest loser can end it in one tap.

## 3. Neither of you votes

Both stakes go back, in full, and **we take no fee.** A Vouch nobody finished
isn't a win for anyone, and it isn't revenue for us.

## 4. You disagree, and neither of you escalates

Same outcome as above: both stakes refunded, no fee. If you disagreed but
neither of you cared enough to open a dispute within the window, we are not
going to guess.

## 5. You disagree and someone opens a dispute

Now we decide. We can only do two things — pay one of the two of you, or refund
you both. We cannot pay ourselves, cannot pay a third party, and cannot touch a
Vouch that nobody has disputed.

**If we do not decide within 14 days, either of you can take your stake back**
and the dispute is void. We cannot hold your money by stalling.

### What we judge by, in this order

1. **The wording of the Vouch as written.** Not what you meant, not what you
   discussed elsewhere — what the Vouch actually says. Write it carefully.
2. **A public, checkable source.** A final score, an official result, a public
   record. If one exists, it decides the matter and nothing else matters.
3. **Evidence you both can see.** Anything either of you submits is shown to
   the other. We do not decide on something your opponent never saw.
4. **The side with the burden.** If the Vouch claims something happened, the
   person claiming it has to show that it did. Absence of proof goes against
   the claim, not in its favour.
5. **A refund when the wording cannot settle it.** If the Vouch is genuinely
   ambiguous, undecidable, or about something that never resolved, we refund
   both of you rather than pick. Fee-free.

### What we will not do

- Decide on evidence from one side only.
- Decide based on who signed up first, who has won more, or who complained
  louder.
- Reinterpret a Vouch to mean something fairer than it says. A badly worded
  Vouch gets a refund, not a rewrite.
- Decide a Vouch that involves a Vouchit employee's own account. Those get
  refunded.

## 6. Nobody joined

If your Vouch expires before anyone takes it, your stake comes straight back.

---

## The timings, in one place

| | |
|---|---|
| Time to vote after the deadline | **3 days** |
| Our deadline on a dispute | **14 days** |
| Fee on a settled Vouch | **2.5%** of the pot |
| Fee on any refund | **none** |

## What we can and cannot do

**Cannot:** take your stake, pay a third party, decide an undisputed Vouch,
block a payout the votes already settled, change these timings on a Vouch that
already exists, or hold a disputed stake past 14 days.

**Can:** decide a dispute one of you opened, within 14 days, under the criteria
above.

---

*The escrow contract is the authority on all of this. If this page and the
contract ever disagree, the contract is what happens — and this page is wrong
and should be fixed.*
