// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice Permission fields adapted from Coinbase SpendPermissionManager (MIT).
/// @dev See docs/third-party-notices.md. v0 requires extraData empty and token == stablecoin.
struct SpendPermission {
    address account;
    address spender;
    address token;
    uint160 allowance;
    uint48 period;
    uint48 start;
    uint48 end;
    uint256 salt;
    bytes extraData;
}

/// @notice Bounded preview under the current block's state; does not reserve funds.
struct SpendPreview {
    bytes32 permissionHash;
    uint48 periodStart;
    uint48 periodEnd;
    uint160 periodSpent;
    uint160 spendable;
}

/// @notice Account calls have no native-value field in the sponsored v0 API.
struct UserCall {
    address to;
    bytes data;
}

struct SponsoredExecution {
    SpendPermission permission;
    uint160 withdrawalAmount;
    uint256 maxGasUSDC;
    uint256 userCallGasLimit;
    UserCall[] userCalls;
}

enum ExecutionPhase {
    Idle,
    Preparing,
    Executing,
    Settling
}

/// @notice Produced by trusted account code, never accepted as caller-supplied billing input.
struct MeteringContext {
    ExecutionPhase phase;
    address settlement;
    uint256 maxGasUSDC;
    uint256 measuredWrapperGas;
    bool userCallsSucceeded;
}
