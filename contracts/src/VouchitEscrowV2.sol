// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title VouchitEscrowV2
 * @notice Non-custodial escrow for two-party wagers, with deadlines.
 *
 * Replaces VouchitEscrow, which decided winners in a way that was not fair to
 * either party. Three things were wrong with it, all demonstrated against the
 * deployed contract before this was written:
 *
 *   1. Once a wager went ACTIVE its expiry became dead data. `expiresAt` was
 *      read only to block late joins and to refund a wager nobody joined, so
 *      two people who simply lost interest left both stakes in the contract
 *      permanently — not recoverable by them, by the other party, or by the
 *      owner. A year past expiry the funds were still there.
 *
 *   2. Refusing to vote was free and effective. A losing player had only to
 *      say nothing and the winner was never paid, forever. The incentive ran
 *      exactly the wrong way.
 *
 *   3. `resolveDispute` accepted a wager in ACTIVE as well as DISPUTED, so the
 *      owner could declare a winner on a live wager that nobody had voted on
 *      and nobody had disputed. The owner could never take the money — a
 *      payout must go to one of the two players — but being able to pick the
 *      winner at will is not something to ask users to trust.
 *
 * What replaces it:
 *
 *   - Agreement still settles instantly and needs no trusted party.
 *   - After the voting window, ONE vote is enough. Silence no longer defeats
 *     the person who won; it concedes to them.
 *   - Two silent players, or two who disagreed and neither escalated, get
 *     their stakes back with no fee. Nothing is ever stranded.
 *   - A dispute that the owner leaves unresolved past the SLA can be refunded
 *     by either party, so the owner cannot freeze money by doing nothing.
 *   - The owner may act ONLY on a wager that is genuinely disputed.
 *
 * Every deadline-driven exit is permissionless: anyone may trigger it, because
 * the outcome is fixed by the votes already cast and the clock. Nobody has to
 * be trusted to let someone else out.
 */
