import { getAddress, type Hex } from "viem";
import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => getAddress(value));

export const nonzeroAddressSchema = addressSchema.refine(
  (value) => value !== "0x0000000000000000000000000000000000000000",
  "Address must be nonzero",
);

export const hexSchema = z
  .string()
  .regex(/^0x(?:[0-9a-fA-F]{2})*$/)
  .transform((value) => value as Hex);

export const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const commitSchema = z.string().regex(/^[0-9a-f]{40}$/);

export function uintSchema({ bits }: { bits: number }) {
  return z
    .bigint()
    .min(0n)
    .max((1n << BigInt(bits)) - 1n);
}

export const decimalUintSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .transform((value) => BigInt(value))
  .pipe(uintSchema({ bits: 256 }));

export const positiveDecimalUintSchema = decimalUintSchema.refine(
  (value) => value > 0n,
  "Must be positive",
);
