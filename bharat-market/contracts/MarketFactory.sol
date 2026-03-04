// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Market.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MarketFactory is Ownable {
    // ================================
    // STORAGE
    // ================================

    address public immutable collateralToken;
    address public immutable feeVault;

    uint256 public creationFee = 10e6; // 10 USDC (assuming 6 decimals)

    address[] public allMarkets;

    mapping(address => address[]) public creatorMarkets;

    // ================================
    // EVENTS
    // ================================

    event MarketCreated(
        address indexed market,
        address indexed creator,
        string question,
        uint256 endTime
    );

    event CreationFeeUpdated(uint256 newFee);

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _collateralToken,
        address _feeVault,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_collateralToken != address(0), "Invalid token");
        require(_feeVault != address(0), "Invalid vault");

        collateralToken = _collateralToken;
        feeVault = _feeVault;
    }

    // ================================
    // CREATE MARKET
    // ================================

    function createMarket(
        string memory question,
        uint256 endTime
    ) external returns (address) {
        require(bytes(question).length > 0, "Question required");
        require(endTime > block.timestamp, "Invalid end time");

        // Charge creation fee
        if (creationFee > 0) {
            require(
                IERC20(collateralToken).transferFrom(
                    msg.sender,
                    feeVault,
                    creationFee
                ),
                "Fee transfer failed"
            );
        }

        Market market = new Market(
            collateralToken,
            feeVault,
            endTime,
            question,
            msg.sender
        );

        address marketAddress = address(market);

        allMarkets.push(marketAddress);
        creatorMarkets[msg.sender].push(marketAddress);

        emit MarketCreated(marketAddress, msg.sender, question, endTime);

        return marketAddress;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function totalMarkets() external view returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    function getMarketsByCreator(
        address creator
    ) external view returns (address[] memory) {
        return creatorMarkets[creator];
    }

    // ================================
    // PAGINATION (SCALABLE)
    // ================================

    function getMarkets(
        uint256 start,
        uint256 count
    ) external view returns (address[] memory) {
        uint256 total = allMarkets.length;

        if (start >= total) {
            return new address[](0);
        }

        uint256 end = start + count;

        if (end > total) {
            end = total;
        }

        uint256 size = end - start;

        address[] memory markets = new address[](size);

        for (uint256 i = 0; i < size; i++) {
            markets[i] = allMarkets[start + i];
        }

        return markets;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setCreationFee(uint256 newFee) external onlyOwner {
        creationFee = newFee;

        emit CreationFeeUpdated(newFee);
    }
}
