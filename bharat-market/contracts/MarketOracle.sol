// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarket {
    function resolveFromOracle(uint8 outcome) external;
}

contract MarketOracle {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only operator");
        _;
    }

    function resolveMarket(address market, uint8 outcome) external onlyOwner {
        require(market != address(0), "Invalid market");
        require(outcome == 1 || outcome == 2, "Invalid outcome");

        IMarket(market).resolveFromOracle(outcome);
    }
}
