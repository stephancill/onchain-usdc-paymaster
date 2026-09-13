// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice Vibenet's modified zero-fee V2 helper. Do not use with ordinary 0.3%-fee pairs.
interface IZeroFeeV2SwapHelper {
    function swapExactOut(address tokenIn, address pair, uint256 amountOut, uint256 maxIn)
        external
        returns (uint256 amountIn);
}

interface IZeroFeeV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IWrappedETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}
