// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract KercPresale is Ownable {
    ERC20Permit public raiseToken;
    mapping(address => uint256) public balances;
    address[] public allBalances;
    address payable public raiseReceiver;
    uint256 public hardCap;
    uint256 public totalBalance;
    uint256 public startTime;
    uint256 public endTime;
    bool public isClosed;

    event Deposit(address indexed user, uint256 amount);

    function _canDeposit(uint256 _amount) private view {
        require(open(), "ERR:NOT_OPEN");
        require(_amount > 0, "ERR:AMOUNT");
        require(totalBalance + _amount <= hardCap, "ERR:AMT_TOO_BIG");
    }

    modifier canDeposit(uint256 _amount) {
        _canDeposit(_amount);
        _;
    }

    constructor(
        address payable _raiseReceiver,
        ERC20Permit _raiseToken,
        uint256 _hardCap,
        uint32 _startTime,
        uint32 _endTime
    ) {
        raiseReceiver = _raiseReceiver;
        raiseToken = _raiseToken;
        hardCap = _hardCap * 10 ** _raiseToken.decimals();
        startTime = _startTime;
        endTime = _endTime;
    }

    function open() public view returns (bool) {
        return
            !isClosed &&
            startTime > 0 &&
            endTime > 0 &&
            startTime <= block.timestamp &&
            endTime >= block.timestamp &&
            totalBalance < hardCap;
    }

    // Regular approval + transfer dance
    function deposit(uint256 _amount) public canDeposit(_amount) {
        _deposit(_amount);
    }

    // Signed permit + transfer
    function depositWithPermit(
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public canDeposit(_amount) {
        SafeERC20.safePermit(
            raiseToken,
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );
        _deposit(_amount);
    }

    function _deposit(uint256 _amount) private {
        address user = msg.sender;

        SafeERC20.safeTransferFrom(raiseToken, user, raiseReceiver, _amount);

        if (balances[user] == 0) {
            allBalances.push(user);
        }

        unchecked {
            balances[user] += _amount;
            totalBalance += _amount;
        }

        emit Deposit(user, _amount);
    }

    function numberOfDepositors() external view returns (uint256) {
        return allBalances.length;
    }

    function setClosed(bool _closed) public onlyOwner {
        isClosed = _closed;
    }

    function setHardCap(uint256 _hardCap) public onlyOwner {
        hardCap = _hardCap * 10 ** raiseToken.decimals();
    }

    function setRaiseReceiver(address payable _raiseReceiver) public onlyOwner {
        require(_raiseReceiver != address(0), "ERR:INCORRECT_ADDR");

        raiseReceiver = _raiseReceiver;
    }

    function setTimes(uint32 _startTime, uint32 _endTime) public onlyOwner {
        require(_startTime <= _endTime, "ERR:START_GT_END");

        startTime = _startTime;
        endTime = _endTime;
    }

    function setStartTime(uint32 _startTime) public onlyOwner {
        require(_startTime <= endTime, "ERR:START_GT_END");
        startTime = _startTime;
    }

    function setEndTime(uint32 _endTime) public onlyOwner {
        require(startTime <= _endTime, "ERR:START_GT_END");
        endTime = _endTime;
    }

    // If for some reason someone sends ETH to this contract
    function withdrawETH() external onlyOwner {
        raiseReceiver.transfer(address(this).balance);
    }

    // If for some reason someone sends ERC20 tokens to this contract
    function withdraw(IERC20 _token) external onlyOwner {
        _token.transfer(raiseReceiver, _token.balanceOf(address(this)));
    }
}
