// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
// ChainlinkFunctionsOracle.sol
//
// Responsibilities:
//   1. Accept resolution requests for any deployed Market
//   2. Build a Chainlink Functions JS request using the
//      market's oracleType + oracleQuery metadata
//   3. Map the Chainlink requestId → market address
//   4. On fulfillment, route the result through MarketOracle
//      (never calls Market directly)
//
// Resolution flow:
//   requestMarketResolution(market)
//       → Chainlink Functions executes JS
//       → JS fetches external API, returns uint8 (1=YES, 2=NO)
//       → fulfillRequest()
//       → IMarketOracle.resolveMarket(market, outcome)
//       → Market.resolveFromOracle(outcome)
// ============================================================

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// -----------------------------------------------
// Interfaces
// -----------------------------------------------

interface IMarketMeta {
    function oracleType() external view returns (string memory);
    function oracleQuery() external view returns (string memory);
    function endTime() external view returns (uint256);
    function resolved() external view returns (bool);
}

interface IMarketOracle {
    function resolveMarket(address market, uint8 outcome) external;
}

// -----------------------------------------------
// Contract
// -----------------------------------------------

contract ChainlinkFunctionsOracle is FunctionsClient, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;

    // -----------------------------------------------
    // State
    // -----------------------------------------------

    /// @notice Chainlink DON identifier for Polygon Amoy
    bytes32 public donId;

    /// @notice Chainlink Functions subscription ID
    uint64 public subscriptionId;

    /// @notice Gas limit for the Chainlink callback
    uint32 public constant CALLBACK_GAS_LIMIT = 300_000;

    /// @notice MarketOracle — all resolutions must go through here
    address public marketOracle;

    /// @notice Maps Chainlink requestId → market address
    mapping(bytes32 => address) public requestToMarket;

    /// @notice Tracks pending request per market (prevents duplicate requests)
    mapping(address => bytes32) public marketPendingRequest;

    // -----------------------------------------------
    // Events
    // -----------------------------------------------

    event ResolutionRequested(
        bytes32 indexed requestId,
        address indexed market,
        string oracleType,
        string oracleQuery
    );

    event ResolutionFulfilled(
        bytes32 indexed requestId,
        address indexed market,
        uint8 outcome
    );

    event ResolutionFailed(
        bytes32 indexed requestId,
        address indexed market,
        bytes error
    );

    event MarketOracleUpdated(address newOracle);
    event SubscriptionUpdated(uint64 newSubId);
    event DonIdUpdated(bytes32 newDonId);

    // -----------------------------------------------
    // Constructor
    // -----------------------------------------------

    /// @param router        Chainlink Functions Router on Polygon Amoy
    ///                      (0xC22a79eBA640940ABB6dF0f7982cc119578E11De)
    /// @param _donId        DON ID for Polygon Amoy
    ///                      (fun-polygon-amoy-1 → bytes32 encoded)
    /// @param _subId        Chainlink Functions subscription ID (fund with LINK)
    /// @param _marketOracle Address of MarketOracle.sol
    constructor(
        address router,
        bytes32 _donId,
        uint64 _subId,
        address _marketOracle
    ) FunctionsClient(router) Ownable(msg.sender) {
        require(router != address(0), "Invalid router");
        require(_marketOracle != address(0), "Invalid MarketOracle");

        donId = _donId;
        subscriptionId = _subId;
        marketOracle = _marketOracle;
    }

    // -----------------------------------------------
    // Core: Request Resolution
    // -----------------------------------------------

    /// @notice Initiates a Chainlink Functions call to resolve a market.
    /// @dev    Reads oracleType + oracleQuery from the market contract,
    ///         passes them as args to the JS script, and stores the
    ///         requestId → market mapping for fulfillment routing.
    /// @param market Address of the Market contract to resolve.
    function requestMarketResolution(address market) external returns (bytes32 requestId) {
        require(market != address(0), "Invalid market");

        IMarketMeta meta = IMarketMeta(market);

        require(!meta.resolved(), "Market already resolved");
        require(block.timestamp >= meta.endTime(), "Market not ended yet");

        // Prevent duplicate in-flight requests
        bytes32 existing = marketPendingRequest[market];
        require(existing == bytes32(0), "Request already pending");

        string memory oType  = meta.oracleType();
        string memory oQuery = meta.oracleQuery();

        // Build the Chainlink Functions request
        FunctionsRequest.Request memory req;

        // Inline JS source — calls the oracle script stored in this contract
        req.initializeRequestForInlineJavaScript(_buildOracleSource());

        // Pass oracleType and oracleQuery as args so the JS can branch on them
        string[] memory args = new string[](2);
        args[0] = oType;
        args[1] = oQuery;
        req.setArgs(args);

        // Send to Chainlink DON
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            CALLBACK_GAS_LIMIT,
            donId
        );

        // Store mapping
        requestToMarket[requestId] = market;
        marketPendingRequest[market] = requestId;

        emit ResolutionRequested(requestId, market, oType, oQuery);
    }

    // -----------------------------------------------
    // Core: Fulfill (called by Chainlink DON)
    // -----------------------------------------------

    /// @dev Called by the Chainlink Functions Router after the JS executes.
    ///      Routes the result through MarketOracle — never touches Market directly.
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        address market = requestToMarket[requestId];
        require(market != address(0), "Unknown requestId");

        // Clear pending request
        delete marketPendingRequest[market];

        // Handle oracle-side errors
        if (err.length > 0) {
            emit ResolutionFailed(requestId, market, err);
            return;
        }

        // Decode outcome — JS must return abi.encode(uint256) with value 1 or 2
        uint256 raw = abi.decode(response, (uint256));
        require(raw == 1 || raw == 2, "Invalid outcome from oracle");

        uint8 outcome = uint8(raw);

        // Route through MarketOracle (security layer)
        IMarketOracle(marketOracle).resolveMarket(market, outcome);

        emit ResolutionFulfilled(requestId, market, outcome);
    }

    // -----------------------------------------------
    // Oracle JavaScript Source
    // -----------------------------------------------

    /// @dev Returns the inline JS executed by Chainlink Functions.
    ///      args[0] = oracleType  (e.g. "crypto", "sports", "election")
    ///      args[1] = oracleQuery (e.g. "bitcoin_price", "csk_vs_mi")
    ///
    ///      The script must return: Functions.encodeUint256(1) or (2)
    function _buildOracleSource() internal pure returns (string memory) {
        return
            "const oracleType  = args[0];"
            "const oracleQuery = args[1];"
            ""
            "let outcome;"
            ""
            "if (oracleType === 'crypto') {"
            "  const coin = oracleQuery.replace('_price', '');"
            "  const url  = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`;"
            "  const res  = await Functions.makeHttpRequest({ url });"
            "  if (res.error) throw Error('CoinGecko fetch failed');"
            "  const price     = res.data[coin].usd;"
            "  const threshold = 100000;"
            "  outcome = price >= threshold ? 1 : 2;"
            ""
            "} else if (oracleType === 'sports') {"
            "  const apiKey = secrets.ODDS_API_KEY;"
            "  const url    = `https://api.the-odds-api.com/v4/sports/cricket_ipl/scores/?apiKey=${apiKey}&daysFrom=1`;"
            "  const res    = await Functions.makeHttpRequest({ url });"
            "  if (res.error) throw Error('Odds API fetch failed');"
            "  const games  = res.data;"
            "  const parts  = oracleQuery.split('_vs_');"
            "  const home   = parts[0].toUpperCase();"
            "  const away   = parts[1].toUpperCase();"
            "  const game   = games.find(g =>"
            "    g.home_team.toUpperCase().includes(home) &&"
            "    g.away_team.toUpperCase().includes(away)"
            "  );"
            "  if (!game || !game.completed) throw Error('Game not completed');"
            "  const homeScore = game.scores?.find(s => s.name === game.home_team)?.score ?? 0;"
            "  const awayScore = game.scores?.find(s => s.name === game.away_team)?.score ?? 0;"
            "  outcome = homeScore > awayScore ? 1 : 2;"
            ""
            "} else if (oracleType === 'election') {"
            "  throw Error('Election oracle: manual resolution required');"
            ""
            "} else {"
            "  throw Error('Unknown oracleType: ' + oracleType);"
            "}"
            ""
            "return Functions.encodeUint256(outcome);";
    }

    // -----------------------------------------------
    // Admin
    // -----------------------------------------------

    function setMarketOracle(address _marketOracle) external onlyOwner {
        require(_marketOracle != address(0), "Invalid address");
        marketOracle = _marketOracle;
        emit MarketOracleUpdated(_marketOracle);
    }

    function setSubscriptionId(uint64 _subId) external onlyOwner {
        subscriptionId = _subId;
        emit SubscriptionUpdated(_subId);
    }

    function setDonId(bytes32 _donId) external onlyOwner {
        donId = _donId;
        emit DonIdUpdated(_donId);
    }

    /// @notice Emergency: clear a stuck pending request without resolving
    function clearPendingRequest(address market) external onlyOwner {
        bytes32 reqId = marketPendingRequest[market];
        require(reqId != bytes32(0), "No pending request");
        delete marketPendingRequest[market];
        delete requestToMarket[reqId];
    }
}
