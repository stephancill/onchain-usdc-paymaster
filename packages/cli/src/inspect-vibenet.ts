import { mkdir } from "node:fs/promises";
import {
  createPublicClient,
  erc20Abi,
  http,
  isAddressEqual,
  keccak256,
  parseAbi,
  zeroAddress,
  type Address,
} from "viem";
import { z } from "zod";
import { deploymentConfigSchema } from "../../client/src/config";
import { addressSchema, nonzeroAddressSchema } from "../../client/src/primitives";

const root = new URL("../../../", import.meta.url);
const config = deploymentConfigSchema.parse(
  await Bun.file(new URL("config/vibenet.json", root)).json(),
);
const environment = z
  .object({
    VIBENET_RPC_URL: z.url().optional(),
    VIBENET_API_URL: z.url().optional(),
  })
  .parse(process.env);
const rpcUrl = environment.VIBENET_RPC_URL ?? config.chain.rpcUrl;
const apiUrl = environment.VIBENET_API_URL ?? config.chain.apiUrl;
const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 0, timeout: 20_000 }) });
const observedAt = new Date().toISOString();
const output = new URL(`docs/research/${observedAt.replaceAll(":", "-")}/`, root);
await mkdir(output, { recursive: true });

function json({ value }: { value: unknown }) {
  return `${JSON.stringify(value, (_, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2)}\n`;
}

