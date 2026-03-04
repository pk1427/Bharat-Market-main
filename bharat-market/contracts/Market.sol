// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./OutcomeToken.sol";

contract Market is ReentrancyGuard, Ownable {
    IERC20 public immutable collateralToken;
    address public immutable feeVault;

    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    uint256 public immutable endTime;

    uint256 public totalYes;
    uint256 public totalNo;

    bool public resolved;
    uint8 public winningOutcome; // 1 = YES, 2 = NO

    uint256 public constant FEE_PERCENT = 2;

    event Bought(
        address indexed user,
        bool isYes,
        uint256 amountIn,
        uint256 sharesMinted
    );
    event Resolved(uint8 outcome);
    event Redeemed(address indexed user, uint256 payout);

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

        // Pull USDC from user
        bool success = collateralToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );
        require(success, "TransferFrom failed");

        uint256 fee = (amount * FEE_PERCENT) / 100;
        uint256 netAmount = amount - fee;

        // Transfer fee to vault
        require(collateralToken.transfer(feeVault, fee), "Fee transfer failed");

        // Mint shares 1:1 with netAmount
        if (isYes) {
            yesToken.mint(msg.sender, netAmount);
            totalYes += netAmount;
        } else {
            noToken.mint(msg.sender, netAmount);
            totalNo += netAmount;
        }

        emit Bought(msg.sender, isYes, amount, netAmount);
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
