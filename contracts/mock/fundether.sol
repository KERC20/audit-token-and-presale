// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.18;

contract FundEther {
    address payable private immutable target;

    constructor(address _target) payable {
        target = payable(_target);
    }

    function destroy() public {
        selfdestruct(target);
    }
}
