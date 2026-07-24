// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title VouchitEscrow
 * @notice Trustless Zero-Sum Social Wager Escrow for Vouchit
 */
contract VouchitEscrow {
    address public owner;
    address public treasury;
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5% fee (250 / 10000)
    uint256 public constant BPS_DENOMINATOR = 10000;

    enum WagerStatus { PENDING_FUNDING, ACTIVE, SETTLED, DISPUTED, CANCELLED }

    struct Wager {
        bytes32 wagerId;
        address creator;
        address challenger;
        address token; // address(0) for Native ETH/MATIC, or ERC20 address (USDT/USDC)
        uint256 stakeAmount; // stake amount required PER participant
        uint256 totalPot;
        WagerStatus status;
        address winner;
        address creatorVote;
        address challengerVote;
        uint256 expiresAt;
    }

    mapping(bytes32 => Wager) public wagers;

    // Reentrancy guard
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    event WagerCreated(
        bytes32 indexed wagerId,
        address indexed creator,
        address indexed challenger,
        address token,
        uint256 stakeAmount
    );
    event WagerJoined(bytes32 indexed wagerId, address indexed challenger, uint256 totalPot);
    event VoteCast(bytes32 indexed wagerId, address indexed voter, address votedWinner);
    event WagerSettled(bytes32 indexed wagerId, address indexed winner, uint256 payout, uint256 fee);
    event DisputeOpened(bytes32 indexed wagerId, address indexed openedBy);
    event DisputeResolved(bytes32 indexed wagerId, address indexed winner, uint256 payout, uint256 fee, uint8 resolutionType);
    event WagerCancelled(bytes32 indexed wagerId, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "VouchitEscrow: caller is not the owner");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury address");
        owner = msg.sender;
        treasury = _treasury;
        _status = _NOT_ENTERED;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
    }

    function setOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner");
        owner = _newOwner;
    }

    /**
     * @notice Create a new zero-sum wager on-chain
     * @param wagerId Unique bytes32 identifier generated off-chain/on-chain
     * @param challenger Target opponent address (or address(0) if open to any)
     * @param token ERC20 token address or address(0) for native ETH
     * @param stakeAmount Required stake per participant
     * @param durationSeconds Validity duration in seconds
     */
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

        if (token == address(0)) {
            require(msg.value == stakeAmount, "Must send exact native ETH stake");
        } else {
            require(msg.value == 0, "Do not send ETH for ERC20 wager");
            require(
                IERC20(token).transferFrom(msg.sender, address(this), stakeAmount),
                "ERC20 transferFrom failed"
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
            expiresAt: block.timestamp + durationSeconds
        });

        emit WagerCreated(wagerId, msg.sender, challenger, token, stakeAmount);
    }

    /**
     * @notice Join an existing open or targeted wager
     * @param wagerId Target wager ID
     */
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
            require(
                IERC20(wager.token).transferFrom(msg.sender, address(this), wager.stakeAmount),
                "ERC20 transferFrom failed"
            );
        }

        wager.totalPot += wager.stakeAmount;
        wager.status = WagerStatus.ACTIVE;

        emit WagerJoined(wagerId, msg.sender, wager.totalPot);
    }

    /**
     * @notice Vote on wager winner. If both votes match, settles instantly.
     */
    function voteWinner(bytes32 wagerId, address votedWinner) external nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.ACTIVE, "Wager is not active");
        require(
            msg.sender == wager.creator || msg.sender == wager.challenger,
            "Only participants can vote"
        );
        require(
            votedWinner == wager.creator || votedWinner == wager.challenger,
            "Winner must be a participant"
        );

        if (msg.sender == wager.creator) {
            wager.creatorVote = votedWinner;
        } else {
            wager.challengerVote = votedWinner;
        }

        emit VoteCast(wagerId, msg.sender, votedWinner);

        // Check if mutual agreement reached
        if (wager.creatorVote != address(0) && wager.creatorVote == wager.challengerVote) {
            _executeSettlement(wager, wager.creatorVote);
        }
    }

    /**
     * @notice Open a dispute if counterparties disagree
     */
    function openDispute(bytes32 wagerId) external {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.ACTIVE, "Wager is not active");
        require(
            msg.sender == wager.creator || msg.sender == wager.challenger,
            "Only participants can dispute"
        );

        wager.status = WagerStatus.DISPUTED;
        emit DisputeOpened(wagerId, msg.sender);
    }

    /**
     * @notice Admin resolution for disputed on-chain wagers
     * @param resolutionType 1 = Payout Winner, 2 = Refund Both
     */
    function resolveDispute(
        bytes32 wagerId,
        address winner,
        uint8 resolutionType
    ) external onlyOwner nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(
            wager.status == WagerStatus.ACTIVE || wager.status == WagerStatus.DISPUTED,
            "Wager not active or disputed"
        );

        if (resolutionType == 1) {
            // Payout winner
            require(
                winner == wager.creator || winner == wager.challenger,
                "Winner must be a participant"
            );
            uint256 fee = (wager.totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 payout = wager.totalPot - fee;

            wager.status = WagerStatus.SETTLED;
            wager.winner = winner;

            _transferFunds(wager.token, winner, payout);
            _transferFunds(wager.token, treasury, fee);

            emit DisputeResolved(wagerId, winner, payout, fee, resolutionType);
        } else if (resolutionType == 2) {
            // Refund 50/50
            wager.status = WagerStatus.CANCELLED;
            uint256 refundAmount = wager.stakeAmount;

            _transferFunds(wager.token, wager.creator, refundAmount);
            if (wager.challenger != address(0)) {
                _transferFunds(wager.token, wager.challenger, refundAmount);
            }

            emit DisputeResolved(wagerId, address(0), refundAmount, 0, resolutionType);
        } else {
            revert("Invalid resolution type");
        }
    }

    /**
     * @notice Cancel expired and unfunded wager (refund creator)
     */
    function cancelExpiredWager(bytes32 wagerId) external nonReentrant {
        Wager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.PENDING_FUNDING, "Wager is not pending funding");
        require(block.timestamp >= wager.expiresAt, "Wager has not expired yet");

        wager.status = WagerStatus.CANCELLED;
        _transferFunds(wager.token, wager.creator, wager.stakeAmount);

        emit WagerCancelled(wagerId, "Expired unfunded wager");
    }

    function _executeSettlement(Wager storage wager, address winner) internal {
        uint256 fee = (wager.totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = wager.totalPot - fee;

        wager.status = WagerStatus.SETTLED;
        wager.winner = winner;

        _transferFunds(wager.token, winner, payout);
        _transferFunds(wager.token, treasury, fee);

        emit WagerSettled(wager.wagerId, winner, payout, fee);
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
}
