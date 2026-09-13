# Protocol compatibility and Vibenet research

## Headline (M0): the native autonomous payer is NOT supported as designed

Two independent capabilities the handover relies on do **not** exist in the client
revision that Vibenet's own discovery endpoint reports (`b51ca726c`), and both are
confirmed by live read-only probes against `rpc.vibes.base.org`:

1. **Non-canonical (user-deployed) authenticators are rejected on the 8130
   transaction path.** The path accepts only the enshrined canonical set: native
   secp256k1 (`address(1)`), P-256, WebAuthn, and the depth-1 delegate. Everything
   else fails `NotCanonical`. Consequences:
   - The proposed `AutonomousUSDCPayerAuthenticator` cannot be a payer actor.
   - Payer authentication is therefore a **signature** from a canonical key: there is
     no way to decide sponsorship in arbitrary onchain code, and **no way to avoid a
     per-transaction payer signature**. The "no paymaster API, no payer signature"
     goal is unreachable on this target.
   - The payer-witness mechanism (proving `max_fee_per_gas` to a custom authenticator)
     has no consumer and is moot.

2. **`ITransactionContext` exposes only three getters**: `getTransactionSender`,
   `getTransactionPayer`, `getTransactionSenderActorId`. `getTransactionCalls` and
   `getTransactionGasLimit` **revert** (unknown selector). The handover's
   "inspect phase-0 calls and gas limit from the authenticator" step is impossible.

The client also diverges from the published EIP draft in two ways that matter:

- **Authenticator metering is a fixed enshrined schedule**, not a permissive
  `STATICCALL` bounded by `MAX_AUTHENTICATION_GAS`. There is no `MAX_AUTHENTICATION_GAS`
  in the client at all. Unpriced authenticators fail intrinsic-gas computation.
- **Actor scope bits are renumbered** (`SCOPE_OPERATOR=0x01`, `SCOPE_SELF_PAYER=0x02`,
  `SCOPE_SPONSOR_PAYER=0x04`, `SCOPE_POLICY=0x08`, `SCOPE_NONCE=0x10`), so
  `SPONSOR_PAYER` is **0x04**, not the draft's `0x10`.

Reaching the original goal therefore requires either a product/architecture change
(an ERC-8168 co-signing payer service) or a protocol change by Base (permissive
acceptance or an enshrined authenticator). This is a design decision, recorded in
[implementation-notes.md](implementation-notes.md) and the decision register.

### Evidence (read-only, reproducible)

`bun run probe:vibenet:8130` at block-pinned RPC state:
[probe.json](research/2026-09-13T16-36-38.037Z/probe.json).

| Check                                              | Observation                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Live contract addresses vs pinned client constants | All 6 match (Keystore, DefaultAccount, CanonicalHighRatePayerAccount, P256, WebAuthn, Delegate) |
| `getTransactionSender()`                           | accepted (returns caller/origin)                                                                |
| `getTransactionPayer()`                            | accepted                                                                                        |
| `getTransactionSenderActorId()`                    | accepted                                                                                        |
| `getTransactionCalls()`                            | **reverts**, data = its own selector `0xdf66b5cb` (unknown)                                     |
| `getTransactionGasLimit()`                         | **reverts**, data = its own selector `0xd13f350a` (unknown)                                     |
| `eth_estimateGas` with canonical (k1) `payer_auth` | accepted (`0xe9bc` gas)                                                                         |
| `eth_estimateGas` with non-canonical `payer_auth`  | rejected `-32602`, "…a `payer_auth` with an unrecognized authenticator selector"                |

Source confirmation (pinned `base/base` @ `b51ca726cd2048b5b98cedc495c9aeda3081f065`):

- `crates/execution/eip8130/src/dispatch.rs`: routes only k1/P256/WebAuthn/delegate;
  returns `AuthError::NotCanonical` otherwise (tests `rejects_non_canonical_authenticator`,
  `rejects_zero_authenticator_selector`).
- `crates/execution/eip8130/src/authorize.rs`: `NotCanonical` surfaces as
  `InvalidAuthenticator => "actor authenticator is not canonical"`.
- `crates/execution/eip8130/src/schedule.rs`: fixed `AUTH_EXEC_K1/P256/WEBAUTHN` plus
  `leaf_auth_exec_gas` returning `None` for non-canonical addresses.
