// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import {ERC20, ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract USDT is ERC20Permit {
    constructor()
        ERC20("Tether USD KERC", "USDT-KERC")
        ERC20Permit("Tether USD KERC")
    {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