contract VouchitEscrowV2 {
    enum WagerStatus {
        PENDING_FUNDING, // 0 — created, waiting for the challenger
        ACTIVE,          // 1 — both stakes held
        SETTLED,         // 2 — paid out to a winner
        DISPUTED,        // 3 — escalated, awaiting the arbiter
        CANCELLED        // 4 — refunded, no winner, no fee
    }

    struct Wager {
        bytes32 wagerId;
        address creator;
        address challenger;
        address token;      // address(0) = native coin
        uint256 stakeAmount;
        uint256 totalPot;
        WagerStatus status;
        address winner;
        address creatorVote;
        address challengerVote;
        uint256 expiresAt;  // join deadline, and the start of the voting window
        uint256 disputedAt; // when a dispute was opened; 0 if never
    }

    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /**
     * How long after `expiresAt` the players have to vote.
     *
     * Long enough that someone who is simply asleep, travelling or offline
     * for a weekend does not lose by default; short enough that money is not
     * tied up for weeks. It runs from the join deadline, not from the first
     * vote, so it cannot be shortened by voting early and hoping.
     */
    uint256 public constant VOTE_WINDOW = 3 days;

    /**
     * How long the arbiter has on a dispute before either party can take
     * their stake back. This is the limit on the owner's power to do nothing.
     */
    uint256 public constant DISPUTE_SLA = 14 days;

    address public owner;
    address public treasury;
    mapping(bytes32 => Wager) public wagers;

    uint256 private _locked;

    event WagerCreated(bytes32 indexed wagerId, address indexed creator, address challenger, address token, uint256 stakeAmount);
    event WagerJoined(bytes32 indexed wagerId, address indexed challenger, uint256 totalPot);
    event VoteCast(bytes32 indexed wagerId, address indexed voter, address votedWinner);
    event WagerSettled(bytes32 indexed wagerId, address indexed winner, uint256 payout, uint256 fee, string reason);
    event WagerCancelled(bytes32 indexed wagerId, string reason);
    event DisputeOpened(bytes32 indexed wagerId, address indexed opener);
    event DisputeResolved(bytes32 indexed wagerId, address winner, uint256 payout, uint256 fee, uint8 resolutionType);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 0, "Reentrant call");
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "Treasury cannot be zero");
        owner = msg.sender;
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury cannot be zero");
        treasury = _treasury;
    }

    function setOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Owner cannot be zero");
        owner = _newOwner;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Creating and joining
    // ─────────────────────────────────────────────────────────────────────

    function createWager(
        bytes32 wagerId,
        address challenger,
        address token,
        uint256 stakeAmount,
        uint256 durationSeconds
    ) external payable nonReentrant {
        require(wagers[wagerId].creator == address(0), "Wager ID already exists");
        require(stakeAmount > 0, "Stake amount must be > 0");
        require(challenger != msg.sender, "Cannot wager against yourself");
        require(durationSeconds > 0, "Duration must be > 0");

        if (token == address(0)) {
            require(msg.value == stakeAmount, "Must send exact native ETH stake");
        } else {
            require(msg.value == 0, "Do not send ETH for ERC20 wager");
            // The balance is measured either side of the transfer rather than
            // trusted. A token that takes a cut on transfer would otherwise
            // leave the recorded pot larger than the contract actually holds,
            // and settlement would revert forever with both stakes inside.
            uint256 before = IERC20(token).balanceOf(address(this));
            require(IERC20(token).transferFrom(msg.sender, address(this), stakeAmount), "ERC20 transferFrom failed");
            require(
                IERC20(token).balanceOf(address(this)) - before == stakeAmount,
                "Token takes a fee on transfer; unsupported"
            );
        }

        wagers[wagerId] = Wager({
            wagerId: wagerId,
            creator: msg.sender,
            challenger: challenger,
            token: token,
            stakeAmount: stakeAmount,
            totalPot: stakeAmount,
            status: WagerStatus.PENDING_FUNDING,
            winner: address(0),
            creatorVote: address(0),
            challengerVote: address(0),
            expiresAt: block.timestamp + durationSeconds,
            disputedAt: 0
        });

        emit WagerCreated(wagerId, msg.sender, challenger, token, stakeAmount);
    }

    function joinWager(bytes32 wagerId) external payable nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.creator != address(0), "Wager does not exist");
        require(wager.status == WagerStatus.PENDING_FUNDING, "Wager is not pending funding");
        require(block.timestamp < wager.expiresAt, "Wager has expired");
        require(msg.sender != wager.creator, "Creator cannot join their own wager");

        if (wager.challenger != address(0)) {
            require(msg.sender == wager.challenger, "You are not the designated challenger");
        } else {
            wager.challenger = msg.sender;
        }

        if (wager.token == address(0)) {
            require(msg.value == wager.stakeAmount, "Must send exact native ETH stake");
        } else {
            require(msg.value == 0, "Do not send ETH for ERC20 wager");
            uint256 before = IERC20(wager.token).balanceOf(address(this));
            require(
                IERC20(wager.token).transferFrom(msg.sender, address(this), wager.stakeAmount),
                "ERC20 transferFrom failed"
            );
            require(
                IERC20(wager.token).balanceOf(address(this)) - before == wager.stakeAmount,
                "Token takes a fee on transfer; unsupported"
            );
        }

        wager.totalPot += wager.stakeAmount;
        wager.status = WagerStatus.ACTIVE;

        emit WagerJoined(wagerId, msg.sender, wager.totalPot);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Deciding the winner
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Agreement settles immediately and needs no third party.
    function voteWinner(bytes32 wagerId, address votedWinner) external nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.ACTIVE, "Wager is not active");
        require(msg.sender == wager.creator || msg.sender == wager.challenger, "Only participants can vote");
        require(votedWinner == wager.creator || votedWinner == wager.challenger, "Winner must be a participant");

        if (msg.sender == wager.creator) {
            wager.creatorVote = votedWinner;
        } else {
            wager.challengerVote = votedWinner;
        }

        emit VoteCast(wagerId, msg.sender, votedWinner);

        if (wager.creatorVote != address(0) && wager.creatorVote == wager.challengerVote) {
            _settle(wager, wager.creatorVote, "both agreed");
        }
    }

    /**
     * @notice Close out a wager whose voting window has passed.
     * @dev Callable by ANYONE: the result is already determined by the votes
     *      cast and the clock, so nobody should need another party's
     *      cooperation to get their money out.
     *
     *      One vote wins. That is the heart of the change — under the old
     *      contract a loser could simply never vote and the winner was never
     *      paid. Now saying nothing concedes.
     *
     *      No votes, or two conflicting votes nobody escalated, refunds both
     *      stakes and takes no fee. A disagreement that neither party cared
     *      enough to dispute is not a win for anyone.
     */
    function finalizeExpired(bytes32 wagerId) external nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.ACTIVE, "Wager is not active");
        require(block.timestamp >= wager.expiresAt + VOTE_WINDOW, "Voting window is still open");

        address cv = wager.creatorVote;
        address xv = wager.challengerVote;

        if (cv != address(0) && xv == address(0)) {
            _settle(wager, cv, "challenger did not vote");
        } else if (xv != address(0) && cv == address(0)) {
            _settle(wager, xv, "creator did not vote");
        } else {
            // Either nobody voted, or they disagreed and neither escalated.
            _refundBoth(wager, cv == address(0) ? "nobody voted" : "unresolved disagreement");
        }
    }

    /// @notice Escalate a disagreement to the arbiter.
    function openDispute(bytes32 wagerId) external {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.ACTIVE, "Wager is not active");
        require(msg.sender == wager.creator || msg.sender == wager.challenger, "Only participants can dispute");

        wager.status = WagerStatus.DISPUTED;
        wager.disputedAt = block.timestamp;
        emit DisputeOpened(wagerId, msg.sender);
    }

    /**
     * @notice Arbiter decision. 1 = pay a winner, 2 = refund both.
     * @dev Restricted to DISPUTED. The previous contract also accepted
     *      ACTIVE, which let the owner decide a live wager that nobody had
     *      voted on and nobody had disputed.
     */
    function resolveDispute(bytes32 wagerId, address winner, uint8 resolutionType)
        external
        onlyOwner
        nonReentrant
    {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.DISPUTED, "Wager is not disputed");

        if (resolutionType == 1) {
            require(winner == wager.creator || winner == wager.challenger, "Winner must be a participant");
            uint256 fee = (wager.totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 payout = wager.totalPot - fee;

            wager.status = WagerStatus.SETTLED;
            wager.winner = winner;
            _transferFunds(wager.token, winner, payout);
            _transferFunds(wager.token, treasury, fee);

            emit DisputeResolved(wagerId, winner, payout, fee, 1);
        } else if (resolutionType == 2) {
            wager.status = WagerStatus.CANCELLED;
            uint256 refund = wager.stakeAmount;
            _transferFunds(wager.token, wager.creator, refund);
            if (wager.challenger != address(0)) {
                _transferFunds(wager.token, wager.challenger, refund);
            }
            emit DisputeResolved(wagerId, address(0), refund, 0, 2);
        } else {
            revert("Invalid resolution type");
        }
    }

    /**
     * @notice Take your stake back from a dispute the arbiter never answered.
     * @dev The only check on an arbiter who stalls. Without it, opening a
     *      dispute would hand the owner an indefinite freeze on both stakes
     *      simply by never acting. Permissionless and refunds both sides, so
     *      the arbiter cannot gain by waiting.
     */
    function claimStalledDispute(bytes32 wagerId) external nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.DISPUTED, "Wager is not disputed");
        require(block.timestamp >= wager.disputedAt + DISPUTE_SLA, "Arbiter still has time");
        _refundBoth(wager, "dispute not resolved in time");
    }

    /// @notice Refund a wager that nobody joined before it expired.
    function cancelExpiredWager(bytes32 wagerId) external nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.PENDING_FUNDING, "Wager is not pending funding");
        require(block.timestamp >= wager.expiresAt, "Wager has not expired yet");

        wager.status = WagerStatus.CANCELLED;
        _transferFunds(wager.token, wager.creator, wager.stakeAmount);
        emit WagerCancelled(wagerId, "Expired unfunded wager");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────

    function _settle(Wager storage wager, address winner, string memory reason) internal {
        uint256 fee = (wager.totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = wager.totalPot - fee;

        wager.status = WagerStatus.SETTLED;
        wager.winner = winner;

        _transferFunds(wager.token, winner, payout);
        _transferFunds(wager.token, treasury, fee);

        emit WagerSettled(wager.wagerId, winner, payout, fee, reason);
    }

    /// @dev No fee on a refund: nobody won, so there is nothing to take a cut of.
    function _refundBoth(Wager storage wager, string memory reason) internal {
        wager.status = WagerStatus.CANCELLED;
        uint256 refund = wager.stakeAmount;

        _transferFunds(wager.token, wager.creator, refund);
        if (wager.challenger != address(0)) {
            _transferFunds(wager.token, wager.challenger, refund);
        }
        emit WagerCancelled(wager.wagerId, reason);
    }

    function _transferFunds(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            require(IERC20(token).transfer(to, amount), "ERC20 transfer failed");
        }
    }

    /// @notice When the voting window closes. 0 if the wager is not active.
    function votingClosesAt(bytes32 wagerId) external view returns (uint256) {
        Wager storage w = wagers[wagerId];
        if (w.status != WagerStatus.ACTIVE) return 0;
        return w.expiresAt + VOTE_WINDOW;
    }
}
