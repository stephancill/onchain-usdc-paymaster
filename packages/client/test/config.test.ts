import { describe, expect, test } from "bun:test";
import candidate from "../../../config/vibenet.json";
import { assertDeploymentReady, deploymentConfigSchema } from "../src/config";

describe("deployment configuration boundary", () => {
  test("keeps unknown protocol and gas calibration values unset", () => {
    const config = deploymentConfigSchema.parse(candidate);
    expect(config.policy.hardMaxFeePerGas).toBe(5_000_000_000n);
    expect(config.protocol.maxAuthenticationGas).toBeNull();
    expect(() => assertDeploymentReady({ input: candidate })).toThrow(
      "protocol.maxAuthenticationGas",
    );
  });

  test("rejects zero as a substitute for unknown cleanup gas", () => {
    const input = structuredClone(candidate);
    expect(() =>
      deploymentConfigSchema.parse({
        ...input,
        calibration: { ...input.calibration, cleanupGasReserve: "0" },
      }),
    ).toThrow();
  });

  test("rejects numeric money values and invalid fee relationships", () => {
    expect(() =>
      deploymentConfigSchema.parse({
        ...candidate,
        policy: { ...candidate.policy, hardMaxFeePerGas: 5_000_000_000 },
      }),
    ).toThrow();
    expect(() =>
      deploymentConfigSchema.parse({
        ...candidate,
        policy: { ...candidate.policy, maxPriorityFeePerGas: "5000000001" },
      }),
    ).toThrow("Priority fee cap");
  });

  test("declared passing probes cannot mask missing deployments/calibration", () => {
    const evidence = Object.fromEntries(
      Object.keys(candidate.protocol.evidence).map((key) => [key, true]),
    );
    expect(() =>
      assertDeploymentReady({
        input: {
          ...candidate,
          protocol: { ...candidate.protocol, evidence },
        },
      }),
    ).toThrow("deployment.permissionManager");
  });
});
