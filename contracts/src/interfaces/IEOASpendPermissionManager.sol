// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import { SpendPermission, SpendPreview } from "./PaymasterTypes.sol";

/// @notice Intended v0 API. No implementation or deployment exists in the scaffold.
interface IEOASpendPermissionManager {
    event SpendPermissionApproved(bytes32 indexed permissionHash);
    event SpendPermissionRevoked(bytes32 indexed permissionHash);
    event SpendPermissionUsed(
        bytes32 indexed permissionHash,
        address indexed account,
        address indexed spender,
        uint160 amount,
        uint48 periodStart,
        uint48 periodEnd
    );

    function approve(SpendPermission calldata permission) external returns (bool approved);
    function revoke(SpendPermission calldata permission) external;
    function spend(SpendPermission calldata permission, uint160 amount) external;

    /// @dev Reverts if requested amount is not spendable in current state.
    ///      spendable is min(period remaining, token balance, token allowance), capped at uint160.
    function previewSpend(SpendPermission calldata permission, uint160 amount)
        external
        view
        returns (SpendPreview memory preview);

    function getHash(SpendPermission calldata permission) external view returns (bytes32);
}
