// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LiquidityToken is ERC20 {
    address public immutable market;

    constructor(
        string memory name_,
        string memory symbol_,
        address market_
    ) ERC20(name_, symbol_) {
        market = market_;
    }

    modifier onlyMarket() {
        require(msg.sender == market, "Only market");
        _;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMarket {
        _burn(from, amount);
    }
}
