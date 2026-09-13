import { z } from "zod";
import {
  commitSchema,
  hashSchema,
  nonzeroAddressSchema,
  positiveDecimalUintSchema,
} from "./primitives";

const evidenceSchema = z.strictObject({
  chainIdentityResolved: z.boolean(),
  customAuthenticatorAccepted: z.boolean(),
  payerHashVerified: z.boolean(),
  transactionContextVerified: z.boolean(),
  gasAccountingVerified: z.boolean(),
  stateRevalidationVerified: z.boolean(),
  meteredAccountVerified: z.boolean(),
  lockedTreasuryVerified: z.boolean(),
  routeVerified: z.boolean(),
  sourceVerificationAvailable: z.boolean(),
});

export const deploymentConfigSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    name: z.literal("vibenet-metered-usdv-v0"),
    chain: z.strictObject({
      id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      rpcUrl: z.url(),
      apiUrl: z.url(),
    }),
    sources: z.strictObject({
      eip: commitSchema,
      referenceContracts: commitSchema,
      spendPermissions: commitSchema,
      baseUi: commitSchema,
    }),
    policy: z.strictObject({
      maxWitnessBytes: z.literal(2048),
      maxUserCalls: z.literal(8),
      maxFailurePrefixBytes: z.literal(256),
      maxGasLimit: positiveDecimalUintSchema,
      hardMaxFeePerGas: positiveDecimalUintSchema,
      maxPriorityFeePerGas: positiveDecimalUintSchema,
      maxValiditySeconds: z.literal(120),
      validationMarginBps: z.literal(1000),
      serviceFeeBps: z.literal(0),
      oracleMaxAgeSeconds: z.literal(604800),
      treasuryUnlockDelaySeconds: z.literal(600),
    }),
    candidates: z.strictObject({
      stablecoin: nonzeroAddressSchema,
      wrappedETH: nonzeroAddressSchema,
      factory: nonzeroAddressSchema,
      swapHelper: nonzeroAddressSchema,
      context: nonzeroAddressSchema,
    }),
    deployment: z.strictObject({
      pair: nonzeroAddressSchema.nullable(),
      payer: nonzeroAddressSchema.nullable(),
      permissionManager: nonzeroAddressSchema.nullable(),
      meteredAccountImplementation: nonzeroAddressSchema.nullable(),
      authenticator: nonzeroAddressSchema.nullable(),
      settlement: nonzeroAddressSchema.nullable(),
      oracle: nonzeroAddressSchema.nullable(),
    }),
    protocol: z.strictObject({
      clientCommit: commitSchema.nullable(),
      genesisHash: hashSchema.nullable(),
      maxAuthenticationGas: positiveDecimalUintSchema.nullable(),
      evidence: evidenceSchema,
    }),
    calibration: z.strictObject({
      billingOverheadGas: positiveDecimalUintSchema.nullable(),
      cleanupGasReserve: positiveDecimalUintSchema.nullable(),
      minimumTransactionGas: positiveDecimalUintSchema.nullable(),
      maximumUserCallGas: positiveDecimalUintSchema.nullable(),
      stablePerEthE6: positiveDecimalUintSchema.nullable(),
      reportHash: hashSchema.nullable(),
    }),
    verifiedDeploymentManifestHash: hashSchema.nullable(),
  })
  .superRefine((config, context) => {
    if (config.policy.maxPriorityFeePerGas > config.policy.hardMaxFeePerGas) {
      context.addIssue({
        code: "custom",
        message: "Priority fee cap exceeds the absolute fee cap",
      });
    }
    const { minimumTransactionGas, maximumUserCallGas, cleanupGasReserve } = config.calibration;
    if (minimumTransactionGas !== null && minimumTransactionGas > config.policy.maxGasLimit) {
      context.addIssue({
        code: "custom",
        message: "Minimum transaction gas exceeds policy maximum",
      });
    }
    if (
      maximumUserCallGas !== null &&
      cleanupGasReserve !== null &&
      maximumUserCallGas + cleanupGasReserve >= config.policy.maxGasLimit
    ) {
      context.addIssue({
        code: "custom",
        message: "Child gas and cleanup leave no preparation budget",
      });
    }
  });

export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;

/** Validates declarations, not their evidence. Native code must also check live chain/code identity. */
export function assertDeploymentReady({ input }: { input: unknown }): DeploymentConfig {
  const config = deploymentConfigSchema.parse(input);
  const missing = [
    ...Object.entries(config.deployment)
      .filter(([, value]) => value === null)
      .map(([key]) => `deployment.${key}`),
    ...Object.entries(config.calibration)
      .filter(([, value]) => value === null)
      .map(([key]) => `calibration.${key}`),
    ...Object.entries(config.protocol.evidence)
      .filter(([, value]) => !value)
      .map(([key]) => `evidence.${key}`),
  ];
  if (config.protocol.clientCommit === null) missing.push("protocol.clientCommit");
  if (config.protocol.genesisHash === null) missing.push("protocol.genesisHash");
  if (config.protocol.maxAuthenticationGas === null) missing.push("protocol.maxAuthenticationGas");
  if (config.verifiedDeploymentManifestHash === null)
    missing.push("verifiedDeploymentManifestHash");
  if (missing.length > 0) throw new Error(`Deployment is not ready: ${missing.join(", ")}`);
  return config;
}
