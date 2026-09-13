import { isAddressEqual } from "viem";
import { z } from "zod";
import { hexSchema, nonzeroAddressSchema, uintSchema } from "./primitives";

const uint160Schema = uintSchema({ bits: 160 });
const uint256Schema = uintSchema({ bits: 256 });

export const spendPermissionSchema = z
  .strictObject({
    account: nonzeroAddressSchema,
    spender: nonzeroAddressSchema,
    token: nonzeroAddressSchema,
    allowance: uint160Schema.refine((value) => value > 0n),
    period: uintSchema({ bits: 48 }).refine((value) => value > 0n),
    start: uintSchema({ bits: 48 }),
    end: uintSchema({ bits: 48 }),
    salt: uint256Schema,
    extraData: z.literal("0x"),
  })
  .refine((value) => value.start < value.end, "Permission start must precede end");

export const userCallSchema = z.strictObject({
  to: nonzeroAddressSchema,
  data: hexSchema,
});

export const sponsoredExecutionSchema = z
  .strictObject({
    permission: spendPermissionSchema,
    withdrawalAmount: uint160Schema.refine((value) => value > 0n),
    maxGasUSDC: uint256Schema.refine((value) => value > 0n),
    userCallGasLimit: uint256Schema.refine((value) => value > 0n),
    userCalls: z.array(userCallSchema).min(1).max(8),
  })
  .superRefine((value, context) => {
    if (value.withdrawalAmount < value.maxGasUSDC) {
      context.addIssue({ code: "custom", message: "Withdrawal must cover the gas ceiling" });
    }
    if (value.withdrawalAmount > value.permission.allowance) {
      context.addIssue({ code: "custom", message: "Withdrawal exceeds the permission allowance" });
    }
  });

export type SponsoredExecution = z.infer<typeof sponsoredExecutionSchema>;

/** Static request validation only; does not establish onchain permission or native validity. */
export function parseSponsoredExecution({
  input,
  sender,
  stablecoin,
}: {
  input: unknown;
  sender: unknown;
  stablecoin: unknown;
}): SponsoredExecution {
  const account = nonzeroAddressSchema.parse(sender);
  const token = nonzeroAddressSchema.parse(stablecoin);
  const request = sponsoredExecutionSchema.parse(input);
  if (!isAddressEqual(request.permission.spender, account)) {
    throw new Error("Permission spender must be the executing account");
  }
  if (!isAddressEqual(request.permission.token, token)) {
    throw new Error("Permission must use the configured stablecoin");
  }
  if (request.userCalls.some((call) => isAddressEqual(call.to, account))) {
    throw new Error("Direct account self-calls are forbidden in the user batch");
  }
  return request;
}
