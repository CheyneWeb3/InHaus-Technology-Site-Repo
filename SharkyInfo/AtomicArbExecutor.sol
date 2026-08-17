// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title AtomicArbExecutor
/// @notice Executes allowlisted EVM swap calls atomically and reverts unless the configured
///         profit token finishes above its full starting balance by at least minProfit.
/// @dev Designed for prefunded inventory. All approvals are exact and cleared after each step.
contract AtomicArbExecutor {
    error Unauthorized();
    error Paused();
    error ReentrantCall();
    error DeadlineExpired();
    error InvalidAddress();
    error InvalidAmount();
    error TooManySteps();
    error TargetNotAllowed(address target);
    error SpenderNotAllowed(address spender);
    error InsufficientBalance(uint256 got, uint256 need);
    error TradeLimitExceeded(uint256 requested, uint256 maximum);
    error ExternalCallFailed(uint256 step, address target, bytes reason);
    error ProfitTooLow(uint256 got, uint256 want);
    error PrincipalFloorViolation(uint256 remaining, uint256 floor);
    error SweepDisabled();
    error SweepTooSmall(uint256 amount, uint256 minimum);
    error TokenOperationFailed(address token);
    error GasPriceTooHigh(uint256 got, uint256 maximum);
    error NativeValueNotAllowed(uint256 step, uint256 value);

    struct RouteStep {
        address target;
        address approvalToken;
        address spender;
        uint256 approvalAmount;
        uint256 value;
        bytes data;
    }

    address public owner;
    address public operator;
    address public treasury;

    bool public paused;
    bool public sweepEnabled;
    uint256 public sweepMinAmount;
    uint256 public maxGasPriceWei;
    uint8 public maxRouteSteps = 8;

    mapping(address => bool) public allowedTargets;
    mapping(address => bool) public allowedSpenders;
    mapping(address => uint256) public principalFloor;
    mapping(address => uint256) public maxTradeAmount;

    uint256 private locked = 1;

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event OperatorUpdated(address indexed operator);
    event TreasuryUpdated(address indexed treasury);
    event PauseUpdated(bool paused);
    event TargetUpdated(address indexed target, bool allowed);
    event SpenderUpdated(address indexed spender, bool allowed);
    event PrincipalFloorUpdated(address indexed token, uint256 floor);
    event MaxTradeAmountUpdated(address indexed token, uint256 maximum);
    event SweepPolicyUpdated(bool enabled, uint256 minimumAmount);
    event MaxGasPriceUpdated(uint256 maximum);
    event MaxRouteStepsUpdated(uint8 maximum);
    event AtomicArbitrage(
        bytes32 indexed routeId,
        address indexed profitToken,
        uint256 amountIn,
        uint256 startBalance,
        uint256 endBalance,
        uint256 profit,
        uint256 steps
    );
    event ExcessSwept(address indexed token, address indexed treasury, uint256 amount, uint256 remaining);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address initialOwner, address initialOperator, address initialTreasury) {
        if (initialOwner == address(0) || initialOperator == address(0) || initialTreasury == address(0)) {
            revert InvalidAddress();
        }
        owner = initialOwner;
        operator = initialOperator;
        treasury = initialTreasury;
        emit OwnershipTransferred(address(0), initialOwner);
        emit OperatorUpdated(initialOperator);
        emit TreasuryUpdated(initialTreasury);
    }

    receive() external payable {}

    function executeAtomic(
        bytes32 routeId,
        address profitToken,
        uint256 amountIn,
        uint256 minProfit,
        uint256 deadline,
        RouteStep[] calldata steps
    ) external onlyOperator nonReentrant returns (uint256 profit) {
        if (paused) revert Paused();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (profitToken == address(0)) revert InvalidAddress();
        if (amountIn == 0 || minProfit == 0) revert InvalidAmount();
        if (steps.length == 0 || steps.length > maxRouteSteps) revert TooManySteps();
        if (maxGasPriceWei != 0 && tx.gasprice > maxGasPriceWei) {
            revert GasPriceTooHigh(tx.gasprice, maxGasPriceWei);
        }

        uint256 maximum = maxTradeAmount[profitToken];
        if (maximum != 0 && amountIn > maximum) revert TradeLimitExceeded(amountIn, maximum);

        uint256 startBalance = IERC20Minimal(profitToken).balanceOf(address(this));
        uint256 floor = principalFloor[profitToken];
        uint256 requiredStartingBalance = floor > amountIn ? floor : amountIn;
        if (startBalance < requiredStartingBalance) {
            revert InsufficientBalance(startBalance, requiredStartingBalance);
        }

        uint256 profitTokenApproved;
        for (uint256 i = 0; i < steps.length; ++i) {
            RouteStep calldata step = steps[i];
            if (!allowedTargets[step.target]) revert TargetNotAllowed(step.target);
            if (step.data.length < 4) revert ExternalCallFailed(i, step.target, bytes("empty calldata"));
            if (step.value != 0) revert NativeValueNotAllowed(i, step.value);

            uint256 approved;
            if (step.approvalToken != address(0)) {
                if (!allowedSpenders[step.spender]) revert SpenderNotAllowed(step.spender);
                uint256 currentBalance = IERC20Minimal(step.approvalToken).balanceOf(address(this));
                approved = step.approvalAmount;
                if (approved == 0 || approved > currentBalance) {
                    revert InsufficientBalance(currentBalance, approved);
                }
                if (step.approvalToken == profitToken) {
                    profitTokenApproved += approved;
                    if (profitTokenApproved > amountIn) revert TradeLimitExceeded(profitTokenApproved, amountIn);
                }
                _forceApprove(step.approvalToken, step.spender, approved);
            } else if (step.spender != address(0) || step.approvalAmount != 0) {
                revert InvalidAmount();
            }

            (bool ok, bytes memory reason) = step.target.call(step.data);

            if (step.approvalToken != address(0)) {
                _forceApprove(step.approvalToken, step.spender, 0);
            }
            if (!ok) revert ExternalCallFailed(i, step.target, reason);
        }

        uint256 endBalance = IERC20Minimal(profitToken).balanceOf(address(this));
        if (endBalance < startBalance) revert ProfitTooLow(0, minProfit);
        profit = endBalance - startBalance;
        if (profit < minProfit) revert ProfitTooLow(profit, minProfit);
        if (endBalance < floor) revert PrincipalFloorViolation(endBalance, floor);

        emit AtomicArbitrage(routeId, profitToken, amountIn, startBalance, endBalance, profit, steps.length);
    }

    function sweepExcess(address token, uint256 requestedAmount) external onlyOperator nonReentrant returns (uint256 amount) {
        if (!sweepEnabled) revert SweepDisabled();
        if (token == address(0)) revert InvalidAddress();
        uint256 balance = IERC20Minimal(token).balanceOf(address(this));
        uint256 floor = principalFloor[token];
        if (balance <= floor) revert PrincipalFloorViolation(balance, floor);
        uint256 excess = balance - floor;
        amount = requestedAmount == type(uint256).max ? excess : requestedAmount;
        if (amount == 0) revert InvalidAmount();
        if (amount > excess) revert PrincipalFloorViolation(0, floor);
        if (amount < sweepMinAmount) revert SweepTooSmall(amount, sweepMinAmount);
        _safeTransfer(token, treasury, amount);
        emit ExcessSwept(token, treasury, amount, balance - amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert InvalidAddress();
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseUpdated(value);
    }

    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        if (target == address(0)) revert InvalidAddress();
        allowedTargets[target] = allowed;
        emit TargetUpdated(target, allowed);
    }

    function setAllowedSpender(address spender, bool allowed) external onlyOwner {
        if (spender == address(0)) revert InvalidAddress();
        allowedSpenders[spender] = allowed;
        emit SpenderUpdated(spender, allowed);
    }

    function setPrincipalFloor(address token, uint256 floor) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        principalFloor[token] = floor;
        emit PrincipalFloorUpdated(token, floor);
    }

    function setMaxTradeAmount(address token, uint256 maximum) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        maxTradeAmount[token] = maximum;
        emit MaxTradeAmountUpdated(token, maximum);
    }

    function setSweepPolicy(bool enabled, uint256 minimumAmount) external onlyOwner {
        sweepEnabled = enabled;
        sweepMinAmount = minimumAmount;
        emit SweepPolicyUpdated(enabled, minimumAmount);
    }

    function setMaxGasPriceWei(uint256 maximum) external onlyOwner {
        maxGasPriceWei = maximum;
        emit MaxGasPriceUpdated(maximum);
    }

    function setMaxRouteSteps(uint8 maximum) external onlyOwner {
        if (maximum == 0 || maximum > 16) revert InvalidAmount();
        maxRouteSteps = maximum;
        emit MaxRouteStepsUpdated(maximum);
    }

    /// @notice Emergency recovery is intentionally owner-only and available only while paused.
    function emergencyTransfer(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (!paused) revert Paused();
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        _safeTransfer(token, to, amount);
    }

    function emergencyTransferNative(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (!paused) revert Paused();
        if (to == address(0)) revert InvalidAddress();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert ExternalCallFailed(0, to, bytes("native transfer failed"));
    }

    function _forceApprove(address token, address spender, uint256 amount) internal {
        if (!_callOptionalReturn(token, abi.encodeWithSelector(IERC20Minimal.approve.selector, spender, 0))) {
            revert TokenOperationFailed(token);
        }
        if (amount != 0 && !_callOptionalReturn(token, abi.encodeWithSelector(IERC20Minimal.approve.selector, spender, amount))) {
            revert TokenOperationFailed(token);
        }
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        if (!_callOptionalReturn(token, abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, amount))) {
            revert TokenOperationFailed(token);
        }
    }

    function _callOptionalReturn(address token, bytes memory data) internal returns (bool) {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok) return false;
        return ret.length == 0 || (ret.length == 32 && abi.decode(ret, (bool)));
    }
}
