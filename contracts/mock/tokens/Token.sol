// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import { // prettier-ignore
    ERC20, ERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract Token is ERC20Permit {
    uint8 tokenDecimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) ERC20Permit(_name) {
        tokenDecimals = _decimals;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return tokenDecimals;
    }
}
