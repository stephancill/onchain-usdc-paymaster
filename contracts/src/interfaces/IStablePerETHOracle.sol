// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

interface IStablePerETHOracle {
    /// @return stablePerEthE6 Stablecoin base units (1e6) per one ETH (1e18 wei).
    /// @return updatedAt Price timestamp in seconds; caller enforces freshness and validity.
    function read() external view returns (uint256 stablePerEthE6, uint256 updatedAt);
}
