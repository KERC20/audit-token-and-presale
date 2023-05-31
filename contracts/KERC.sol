// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import { // prettier-ignore
    ERC20, ERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import { // prettier-ignore
    ERC20Burnable
} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IKercVesting {
    function start(address, uint256) external;
}

/// @title The KERC token
/// @author snorkypie
contract KERC is ERC20Permit, ERC20Burnable {
    /// Read more about token allocations here:
    /// https://kerc.gitbook.io/kerc/tokenomics/usdkerc-token
    constructor(
        address _ecosystem,
        address _operations,
        address _reserves,
        address _vestingContract
    ) ERC20("KERC Token", "KERC") ERC20Permit("KERC Token") {
        uint256 million = 10 ** decimals() * 1e6;

        _mint(_ecosystem,       350 * million); // prettier-ignore
        _mint(_operations,       75 * million); // prettier-ignore
        _mint(_reserves,         25 * million); // prettier-ignore
        _mint(_vestingContract,  50 * million); // prettier-ignore

        /// @notice Initiate vesting of Team and Advisory tokens
        IKercVesting(_vestingContract).start(address(this), 50 * million);
    }
}
