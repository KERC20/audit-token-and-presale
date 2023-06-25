// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.18;

contract FundEther {
    constructor() payable {}

    function destroy(address _target) public {
        selfdestruct(payable(_target));
    }
}
