// SPDX-License-Identifier: MIT
pragma solidity =0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import { // prettier-ignore
    ERC20, ERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract Token is ERC20Permit, Ownable {
    uint8 tokenDecimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) ERC20Permit(_name) {
        tokenDecimals = _decimals;
    }

    function mint(uint256 _amount) public {
        uint256 dec = 10 ** tokenDecimals;
        if (_amount > dec) {
            _amount /= dec;
        }
        _mint(msg.sender, _amount * dec);
    }

    function mintFor(address _account, uint256 _amount) public onlyOwner {
        _mint(_account, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return tokenDecimals;
    }
}
