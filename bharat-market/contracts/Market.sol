// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./OutcomeToken.sol";

contract Market is ReentrancyGuard, Ownable {
    IERC20 public immutable collateralToken;
    address public immutable feeVault;

    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    uint256 public immutable endTime;

    // ================================
    // CPMM POOLS
    // ================================

    uint256 public yesPool;
    uint256 public noPool;

    uint256 public constant INITIAL_LIQUIDITY = 1000e6;

    bool public resolved;
    uint8 public winningOutcome; // 1 = YES, 2 = NO

    uint256 public constant FEE_PERCENT = 2;

    // ================================
    // EVENTS
    // ================================

    event Bought(
        address indexed user,
        bool isYes,
        uint256 amountIn,
        uint256 sharesMinted
    );

    event Resolved(uint8 outcome);

    event Redeemed(address indexed user, uint256 payout);

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _collateralToken,
        address _feeVault,
        uint256 _endTime,
        string memory question,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_collateralToken != address(0), "Invalid token");
        require(_feeVault != address(0), "Invalid vault");
        require(_endTime > block.timestamp, "Invalid end time");
        require(initialOwner != address(0), "Invalid owner");

        collateralToken = IERC20(_collateralToken);
        feeVault = _feeVault;
        endTime = _endTime;

        // Initialize CPMM pools
        yesPool = INITIAL_LIQUIDITY;
        noPool = INITIAL_LIQUIDITY;

        yesToken = new OutcomeToken(
            string.concat("YES - ", question),
            "YES",
            address(this)
        );

        noToken = new OutcomeToken(
            string.concat("NO - ", question),
            "NO",
            address(this)
        );
    }

    // ================================
    // CPMM HELPERS
    // ================================

    function invariant() public view returns (uint256) {
        return yesPool * noPool;
    }

    function priceYes() public view returns (uint256) {
        return (yesPool * 1e18) / (yesPool + noPool);
    }

    function priceNo() public view returns (uint256) {
        return (noPool * 1e18) / (yesPool + noPool);
    }

    // ================================
    // BUY FUNCTIONS
    // ================================

    function buyYes(uint256 amount) external nonReentrant {
        _buy(amount, true);
    }

    function buyNo(uint256 amount) external nonReentrant {
        _buy(amount, false);
    }

    function _buy(uint256 amount, bool isYes) internal {
        require(block.timestamp < endTime, "Market closed");
        require(!resolved, "Already resolved");
        require(amount > 0, "Invalid amount");

        bool success = collateralToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );

        require(success, "TransferFrom failed");

        uint256 fee = (amount * FEE_PERCENT) / 100;
        uint256 netAmount = amount - fee;

        require(collateralToken.transfer(feeVault, fee), "Fee transfer failed");

        uint256 k = yesPool * noPool;

        uint256 sharesMinted;

        if (isYes) {
            yesPool += netAmount;

            uint256 newNoPool = k / yesPool;

            sharesMinted = noPool - newNoPool;

            noPool = newNoPool;

            yesToken.mint(msg.sender, sharesMinted);
        } else {
            noPool += netAmount;

            uint256 newYesPool = k / noPool;

            sharesMinted = yesPool - newYesPool;

            yesPool = newYesPool;

            noToken.mint(msg.sender, sharesMinted);
        }

        emit Bought(msg.sender, isYes, amount, sharesMinted);
    }

    // ================================
    // RESOLUTION
    // ================================

    function resolve(uint8 outcome) external onlyOwner {
        require(block.timestamp >= endTime, "Too early");
        require(!resolved, "Already resolved");
        require(outcome == 1 || outcome == 2, "Invalid outcome");

        resolved = true;
        winningOutcome = outcome;

        emit Resolved(outcome);
    }

    // ================================
    // REDEEM
    // ================================

    function redeem() external nonReentrant {
        require(resolved, "Not resolved");

        uint256 payout;

        if (winningOutcome == 1) {
            uint256 balance = yesToken.balanceOf(msg.sender);

            require(balance > 0, "No winning shares");

            payout = balance;

            yesToken.burn(msg.sender, balance);
        } else {
            uint256 balance = noToken.balanceOf(msg.sender);

            require(balance > 0, "No winning shares");

            payout = balance;

            noToken.burn(msg.sender, balance);
        }

        require(collateralToken.transfer(msg.sender, payout), "Payout failed");

        emit Redeemed(msg.sender, payout);
    }
}