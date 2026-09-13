import { describe, expect, test } from "bun:test";
import { parseSponsoredExecution } from "../src/execution";

const sender = "0x000000000000000000000000000000000000000a";
const fundingAccount = "0x000000000000000000000000000000000000000b";
const stablecoin = "0x000000000000000000000000000000000000000c";
function request() {
  return {
    permission: {
      account: fundingAccount,
      spender: sender,
      token: stablecoin,
      allowance: 100_000_000n,
      period: 86400n,
      start: 1n,
      end: 86401n,
      salt: 0n,
      extraData: "0x",
    },
    withdrawalAmount: 20_000_000n,
    maxGasUSDC: 5_000_000n,
    userCallGasLimit: 100_000n,
    userCalls: [{ to: stablecoin, data: "0x" }],
  };
}

describe("sponsored execution boundary", () => {
  test("separates withdrawal principal from the gas ceiling", () => {
    const parsed = parseSponsoredExecution({ input: request(), sender, stablecoin });
    expect(parsed.withdrawalAmount - parsed.maxGasUSDC).toBe(15_000_000n);
  });

  test("cannot use another spender's permission", () => {
    const input = request();
    input.permission.spender = fundingAccount;
    expect(() => parseSponsoredExecution({ input, sender, stablecoin })).toThrow(
      "executing account",
    );
  });

  test("rejects token substitution and invalid funding limits", () => {
    const input = request();
    input.permission.token = fundingAccount;
    expect(() => parseSponsoredExecution({ input, sender, stablecoin })).toThrow(
      "configured stablecoin",
    );
    input.permission.token = stablecoin;
    input.maxGasUSDC = input.withdrawalAmount + 1n;
    expect(() => parseSponsoredExecution({ input, sender, stablecoin })).toThrow(
      "cover the gas ceiling",
    );
  });

  test("rejects self-execution, native-value calls and odd-length bytes", () => {
    const input = request();
    input.userCalls = [{ to: sender, data: "0x" }];
    expect(() => parseSponsoredExecution({ input, sender, stablecoin })).toThrow("self-calls");
    expect(() =>
      parseSponsoredExecution({
        input: {
          ...request(),
          userCalls: [{ to: stablecoin, data: "0x", value: 1n }],
        },
        sender,
        stablecoin,
      }),
    ).toThrow();
    expect(() =>
      parseSponsoredExecution({
        input: {
          ...request(),
          userCalls: [{ to: stablecoin, data: "0x1" }],
        },
        sender,
        stablecoin,
      }),
    ).toThrow();
  });

  test("bounds period widths, call count and unsupported permission data", () => {
    const input = request();
    input.permission.period = 1n << 48n;
    expect(() => parseSponsoredExecution({ input, sender, stablecoin })).toThrow();
    expect(() =>
      parseSponsoredExecution({
        input: {
          ...request(),
          userCalls: Array.from({ length: 9 }, () => ({ to: stablecoin, data: "0x" })),
        },
        sender,
        stablecoin,
      }),
    ).toThrow();
    expect(() =>
      parseSponsoredExecution({
        input: {
          ...request(),
          permission: { ...request().permission, extraData: "0x01" },
        },
        sender,
        stablecoin,
      }),
    ).toThrow();
  });
});
