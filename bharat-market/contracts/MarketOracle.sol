// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
// MarketOracle.sol  (upgraded)
//
// Security layer between any oracle system and Market contracts.
// Only authorized callers (e.g. ChainlinkFunctionsOracle) can
// trigger resolution. Supports multiple oracle sources.
//
// Flow:
//   ChainlinkFunctionsOracle.fulfillRequest()
//       → MarketOracle.resolveMarket(market, outcome)
//       → Market.resolveFromOracle(outcome)
// ============================================================

import "@openzeppelin/contracts/access/Ownable.sol";

interface IMarket {
    function resolveFromOracle(uint8 outcome) external;
}

contract MarketOracle is Ownable {

    // -----------------------------------------------
    // State
    // -----------------------------------------------

    /// @notice Addresses authorized to call resolveMarket()
    ///         Typically: ChainlinkFunctionsOracle (and owner for manual override)
    mapping(address => bool) public authorizedCallers;

    // -----------------------------------------------
    // Events
    // -----------------------------------------------

    event MarketResolved(address indexed market, uint8 outcome, address caller);
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    // -----------------------------------------------
    // Modifier
    // -----------------------------------------------

    modifier onlyAuthorized() {
        require(
            authorizedCallers[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    // -----------------------------------------------
    // Constructor
    // -----------------------------------------------

    constructor() Ownable(msg.sender) {
        // Owner is authorized by default (for manual emergency resolution)
        authorizedCallers[msg.sender] = true;
        emit CallerAuthorized(msg.sender);
    }

    // -----------------------------------------------
    // Core: Resolve
    // -----------------------------------------------

    /// @notice Resolve a market with an outcome.
    /// @param market  Address of the Market contract.
    /// @param outcome 1 = YES wins, 2 = NO wins.
    function resolveMarket(address market, uint8 outcome) external onlyAuthorized {
        require(market != address(0), "Invalid market");
        require(outcome == 1 || outcome == 2, "Invalid outcome");

        IMarket(market).resolveFromOracle(outcome);

        emit MarketResolved(market, outcome, msg.sender);
    }

    // -----------------------------------------------
    // Admin: Caller Management
    // -----------------------------------------------

    /// @notice Authorize an address to call resolveMarket().
    ///         Call this after deploying ChainlinkFunctionsOracle.
    function authorizeCaller(address caller) external onlyOwner {
        require(caller != address(0), "Invalid address");
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    /// @notice Revoke authorization.
    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }
}
