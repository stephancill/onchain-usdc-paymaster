// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice Pinned draft API, not an assertion of Vibenet getter availability.
/// @dev The reference contract interface differs. See docs/protocol-compatibility.md, G04.
interface ITransactionContext {
    struct Call {
        address to;
        bytes data;
    }

    function getTransactionSender() external view returns (address);
    function getTransactionPayer() external view returns (address);
    function getTransactionCalls() external view returns (Call[][] memory);
    function getTransactionGasLimit() external view returns (uint256);
    function getTransactionSenderActorId() external view returns (bytes32);
}
