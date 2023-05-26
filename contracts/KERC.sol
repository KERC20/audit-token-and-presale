// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import { // prettier-ignore
    ERC20, ERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import { // prettier-ignore
    ERC20Burnable
} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract KERC is ERC20Permit, ERC20Burnable {
    constructor(
        address _ecosystem,
        address _operations,
        address _reserves,
        address _vestingContract
    ) ERC20("KERC Token", "KERC") ERC20Permit("KERC Token") {
        uint256 million = 10 ** decimals() * 1e6;

        // Read more about token allocations here:
        // https://kerc.gitbook.io/kerc/tokenomics/usdkerc-token

        // Mint a total of 500M tokens into different wallets and contract

        // 350M - Ecosystem Rewards & Future Utility
        //  75M - Operations
        //  25M - Reserves
        //  50M - Vested: Team (40M) & Advisory (10M), see `_vestingContract`
        _mint(_ecosystem, 350 * million);
        _mint(_operations, 75 * million);
        _mint(_reserves, 25 * million);

        // These tokens are vested according to set schedule (starts after 12 months)
        // See `_vestingContract` for details and exact schedule
        _mint(_vestingContract, 50 * million);
    }
}
