import { mkdir } from "node:fs/promises";
import { toFunctionSelector, type Address } from "viem";
import { z } from "zod";
import { deploymentConfigSchema } from "../../client/src/config";

/**
 * Read-only M0 evidence probe for the two native EIP-8130 capability gates:
 *
 * - G02: whether a non-canonical (user-deployed) authenticator is accepted on
 *   the 8130 transaction path.
 * - G04: which `ITransactionContext` getters the live client actually exposes.
 *
 * This never signs, deploys, or spends. `eth_estimateGas`/`eth_call` are
 * read-only simulations; the RPC rejecting a request is itself the evidence.
 * It is not a substitute for a full native broadcast, which needs funds.
 */

const root = new URL("../../../", import.meta.url);
const config = deploymentConfigSchema.parse(
  await Bun.file(new URL("config/vibenet.json", root)).json(),
);
const environment = z
  .object({ VIBENET_RPC_URL: z.url().optional(), VIBENET_API_URL: z.url().optional() })
  .parse(process.env);
const rpcUrl = environment.VIBENET_RPC_URL ?? config.chain.rpcUrl;
const apiUrl = environment.VIBENET_API_URL ?? config.chain.apiUrl;
const observedAt = new Date().toISOString();
const output = new URL(`docs/research/${observedAt.replaceAll(":", "-")}/`, root);
await mkdir(output, { recursive: true });

/** Canonical authenticator selector: the protocol-reserved native k1 sentinel. */
const K1_AUTHENTICATOR = "0x0000000000000000000000000000000000000001" as Address;
/** A deliberately non-canonical authenticator address (no such contract needed to test the gate). */
const NON_CANONICAL_AUTHENTICATOR = "0x00000000000000000000000000000000deadbeef" as Address;

function json({ value }: { value: unknown }) {
  return `${JSON.stringify(value, (_, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2)}\n`;
}

async function getJson({ path }: { path: string }): Promise<unknown> {
  const response = await fetch(new URL(path, apiUrl), { signal: AbortSignal.timeout(20_000) });
  return (await response.json()) as unknown;
}

async function rpc({ method, params }: { method: string; params: unknown[] }) {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json()) as {
      result?: unknown;
      error?: { code?: number; message?: string; data?: unknown };
    };
    if (body.error !== undefined) {
      return {
        ok: false as const,
        code: body.error.code,
        error: body.error.message,
        data: body.error.data,
      };
    }
    return { ok: true as const, result: body.result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Live deployment manifest ────────────────────────────────────────────────
const contracts = z
  .object({
    _commit: z.string(),
    eip8130: z.record(z.string(), z.string().regex(/^0x[0-9a-fA-F]{40}$/)),
  })
  .parse(await getJson({ path: "/api/vibenet/contracts" }));

/**
 * Contract addresses pinned in the base/base client revision referenced by the
 * discovered commit (`crates/common/consensus/.../eip8130/addresses.rs`).
 * Matching them to the live manifest links the live deployment to that source.
 */
const PINNED_CLIENT_CONTRACTS = {
  Keystore: "0x813012Bd8D971928475235BBac6F0488c4A100AC",
  DefaultAccount: "0x81309c54D6Bc190FbBc0FA9f296ea4C6A539ADEf",
  CanonicalHighRatePayerAccount: "0x813002fFdd25C81CeF79781702176D453AF0Fa57",
  P256Authenticator: "0x8130C89F65750431b564A4730397552a11CeA256",
  WebAuthnAuthenticator: "0x813007b6b1b48E75D91dEc5927ab515d12a0F1d0",
  DelegateAuthenticator: "0x81301AA52202f8C6b79Cde660440E3c6A7c5ade1",
} as const;
const liveToPinned = (name: string) => {
  const live = contracts.eip8130[name];
  if (live === undefined) return "absent from live manifest";
  const pinned = Object.entries(PINNED_CLIENT_CONTRACTS).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1];
  if (pinned === undefined) return "not pinned";
  return live.toLowerCase() === pinned.toLowerCase() ? "match" : `mismatch (pinned ${pinned})`;
};
const contractLinking = Object.fromEntries(
  Object.keys(PINNED_CLIENT_CONTRACTS).map((name) => [name, liveToPinned(name)]),
);

// ── G04: transaction-context getters ────────────────────────────────────────
const CTX = config.candidates.context;
const contextGetters: Record<
  string,
  { selector: string; accepted: boolean; revertData?: unknown }
> = {};
for (const signature of [
  "getTransactionSender()",
  "getTransactionPayer()",
  "getTransactionSenderActorId()",
  "getTransactionCalls()",
  "getTransactionGasLimit()",
]) {
  const selector = toFunctionSelector(signature);
  const result = await rpc({
    method: "eth_call",
    params: [
      { to: CTX, from: "0x1111111111111111111111111111111111111111", data: selector },
      "latest",
    ],
  });
  contextGetters[signature] = {
    selector,
    accepted: result.ok,
    ...(result.ok ? {} : { revertData: result.data }),
  };
}

// ── G02: canonical vs non-canonical authenticator acceptance ────────────────
const SENDER = "0x1111111111111111111111111111111111111111" as Address;
const PAYER = "0x2222222222222222222222222222222222222222" as Address;
const TARGET = "0x3333333333333333333333333333333333333333" as Address;
const AUTH_DATA = "11".repeat(65);
const authBlob = (authenticator: Address) => `${authenticator}${AUTH_DATA}`;

const baseEstimate = {
  sender: SENDER,
  calls: [[{ to: TARGET, data: "0x" as const }]],
};
const canonicalPayer = await rpc({
  method: "eth_estimateGas",
  params: [{ ...baseEstimate, payer: PAYER, payerAuth: authBlob(K1_AUTHENTICATOR) }],
});
const nonCanonicalPayer = await rpc({
  method: "eth_estimateGas",
  params: [{ ...baseEstimate, payer: PAYER, payerAuth: authBlob(NON_CANONICAL_AUTHENTICATOR) }],
});

const report = {
  observedAt,
  rpcUrl,
  chainId: config.chain.id,
  discoveredCommit: contracts._commit,
  contractLinking,
  gates: {
    G02_custom_authenticator_accepted: nonCanonicalPayer.ok,
    G04_calls_getter_available: contextGetters["getTransactionCalls()"]?.accepted ?? false,
    G04_gas_limit_getter_available: contextGetters["getTransactionGasLimit()"]?.accepted ?? false,
  },
  contextGetters,
  payerAuthEstimates: {
    canonical: canonicalPayer,
    nonCanonical: nonCanonicalPayer,
  },
  interpretation: {
    scopeBits:
      "Live client revision uses SCOPE_SPONSOR_PAYER = 0x04 (not the EIP draft's 0x10); see base/base crates/common/consensus/.../eip8130/constants.rs.",
    authentication:
      "Payer authentication is canonical-only. No permissive STATICCALL or MAX_AUTHENTICATION_GAS exists in the discovered client revision.",
    context: "Only sender, payer, and sender actor id are exposed; calls and gas limit are not.",
  },
  limitation:
    "Read-only simulation evidence. A funded native 0x79 broadcast is still required for final confirmation.",
};
await Bun.write(new URL("probe.json", output), json({ value: report }));
console.log(json({ value: { report: new URL("probe.json", output).pathname, ...report } }));