async function readPublicDocument({
  path,
  filename,
}: {
  path: string;
  filename: string;
}): Promise<unknown> {
  const response = await fetch(new URL(path, apiUrl), { signal: AbortSignal.timeout(20_000) });
  const raw = await response.text();
  // Preserve raw bytes before parsing, including errors. All requested documents are public.
  await Bun.write(new URL(filename, output), raw);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}; raw response saved`);
  return JSON.parse(raw) as unknown;
}

const [contractsRaw, faucetRaw, rawChainId, block, genesis, clientVersion] = await Promise.all([
  readPublicDocument({ path: "/api/vibenet/contracts", filename: "contracts.raw.json" }),
  readPublicDocument({ path: "/api/vibenet/faucet/status", filename: "faucet-status.raw.json" }),
  client.request({ method: "eth_chainId" }),
  client.getBlock(),
  client.getBlock({ blockNumber: 0n }),
  client.request({ method: "web3_clientVersion" }),
]);
const chainIdHex = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .parse(rawChainId);
const chainId = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .parse(Number(BigInt(chainIdHex)));
const blockNumber = block.number;
if (blockNumber === null) throw new Error("RPC returned a pending block; require a mined snapshot");
await Bun.write(new URL("block.json", output), json({ value: block }));

const contracts = z
  .object({
    _commit: z.string(),
    usdv: nonzeroAddressSchema,
    vibeToken: nonzeroAddressSchema,
    validityFactory: nonzeroAddressSchema,
    validitySwapHelper: nonzeroAddressSchema,
    validityPair: nonzeroAddressSchema,
    eip8130: z.record(z.string(), nonzeroAddressSchema),
  })
  .parse(contractsRaw);
const faucet = z
  .object({
    chain_id: z.number().int().positive(),
    usdv_address: nonzeroAddressSchema,
  })
  .parse(faucetRaw);

const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
]);
const factoryAbi = parseAbi([
  "function getPair(address,address) view returns (address)",
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
]);

async function readToken({ address }: { address: Address }) {
  const [symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol", blockNumber }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals", blockNumber }),
    client.readContract({ address, abi: erc20Abi, functionName: "totalSupply", blockNumber }),
  ]);
  return { address, symbol, decimals, totalSupply };
}

async function readPair({ address }: { address: Address }) {
  const [token0, token1, reserves] = await Promise.all([
    client.readContract({ address, abi: pairAbi, functionName: "token0", blockNumber }),
    client.readContract({ address, abi: pairAbi, functionName: "token1", blockNumber }),
    client.readContract({ address, abi: pairAbi, functionName: "getReserves", blockNumber }),
  ]);
  return {
    address,
    token0,
    token1,
    reserve0: reserves[0],
    reserve1: reserves[1],
    timestampLast: reserves[2],
  };
}

const [stablecoin, wrappedETH, vibe, requestedPair, pairCount] = await Promise.all([
  readToken({ address: contracts.usdv }),
  readToken({ address: config.candidates.wrappedETH }),
  readToken({ address: contracts.vibeToken }),
  client.readContract({
    address: contracts.validityFactory,
    abi: factoryAbi,
    functionName: "getPair",
    args: [contracts.usdv, config.candidates.wrappedETH],
    blockNumber,
  }),
  client.readContract({
    address: contracts.validityFactory,
    abi: factoryAbi,
    functionName: "allPairsLength",
    blockNumber,
  }),
]);
if (pairCount > 64n)
  throw new Error(`Factory has ${pairCount} pairs; bounded discovery limit is 64`);
const pairs = await Promise.all(
  Array.from({ length: Number(pairCount) }, async (_, index) => {
    const address = addressSchema.parse(
      await client.readContract({
        address: contracts.validityFactory,
        abi: factoryAbi,
        functionName: "allPairs",
        args: [BigInt(index)],
        blockNumber,
      }),
    );
    return readPair({ address });
  }),
);
const addresses = new Set<Address>([
  contracts.usdv,
  config.candidates.wrappedETH,
  contracts.vibeToken,
  contracts.validityFactory,
  contracts.validitySwapHelper,
  ...Object.values(contracts.eip8130),
  ...pairs.map((pair) => pair.address),
]);
const code = await Promise.all(
  [...addresses].map(async (address) => {
    const bytecode = await client.getCode({ address, blockNumber });
    return {
      address,
      byteLength: bytecode === undefined ? 0 : (bytecode.length - 2) / 2,
      codeHash: bytecode === undefined || bytecode === "0x" ? null : keccak256(bytecode),
    };
  }),
);

const conflicts: string[] = [];
if (config.protocol.genesisHash !== null && genesis.hash !== config.protocol.genesisHash)
  conflicts.push("RPC genesis differs from the pinned genesis hash");
if (chainId !== config.chain.id)
  conflicts.push(`RPC chain ${chainId} differs from candidate ${config.chain.id}`);
if (chainId !== faucet.chain_id)
  conflicts.push(`RPC chain ${chainId} differs from faucet chain ${faucet.chain_id}`);
if (!isAddressEqual(contracts.usdv, faucet.usdv_address))
  conflicts.push("Contracts and faucet USDV addresses differ");
for (const [name, actual, expected] of [
  ["USDV", contracts.usdv, config.candidates.stablecoin],
  ["factory", contracts.validityFactory, config.candidates.factory],
  ["helper", contracts.validitySwapHelper, config.candidates.swapHelper],
] as const) {
  if (!isAddressEqual(actual, expected))
    conflicts.push(`${name} differs from the candidate configuration`);
}
if (stablecoin.decimals !== 6)
  conflicts.push(`USDV has ${stablecoin.decimals} decimals, expected 6`);
if (wrappedETH.decimals !== 18)
  conflicts.push(`Wrapped native token has ${wrappedETH.decimals} decimals, expected 18`);
const settlementPair = isAddressEqual(requestedPair, zeroAddress)
  ? null
  : pairs.find((pair) => isAddressEqual(pair.address, requestedPair));
if (settlementPair === undefined)
  conflicts.push("Factory getPair result missing from allPairs enumeration");
const missingCode = code.filter((entry) => entry.byteLength === 0);
for (const entry of missingCode)
  conflicts.push(
    `No runtime code at advertised contract ${entry.address}; native system behavior needs separate proof`,
  );
const pinnedBlock = await client.getBlock({ blockNumber });
if (pinnedBlock.hash !== block.hash)
  throw new Error("Snapshot block was reorganized; rerun discovery");

const report = {
  observedAt,
  rpcUrl,
  apiUrl,
  chainId,
  chainIdHex,
  advertisedFaucetChainId: faucet.chain_id,
  clientVersion,
  genesisHash: genesis.hash,
  block: {
    number: blockNumber,
    hash: block.hash,
    timestamp: block.timestamp,
    gasLimit: block.gasLimit,
    baseFeePerGas: block.baseFeePerGas,
  },
  discoveryCommit: contracts._commit,
  sources: config.sources,
  tokens: { stablecoin, wrappedETH, vibe },
  factory: contracts.validityFactory,
  helper: contracts.validitySwapHelper,
  pairCount,
  pairs,
  settlementPair: settlementPair ?? null,
  code,
  conflicts,
  nativeCompatibility: "unproven",
  nextStep:
    settlementPair == null
      ? "Create and seed a USDV/wrapped-ETH pair after native compatibility checks"
      : "Verify exact-output swap and wrapped-ETH redemption",
};
await Bun.write(new URL("report.json", output), json({ value: report }));
console.log(
  json({
    value: {
      report: new URL("report.json", output).pathname,
      chainId,
      tokens: report.tokens,
      pairCount,
      settlementPair: report.settlementPair,
      conflicts,
      nextStep: report.nextStep,
    },
  }),
);
