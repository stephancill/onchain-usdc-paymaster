// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import { SponsoredExecution, UserCall, MeteringContext } from "./PaymasterTypes.sol";

/// @notice Intended account API; implementation must enforce native self-call and lifecycle guards.
interface IMeteredUSDCAccount {
    event SponsoredExecutionCompleted(
        address indexed payer,
        bytes32 indexed permissionHash,
        bool userCallsSucceeded,
        uint256 measuredWrapperGas,
        bytes failurePrefix,
        uint256 failureDataSize
    );

    function executeSponsored(SponsoredExecution calldata request)
        external
        returns (bool userCallsSucceeded);

    /// @dev One-shot, batch-hash-bound self-call only. Never a generic externally usable executor.
    function executeUserBatch(UserCall[] calldata calls) external;

    function meteringContext() external view returns (MeteringContext memory);
}
