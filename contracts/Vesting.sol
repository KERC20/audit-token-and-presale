// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.18 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract KercVesting is Ownable {
    // prettier-ignore
    uint16[] schedulePct = [
        // 1st year intentionally left blank, see code in `vestedAmount()`
         50,  50,  50,  50,  50,  50, 100, 100, 100, 100, 100, 100, // 2nd year
        150, 150, 150, 150, 150, 150, 300, 300, 300, 300, 300, 300, // 3rd year
        400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, // 4th year
        400, 400, 400, 400                                          // 5th year
    ];
    uint256 private constant monthInSeconds = 2628000; // 365 / 12 * 3600 * 24
    address public token;
    address public receiver;
    uint256 public startTime;
    uint256 public initialBalance;
    uint256 public released;

    event VestingStarted(
        address indexed token,
        uint256 amount,
        uint256 _startTime
    );
    event ERC20Released(address indexed token, uint256 amount);

    constructor(address _receiver) {
        receiver = _receiver;
    }

    function vestedAmount() public view returns (uint256) {
        uint16[] memory vSchedule = schedulePct;
        uint256 scheduleLen = vSchedule.length;
        uint256 elapsedMonths = (block.timestamp - startTime) / monthInSeconds;

        // One year cliff
        elapsedMonths = elapsedMonths > 12 ? elapsedMonths - 12 : 0;
        if (elapsedMonths == 0) {
            return 0;
        }

        uint16 pct;
        for (uint32 i; i < scheduleLen && i < elapsedMonths; ) {
            pct += vSchedule[i];
            unchecked {
                ++i;
            }
        }

        return (initialBalance * pct) / 1e4;
    }

    function releasable() public view returns (uint256) {
        return vestedAmount() - released;
    }

    function start(address _token, uint256 _amount) public {
        require(tx.origin == owner(), "ERR:NOT_OWNER");
        require(startTime == 0, "ERR:ALREADY_STARTED");
        require(_token != address(0), "ERR:ZERO_ADDR_NOT_ALLOWED");

        token = _token;
        initialBalance = _amount;
        startTime = block.timestamp;

        emit VestingStarted(_token, _amount, startTime);
    }

    function release() public {
        uint256 vested = vestedAmount();
        require(vested > released, "ERR:NOTHING_TO_RELEASE");

        uint256 amount = vested - released;
        released = vested;

        IERC20(token).transfer(receiver, amount);

        emit ERC20Released(token, amount);
    }

    function setReceiver(address _receiver) public onlyOwner {
        receiver = _receiver;
    }

    function emergencyWithdrawETH(address _receiver) public onlyOwner {
        payable(_receiver).transfer(address(this).balance);
    }

    // Withdraw any token except the vesting token
    function emergencyWithdrawToken(
        address _token,
        address _receiver
    ) public onlyOwner {
        require(token != _token, "ERR:CANT_WITHDRAW_VESTING_TOKEN");

        IERC20 t = IERC20(_token);
        t.transfer(_receiver, t.balanceOf(address(this)));
    }

    receive() external payable {}

    fallback() external payable {}
}