- `crates/common/precompiles/src/tx_context/abi.rs` + `dispatch.rs`: exactly three
  getters.
- `crates/common/rpc-types/src/eip8130.rs`: `is_prefixed_auth` requires a canonical
  payer selector; `MAX_AUTH_SIZE = 8_192`.
- `crates/common/consensus/.../eip8130/tx.rs`: `payer_signature_hash(resolved_sender)`
  = `keccak256(0x7a || rlp([...body fields with resolved sender...]))`, matching the draft.

Limitation: these are read-only simulations. A funded native `0x79` broadcast remains
the final confirmation, but the client cannot even construct a transaction with a
non-canonical payer, so the rejection is structural, not merely a simulation artifact.

## Pinned sources (2026-09-13)

| Source                                                                                                                    | Revision                                   | Role                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| [base/base](https://github.com/base/base/tree/b51ca726cd2048b5b98cedc495c9aeda3081f065)                                   | `b51ca726cd2048b5b98cedc495c9aeda3081f065` | **Live execution client** (discovery `_commit`)   |
| [ethereum/EIPs](https://github.com/ethereum/EIPs/blob/6a6569c489383a546337e9da8289ecde84d0dd21/EIPS/eip-8130.md)          | `6a6569c489383a546337e9da8289ecde84d0dd21` | Published draft surface (differs from client)     |
| [base/eip-8130](https://github.com/base/eip-8130/tree/812317be00d6829e217e0cc92f75be362fde0711)                           | `812317be00d6829e217e0cc92f75be362fde0711` | Reference account/keystore contracts              |
| [coinbase/spend-permissions](https://github.com/coinbase/spend-permissions/tree/e0004e63edc4e17de7aa978293800ac7a16892e5) | `e0004e63edc4e17de7aa978293800ac7a16892e5` | Fork origin, recurring accounting and MIT license |
| [base/ui](https://github.com/base/ui/tree/e3d447df6e4884442ea1219d0b9084aebd4463d3)                                       | `e3d447df6e4884442ea1219d0b9084aebd4463d3` | Public demo route discovery                       |
| [chunter-cb/viem `feat/eip-8130`](https://github.com/chunter-cb/viem/tree/feat/eip-8130)                                  | `24aa695819c535ca4eac941c34cf8614cc331b05` | Client-side 8130/8168 SDK the ecosystem uses      |

Research clones live in ignored `third-party/`; the build does not depend on them.

## Public endpoints and observed facts

- RPC `https://rpc.vibes.base.org` and browser proxy
  `https://api.vibes.base.org/api/vibenet/account/rpc` both return
  `eth_chainId = 0x509f455 = 84538453`; faucet metadata agrees.
- Genesis hash pinned in `config/vibenet.json`:
  `0x0266d1618641b4fd1793682ae93358d52b83e68af3970a8b6a5227b2d60d34bf`.
- `web3_clientVersion` = `reth/v2.5.2-76a8261/x86_64-unknown-linux-gnu`.
- `/api/vibenet/contracts` reports `_commit = b51ca726c`; its `eip8130` addresses match
  the pinned client constants exactly (see probe). Derive validity/fixture age from
  block timestamps, never the local clock.

## Client capability summary (authoritative for this target)

| Capability                                       | Status on Vibenet `b51ca726c`                         |
| ------------------------------------------------ | ----------------------------------------------------- |
| Custom `IAuthenticator` on the native tx path    | **Not accepted** (canonical-only)                     |
| Authenticator metering                           | Fixed enshrined schedule; no `MAX_AUTHENTICATION_GAS` |
| Payer with no signature                          | **Impossible** (canonical key must sign `payer_auth`) |
| `getTransactionCalls` / `getTransactionGasLimit` | **Unavailable**                                       |
| `getTransactionSender/Payer/SenderActorId`       | Available                                             |
| `SPONSOR_PAYER` scope bit                        | **0x04**                                              |
| ERC-8168 payer service (`payer_*`)               | Available; co-signs sender-signed txs                 |
| Sender session keys (`POLICY` + SessionPolicy)   | Available (sender side only)                          |
| Native 7702 account delegation                   | Available                                             |
| Local/fork test as native proof                  | Not valid; needs native broadcast                     |

## Feasible paths (decision required)

1. **ERC-8168 co-signing payer service (feasible today).** Keep zero-ETH A and the
   spend-permission USDV sourcing. Register a service-controlled canonical key as a
   `SPONSOR_PAYER` (0x04) actor on payer account T. T co-signs `payer_auth` per
   transaction and submits. Loses "no payer signature / no paymaster API"; gains an
   immediately buildable product on the chosen chain.
2. **Custom authenticator via Base protocol change (not available).** Ask Base to
   enshrine the authenticator or accept a permissive/allowlisted profile on Vibenet.
   The handover's original mechanism could then be revisited, but only after the client
   path can call arbitrary authenticator code. `getTransactionCalls`/`GasLimit` would
   still be missing, so call-shape validation would rely on the payer-hash witness.
3. **Retarget to an ERC-4337 paymaster (different architecture).** `validatePaymasterUserOp`
   is arbitrary onchain code, so an autonomous onchain USDC-paymaster policy is
   expressible today. Abandons native 8130/Vibenet. Preserves "no human signature per
   transaction" and "onchain policy".
4. **Controlled pilot / stop.** Do not claim permissionless native sponsorship.

## Open gates after M0

| Gate                                | Status               | Note                                                                         |
| ----------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| G01 chain/deployment pin            | **Passed (strong)**  | Genesis pinned; client contract constants match live manifest                |
| G02 custom authenticator acceptance | **Failed**           | Canonical-only; live + source evidence                                       |
| G03 payer hash                      | Source-confirmed     | Formula matches draft; native vector still unrecorded                        |
| G04 context getters                 | **Failed (partial)** | Only 3 getters; calls/gasLimit unavailable                                   |
| G05 authentication gas              | Superseded           | Fixed schedule, not a configurable ceiling                                   |
| G06 gas/fee accounting              | Partially known      | Payer auth metered outside `gas_limit`; schedule in source                   |
| G07 state invalidation              | Mechanism confirmed  | Generic state-keyed `InvalidationKey` index (balance/nonce/code/slot/expiry) |
| G08 metered account                 | Unproven             | Requires a native broadcast with funds                                       |
| G09 treasury lock                   | Unproven             | Candidate high-rate proxy codehash known                                     |
| G10 route                           | Discovery only       | No USDV/WETH pair at block 1308110                                           |
| G11 deployment verification         | **Unconfirmed**      | No Vibenet source-verification endpoint identified                           |

## Asset / route candidates from the public page

UI sources: `app/vibenet/demos/validity/lib/{singleton,constants}.ts` and `artifacts/`;
`app/vibenet/library/client.ts`.

| Candidate                                   | Address                                      |
| ------------------------------------------- | -------------------------------------------- |
| USDV (6 decimals, mintable test asset)      | `0x64BD2e932FA41c9Fb7451996fbA3bd270d647d6D` |
| Wrapped native token (WETH, 18)             | `0x4200000000000000000000000000000000000006` |
| Zero-fee V2 factory                         | `0xFC076BC5DD2EE015508a257d5318927b8E21eE13` |
| Exact-in/out helper                         | `0x6F5A2e185d58fec58a55D8BE1A9EA9A361899d55` |
| VIBE                                        | `0xB200000000000000000000ef8aE5Df466876133d` |
| VIBE/USDV pair (only pair at block 1308110) | `0x050b84A1305F0687b4DCE4e89F4376c492B81833` |

The VIBE/USDV demo route cannot redeem ETH. At block **1308110** the factory held
exactly one pair and `getPair(USDV, wrappedETH)` returned zero; WETH reported total
supply zero. A USDV/WETH pair must be created and seeded (M5), after verifying
wrapping/redemption. Scoped to this factory/block, not a network-wide scan.

The factory is a **modified zero-fee Uniswap V2** deployment (`v3` is a fixture version,
not Uniswap V3). Reuse the helper's `swapExactOut(tokenIn, pair, amountOut, maxIn)`;
confirm the runtime/hash before relying on its reserve formula. No Chainlink ETH/USDC
market feed was identified in the inspected sources; the v0 oracle is an explicit
fixture quote.

## Honesty rules for this repository

- Do not mark a capability supported from unit tests, `eth_call`, or source reading
  alone; native broadcast evidence is required where a native path is claimed.
- Do not "work around" canonical-only acceptance by quietly substituting a hosted payer
  signer and still describing the result as permissionless/no-signature.
- Keep unknown calibration values null; never invent protocol constants.
- Store public vectors/traces with block and tx IDs; keep keys and secrets out.
