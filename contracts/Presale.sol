// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Presale for the KERC token
/// @author snorkypie
contract KercPresale is Ownable {
    ERC20Permit public raiseToken;
    mapping(address => uint256) public balances;
    address[] public allBalances;
    address payable public raiseReceiver;
    uint256 public hardCap;
    uint256 public totalBalance;
    uint256 public startTime;
    uint256 public endTime;

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
        address _raiseToken,
        uint256 _hardCap,
        uint32 _startTime,
        uint32 _endTime
    ) {
        require(_raiseReceiver != address(0), "ERR:ZERO_ADDR:RECEIVER");
        require(_raiseToken != address(0), "ERR:ZERO_ADDR:TOKEN");
        require(_startTime > 0, "ERR:START_TIME");
        require(_endTime > 0, "ERR:END_TIME");
        require(_startTime < _endTime, "ERR:START_LT_END");

        raiseReceiver = _raiseReceiver;
        raiseToken = ERC20Permit(_raiseToken);
        hardCap = _hardCap * 10 ** ERC20Permit(_raiseToken).decimals();
        startTime = _startTime;
        endTime = _endTime;
    }

    function open() public view returns (bool) {
        return
            startTime <= block.timestamp &&
            endTime >= block.timestamp &&
            totalBalance < hardCap;
    }

    /// @dev Regular approval + transfer dance
    function deposit(uint256 _amount) public canDeposit(_amount) {
        _deposit(_amount);
    }

    /// @dev Signed permit + transfer
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

    /// @dev End time can only be extended
    function setEndTime(uint32 _endTime) public onlyOwner {
        require(_endTime > endTime, "ERR:END_ONLY_EXTEND");

        endTime = _endTime;
    }

    /// @notice If for some reason someone sends ETH to this contract
    function withdrawETH() external onlyOwner {
        raiseReceiver.transfer(address(this).balance);
    }

    /// @notice If for some reason someone sends ERC20 tokens to this contract
    function withdraw(IERC20 _token) external onlyOwner {
        _token.transfer(raiseReceiver, _token.balanceOf(address(this)));
    }
}
