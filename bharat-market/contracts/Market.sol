// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./OutcomeToken.sol";
import "./LiquidityToken.sol";

contract Market is ReentrancyGuard, Ownable {
    IERC20 public immutable collateralToken;
    address public immutable feeVault;

    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    LiquidityToken public lpToken;

    uint256 public immutable endTime;

    uint256 public yesPool;
    uint256 public noPool;

    uint256 public constant INITIAL_LIQUIDITY = 1000e6;

    bool public resolved;
    uint8 public winningOutcome;

    uint256 public constant FEE_PERCENT = 2;

    event Bought(
        address indexed user,
        bool isYes,
        uint256 amountIn,
        uint256 sharesMinted
    );
    event Resolved(uint8 outcome);
    event Redeemed(address indexed user, uint256 payout);

    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed provider, uint256 amount);

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

        lpToken = new LiquidityToken(
            string.concat("LP - ", question),
            "BLP",
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
// PREVIEW FUNCTIONS
// ================================

function previewBuyYes(
    uint256 amount
) public view returns (uint256 shares) {

    uint256 fee = (amount * FEE_PERCENT) / 100;

    uint256 protocolFee = fee / 2;
    uint256 lpFee = fee - protocolFee;

    uint256 net = amount - fee;

    // LP fee stays in pool
    uint256 effectiveAmount = net + lpFee;

    uint256 k = yesPool * noPool;

    uint256 newYes = yesPool + effectiveAmount;
    uint256 newNo = k / newYes;

    shares = noPool - newNo;
}

function previewBuyNo(
    uint256 amount
) public view returns (uint256 shares) {

    uint256 fee = (amount * FEE_PERCENT) / 100;

    uint256 protocolFee = fee / 2;
    uint256 lpFee = fee - protocolFee;

    uint256 net = amount - fee;

    // LP fee stays in pool
    uint256 effectiveAmount = net + lpFee;

    uint256 k = yesPool * noPool;

    uint256 newNo = noPool + effectiveAmount;
    uint256 newYes = k / newNo;

    shares = yesPool - newYes;
}

    // ================================
    // BUY FUNCTIONS (SLIPPAGE SAFE)
    // ================================

    function buyYes(uint256 amount, uint256 minShares) external nonReentrant {
        uint256 shares = previewBuyYes(amount);

        require(shares >= minShares, "Slippage exceeded");

        _executeBuy(amount, true, shares);
    }

    function buyNo(uint256 amount, uint256 minShares) external nonReentrant {
        uint256 shares = previewBuyNo(amount);

        require(shares >= minShares, "Slippage exceeded");

        _executeBuy(amount, false, shares);
    }

    function _executeBuy(
        uint256 amount,
        bool isYes,
        uint256 sharesMinted
    ) internal {
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

        // split fee
        uint256 protocolFee = fee / 2;
        uint256 lpFee = fee - protocolFee;

        // amount that actually moves price
        uint256 netAmount = amount - fee;

        // send protocol fee
        require(
            collateralToken.transfer(feeVault, protocolFee),
            "Protocol fee transfer failed"
        );

        // LP fee stays in pool
        uint256 effectiveAmount = netAmount + lpFee;

        uint256 k = yesPool * noPool;

        if (isYes) {
            yesPool += effectiveAmount;

            uint256 newNoPool = k / yesPool;

            noPool = newNoPool;

            yesToken.mint(msg.sender, sharesMinted);
        } else {
            noPool += effectiveAmount;

            uint256 newYesPool = k / noPool;

            yesPool = newYesPool;

            noToken.mint(msg.sender, sharesMinted);
        }

        emit Bought(msg.sender, isYes, amount, sharesMinted);
    }

    function addLiquidity(uint256 amount) external nonReentrant {
        require(!resolved, "Market resolved");
        require(amount > 0, "Invalid amount");

        require(
            collateralToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        uint256 lpSupply = lpToken.totalSupply();
        uint256 poolValue = yesPool + noPool;

        uint256 shares;

        if (lpSupply == 0) {
            shares = amount;
        } else {
            shares = (amount * lpSupply) / poolValue;
        }

        uint256 half = amount / 2;

        yesPool += half;
        noPool += half;

        lpToken.mint(msg.sender, shares);

        emit LiquidityAdded(msg.sender, amount);
    }

    function removeLiquidity(uint256 lpAmount) external nonReentrant {
        require(lpAmount > 0, "Invalid amount");

        uint256 lpSupply = lpToken.totalSupply();

        uint256 yesShare = (yesPool * lpAmount) / lpSupply;
        uint256 noShare = (noPool * lpAmount) / lpSupply;

        lpToken.burn(msg.sender, lpAmount);

        yesPool -= yesShare;
        noPool -= noShare;

        uint256 payout = yesShare + noShare;

        require(
            collateralToken.transfer(msg.sender, payout),
            "Transfer failed"
        );

        emit LiquidityRemoved(msg.sender, payout);
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
