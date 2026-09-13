// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice Draft EIP-8130 interface. Native compatibility is an M0 evidence gate.
interface IAuthenticator {
    function authenticate(bytes32 hash, bytes calldata data) external view returns (bytes32 actorId);
}
