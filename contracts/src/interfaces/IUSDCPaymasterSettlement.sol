// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

interface IUSDCPaymasterSettlement {
    event Settled(
        address indexed sender,
        address indexed payer,
        uint256 measuredWrapperGas,
        uint256 billingOverheadGas,
        uint256 stablecoinUsed,
        uint256 stablecoinRefunded,
        uint256 ethReplenished
    );

    /// @dev Only the native sender's trusted account in Preparing phase may reserve.
    function reserve(uint256 maxGasUSDC) external;

    /// @dev Only Settling phase. Read meteringContext; never trust a calldata gas amount.
    function settle() external;
}
