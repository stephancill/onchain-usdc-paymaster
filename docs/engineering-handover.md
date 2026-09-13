# Permissionless USDC Paymaster — Engineering Handover

**Decision date:** 2026-09-13  
**Revision:** v0, metered account design  
**Status:** ⛔ **M0 compatibility blocker** — native design NOT supported as specified on Vibenet  
**Target:** Vibenet, `https://rpc.vibes.base.org` (observed chain ID **84538453**)  
**Language:** MUST/REQUIRE indicates an implementation requirement, not an existing capability.

## 0. M0 compatibility blocker (read first)

The M0 spike disproved two load-bearing assumptions. Vibenet's live client revision
(`b51ca726c`, confirmed by matching contract addresses) is **canonical-only**:

- **Non-canonical authenticators are rejected** on the 8130 transaction path. Only
  native secp256k1 (`address(1)`), P-256, WebAuthn, and the depth-1 delegate are
  accepted. Therefore component **H (`AutonomousUSDCPayerAuthenticator`) cannot exist
  as a payer actor**, and the payer must authenticate with a canonical key signature.
  The core goals "no paymaster API" and "no per-transaction payer signature" are
  unreachable on this target.
- **`ITransactionContext` exposes only sender, payer, and sender actor id.**
  `getTransactionCalls` and `getTransactionGasLimit` revert. The "authenticator inspects
  the phase-0 calls/gas limit" step is impossible.

Also corrected against the live client: authenticator metering is a **fixed enshrined
schedule** (there is no `MAX_AUTHENTICATION_GAS`), and `SCOPE_SPONSOR_PAYER` is **0x04**,
not the draft's `0x10`.

Sections 5 (payer witness), 6 (authenticator policy), and 8 (authenticator algorithm)
describe a mechanism that cannot run on this target and are retained only as the design
record for a future permissive/enshrined profile. See
[protocol-compatibility.md](protocol-compatibility.md) for evidence and feasible paths,
and the open decision in [implementation-notes.md](implementation-notes.md).

## 1. Outcome and scope

Allow account **A**, with **zero ETH and initially zero USDC**, to execute calls from its
own address using a pre-registered USDC spend permission granted by funded account **B**.
An ETH-funded payer **T** authorizes sponsorship onchain without a payer API, payer
signature, or per-user enrollment with the payer.

A uses an EIP-7702-delegated **MeteredUSDCAccount** implementation. A single native
EIP-8130 self-call withdraws from B, escrows a USDC gas ceiling, executes A's atomic user
batch with a bounded gas budget, catches batch failure, and settles the gas payment.
USDC buys exact-output wrapped ETH; only T receives the unwrapped ETH.

The v0 bill is **measured wrapper execution gas plus a published calibrated overhead**,
at the transaction's effective gas price. It is neither the reserved `gas_limit` nor
the exact final receipt charge. `gasleft()` cannot see the final refund counter, gas
spent after its last sample, or all native transaction processing. The product
explicitly accepts this definition of metered billing.

Vibenet **USDV** (6 decimals) stands in for USDC. It is a freely mintable test asset,
not Circle USDC. This is a bounded-loss testnet prototype, with permissionless
eligibility rather than a claim of economically lossless public sponsorship.

### Superseded design

This handover replaces the initial `eip-8130-usdc-paymaster-handover.md` proposal:

| Initial proposal                                      | Chosen v0                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| Generic withdrawal protocol                           | EOA-friendly fork of Coinbase Spend Permissions                      |
| Phase 0 withdraw/approve/settle, phase 1 user actions | One native self-call; internally atomic, gas-capped user batch       |
| Settlement before user calls                          | Escrow before calls; metered settlement after caught success/failure |
| Bill reserved gas capacity                            | Measure wrapper work and add disclosed overhead                      |
| Default/general account                               | Pinned metered account implementation                                |
| Canonical USDC/unspecified router                     | USDV and wrapped ETH, zero-fee V2 test route                         |

These are intentional breaking changes. The fork does not preserve Coinbase smart-wallet
execution, native-token spending, MagicSpend, ERC-6492 deployment side effects, or the
initial proposal's native phase-status interpretation.

## 2. Decision register

| ID  | Decision                                    | Reason / consequence                                                                                                                          |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Vibenet native 8130 target                  | Custom authenticator acceptance must be demonstrated there.                                                                                   |
| D02 | B grants permission to A                    | A is both permission spender and native transaction sender.                                                                                   |
| D03 | Pre-register permission and token allowance | Authentication reads state; no first-use permission signature/proof.                                                                          |
| D04 | ERC-20 `transferFrom(B, A, amount)`         | Funding B can be an ordinary EOA; manager has no wallet-owner power.                                                                          |
| D05 | Explicit signed withdrawal amount           | May cover user principal as well as the gas ceiling.                                                                                          |
| D06 | Refund unused gas USDC to A                 | Full withdrawal consumes B's period allowance; refund does not undo spending.                                                                 |
| D07 | Metered delegated account                   | Preserves downstream `msg.sender == A` while catching atomic batch failure.                                                                   |
| D08 | Single native wrapper call                  | No later native phase whose settlement can be skipped.                                                                                        |
| D09 | No service fee                              | Bill only the defined gas measure/overhead and actual DEX input.                                                                              |
| D10 | Full payer RLP witness, initially 2 KiB     | Cryptographic fee/shape binding without payer signature. Optimize after benchmarks.                                                           |
| D11 | USDV/wrapped ETH, fixed zero-fee V2 route   | Reuse discovered factory/helper; create/seed missing pair as an implementation task.                                                          |
| D12 | Immutable test-price oracle                 | Explicit fixture price, not VIBE/USDV spot or a claimed market oracle.                                                                        |
| D13 | Locked canonical high-rate treasury clone   | Scope-0 recovery actor plus custom `SPONSOR_PAYER` actor; receiving ETH must work while locked.                                               |
| D17 | ⛔ M0 blocker: canonical-only client        | Custom payer authenticator + calls/gasLimit getters are unavailable on Vibenet `b51ca726c`. Payer must sign; direction pending user decision. |
| D14 | Strict immutable deployment policy          | Versioned deployments rather than mutable authentication economics.                                                                           |
| D15 | Bounded testnet loss accepted               | Prevalidation and gas reservation mitigate but do not eliminate failed-settlement griefing.                                                   |
| D16 | Foundry + Bun + viem + Zod, MIT             | Contracts, client package, read-only CLI and CI; root agent instructions.                                                                     |

Product decisions above are closed. Unknown client features and measured gas values are
engineering evidence gates with owners and acceptance criteria in the implementation plan.

## 3. Identities and onboarding

| Symbol | Identity                         | Initial state / authority                                                  |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| B      | Funding account                  | Has USDV; approves the permission manager and a recurring permission.      |
| A      | Executing account                | Zero ETH/USDC; `permission.spender == A`; controls its native signing key. |
| M      | EOASpendPermissionManager        | Pulls only authorized ERC-20 spending from B to A.                         |
| S      | USDCPaymasterSettlement          | Temporarily escrows A's gas ceiling, swaps, pays T, refunds A.             |
| T      | Payer treasury                   | Already holds native ETH; registers custom authenticator for sponsorship.  |
| H      | AutonomousUSDCPayerAuthenticator | Returns a fixed actor ID only after all validation checks.                 |

Before the first sponsored execution:

1. Deploy/configure M, S, H, oracle, metered account implementation and T; fund T and route liquidity.
2. Install the metered implementation at A through a separately relayed, user-authorized
   7702 setup transaction. A need not receive ETH. Sponsored v0 execution itself requires
   empty `account_changes`; first-use account installation is a separate onboarding action.
3. B grants `USDV.approve(M, allowance)` sufficient for future withdrawals. Token allowance
   and spend-permission allowance are separate controls; both must cover each withdrawal.
4. B calls `M.approve(permission)` with `account=B`, `spender=A`, `token=USDV`.
5. A signs one native 8130 transaction per sponsored execution. B does not sign each execution.

S and the metered implementation refer to one another. Deployment tooling must precompute
their addresses through a fixed-order bootstrap factory using CREATE nonces (independent
of constructor bytecode), then deploy them atomically and assert the predicted addresses.
Do not attempt a circular CREATE2 initcode/address fixed point. Record constructor values
and linked/immutable runtime hashes for each child, and verify each child separately.

Native secp256k1 EOA signing, nonce channel `0`, is the initial client path. Nonce-free
transactions, configured session signers and arbitrary account implementations are later scope.
Permission is a right to take B's tokens; it is not already escrowed collateral. B can revoke
it, lower token allowance, or spend its balance before inclusion.

## 4. Contract boundaries and intended APIs

The scaffold contains interfaces, not working paymaster implementations. Shared structs
are in `contracts/src/interfaces/PaymasterTypes.sol`.

### 4.1 EOASpendPermissionManager

Adapt the recurring allowance, hash identity, period arithmetic and irreversible revocation
semantics of the pinned Coinbase implementation. Preserve its MIT attribution.

```text
SpendPermission {
  address account; address spender; address token;
  uint160 allowance; uint48 period; uint48 start; uint48 end;
  uint256 salt; bytes extraData;
}

approve(permission) -> bool       // only account; revoked hash cannot be resurrected
revoke(permission)                // only account
spend(permission, uint160 amount) // only spender; fixed recipient == spender
previewSpend(permission, amount) -> SpendPreview
getHash(permission) -> bytes32
```

- `previewSpend` and `spend` MUST share permission/time/amount evaluation logic. Preview
  returns the current period, used allowance and remaining spendable amount, or reverts.
- Check registered, not revoked, nonzero period/allowance/amount, `start <= now < end`,
  no uint160 overflow, and `used + amount <= allowance`.
- Compute periods from `start + floor((now-start)/period)*period`, end clamped to
  permission end. Do not align to calendar boundaries. Expiry is exclusive.
- Check B's token balance and B→M token allowance for the **entire withdrawalAmount**,
  not just `maxGasUSDC`.
- v0 supports the one immutable stablecoin only; reject native-token sentinels and all
  other tokens. Require `extraData` empty in sponsored v0. No dynamic signature path.
- Update period accounting before `SafeERC20.safeTransferFrom(B, A, amount)`; reversion
  rolls both back. Reentrancy protection covers the manager's external transfer.
- New identity/domain name `EOA Spend Permission Manager`, version `1`, chain ID and M
  address included in the EIP-712 hash. Existing upstream approvals/signatures do not migrate.
- A manager preview cannot prove arbitrary token transfer success. USDV is the known
  fixture; a future real-USDC integration must check pause/blocklist behavior explicitly.

### 4.2 MeteredUSDCAccount

```text
executeSponsored(SponsoredExecution request) -> (bool userCallsSucceeded)
executeUserBatch(UserCall[] calls)             // guarded, one-shot self-call helper
meteringContext() -> MeteringContext           // authenticated callback for S
```

`SponsoredExecution` commits permission, withdrawal amount, `maxGasUSDC`, aggregate
`userCallGasLimit`, and 1–8 `UserCall { to, data }` entries. M/S/T/token/oracle addresses
and billing overhead are implementation-bound, not caller-selectable.

Only the account's native self-dispatch may enter `executeSponsored`: require self-call,
native sender A, configured payer T, supported delegation target and inactive metering
state. A normal contract call using an arbitrary gas figure is not a billable transaction.
The implementation's own deployment address must not act as A.

The account must expose no arbitrary delegatecall path capable of corrupting metering
state. Reject user calls directly targeting A (including recursive batch helpers). Internal
dispatch is one-shot and bound to the exact committed batch hash. External callbacks
cannot impersonate an account self-call. Keystore/account authority changes during a
sponsored batch require adversarial tests; no accepted path may replace code or bypass
the active execution/settlement guards.

Use namespaced transient storage for the active execution lifecycle; verify native client
support for Cancun transient storage. A plain `EXTCODEHASH(A)` for a delegated EOA hashes
the delegation indicator, not the implementation: validate the exact `0xef0100 || target`
indicator and the target's runtime hash, and reject arbitrary proxies/upgrades.

### 4.3 USDCPaymasterSettlement

```text
reserve(uint256 maxGasUSDC)  // S pulls the exact approved ceiling from A
settle()                   // reads authenticated metering state from A; no caller gas argument
```

Both functions require A to be the native sender, T the native payer, A's exact supported
delegation/runtime, and the matching account lifecycle phase. S has its own reentrancy
guard and per-execution active reserve, consumed exactly once. Checking `msg.sender == A`
alone is insufficient: arbitrary user batch calls also originate at A. The account phase
and one-shot flags must forbid early reserve/settle, duplicate settlement, and spoofed gas.

S uses only immutable stablecoin, wrapped ETH, router/helper, pair and T. S validates both
pair tokens and the pinned zero-fee pair implementation; the demo helper alone does not
adequately validate an arbitrary token/pair combination.

Flow: pull ceiling → exact-output swap for target ETH → reset router allowance → unwrap →
send ETH to T → refund remaining stablecoin to A → clear reserve. Use `SafeERC20`; exact
router approval, zero afterwards. Pulling a finite exact A→S ceiling consumes it; reject
the ERC-20 infinite-approval sentinel. No external method may sweep active user reserves.
The ETH receive hook accepts only wrapped-ETH withdrawal and must fit that token's stipend.

Allowance/balance invariants describe paymaster-created movements. A's arbitrary user
calls can deliberately grant a new token allowance or exercise another permission; those
application effects must be distinguished from the gas-payment path in accounting/tests.

### 4.4 Payer authenticator / witness

`authenticate(bytes32 protocolPayerHash, bytes data) external view returns (bytes32 actorId)`.

Return `keccak256("AUTONOMOUS_USDC_PAYER_V1")` on acceptance, otherwise revert with a
specific custom error. Register only `SPONSOR_PAYER` for that actor on T.

> ⛔ **Superseded by the M0 blocker.** This section cannot run on Vibenet: custom
> authenticators are rejected (canonical-only) and the context lacks the calls/gasLimit
> getters. Retained as the design record for a future permissive/enshrined profile.
> On the current target the payer must sign `payer_auth` with a canonical key and be
> registered as `SCOPE_SPONSOR_PAYER = 0x04`.

`payer_auth = H (20 bytes) || version (0x01) || payerPayloadRlp`.
Hash `0x7a || payerPayloadRlp` and compare to the protocol-supplied payer hash before
trusting decoded data. Version+payload, excluding H's address prefix, must be <=2048 bytes.
Reject an empty witness before reading its version.

The 8-call limit is also subject to the 2 KiB witness limit: large batches may not fit.
The builder must report the actual encoded size and reject them rather than silently
increasing authentication limits or dropping calls.

The proven 13-field list is:

```text
[chain_id, resolved_sender, nonce_key, nonce_sequence, valid_after, valid_before,
 max_priority_fee_per_gas, max_fee_per_gas, gas_limit, account_changes,
 calls, metadata, payer]
```

EOA sender is empty on the native wire/sender-signing path but **resolved A** in the
payer payload. Neither authentication blob is in that payload. Changing fees or gas
requires rebuilding the witness and re-signing the sender transaction.

Implement a fixed-field canonical RLP reader, input/width/list bounds and no unbounded
recursion. Decode nonce key/sequence as well as the original proposal's fields so the
channel-0 v0 restriction is actually enforced. Minimal integers encode zero as the empty
byte string, not `0x00`; account_changes is an empty list; metadata an empty byte string.
Calls are nested RLP lists of `[to, data]`, never ABI tuples or `[to, value, data]`.

The reader will decode the one outer wrapper call from the proven witness, including
its bounded ABI payload. This makes the payer's economic/call checks depend on the proven
hash even if context getters differ by revision. Cross-check native chain/sender/payer/gas
and call bytes when the pinned client exposes the relevant getters. An unknown getter is
a compatibility gate, not an instruction to quietly trust user-supplied values. The
deployment's explicit profile must state required getters before implementation proceeds.

## 5. Transaction shape and execution state machine

The only accepted sponsored native shape is:

```text
account_changes = []
metadata = 0x
calls = [[ { to: A, data: encode(executeSponsored(request)) } ]]
nonce_key = 0
payer = T != A
```

Inside the account:

```text
Idle
  -> Preparing: sample gStart; validate context and reserve enough outer gas
       M.spend(permission, withdrawalAmount)   // B -> A
       token.approve(S, maxGasUSDC)
       S.reserve(maxGasUSDC)                   // A -> S, funds isolated from user batch
  -> Executing:
       self.call{gas: userCallGasLimit}(executeUserBatch(userCalls))
       inner batch all succeeds OR all reverts; outer wrapper catches either result
  -> Settling:
       sample gStop; publish measured gas and batch result in transient state
       S.settle()                             // swap, ETH -> T, USDC remainder -> A
  -> Idle: clear state; emit outer outcome
```

User calls are ordinary zero-value CALLs from A. `userCallGasLimit` is an **aggregate**
inner-frame cap, not a limit granted to every call. Inner `revert`, child OOG and invalid
opcode must leave cleanup gas available in the outer wrapper. No unbounded returndata
copy: ignore successful return data, and retain at most 256 bytes of failure prefix plus
the full return-data size. Do not label a hash of the prefix as the complete revert hash.

Before launching the child frame, enforce an EIP-150-aware floor that includes child gas,
CALL/dispatch cost, cold-access/memory costs and the proven cleanup reserve. Derive the
exact inequality from compiled code; testing only `gasleft() > userCallGasLimit` is invalid.
Also reject total native gas limits below the calibrated minimum needed for preparation,
the child cap and cleanup. Overlarge or underfunded requests fail in authentication.

### Failure outcomes

| Situation                                     | Token/call outcome                                               | Billing / receipt                                                            |
| --------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Auth invalid                                  | No execution                                                     | No accepted sponsored transaction                                            |
| User batch succeeds, settlement succeeds      | Withdrawal, all user calls and settlement commit                 | Measured bill; outer receipt success                                         |
| User batch reverts/OOG, settlement succeeds   | Withdrawal commits; all user calls roll back; settlement commits | Measured failed work billed; outer receipt success, outcome event says false |
| Preparation or settlement reverts / outer OOG | Entire wrapper including withdrawal and user calls rolls back    | Payer loses actual gas; no user charge or surviving escrow                   |

SDK outcome must inspect the account's `SponsoredExecutionCompleted` and S's `Settled`
events, not just receipt status. A caught failed batch is not a failed native phase.

## 6. Billing and validation economics

All math uses bigint/uint256, stablecoin 1e6 units, ETH 1e18 units and ceiling division.
Use OpenZeppelin `Math.mulDiv(..., Math.Rounding.Ceil)` for price conversion.

```text
measuredWrapperGas = gStart - gStop
billableGas = measuredWrapperGas + BILLING_OVERHEAD_GAS
targetWei = billableGas * tx.gasprice
actualStableCharge = exactOutputDexInput(targetWei)
refundToA = maxGasUSDC - actualStableCharge
serviceFee = 0
```

The measurement includes spend/approval/reserve, dispatch overhead, successful or reverted
child gas consumption and wrapper work between samples. It excludes native pre-entry work,
the settlement tail and final refund credits. `BILLING_OVERHEAD_GAS` is a versioned,
published calibration for those unmeasured costs under the bounded envelope, not a claim
that they were measured. The implementation uses a fixed overhead for the initial profile;
do not charge the cleanup safety margin a second time. Explain deviation from final
`receipt.gasUsed * effectiveGasPrice`, including refund-counter effects, in CLI output.
Any Vibenet L1-data/operator fees outside this model are borne by T in v0 and measured
separately; no invented fee conversion is added to the user's bill.

`CLEANUP_GAS_RESERVE` protects liveness and is separate from billed overhead. Calibrate
both against cold/warm storage, witness sizes, pool paths and revert cases. Unknown
values remain null in `config/vibenet.json`; no native sponsor deployment can use it
until evidence fills them. Guard `billableGas <= gas_limit + protocolMaxAuthenticationGas`;
an accounting bug is an explicit error, not silently clamped underpayment.

For authentication, still reserve worst-case collateral:

```text
maxExposureWei = (gas_limit + confirmedProtocolMaxAuthenticationGas) * max_fee_per_gas
oracleQuote = ceil(maxExposureWei * stablePerEthE6 / 1e18)
requiredMaxGasUSDC = ceil(oracleQuote * 11_000 / 10_000)
```

Require `withdrawalAmount >= maxGasUSDC >= requiredMaxGasUSDC`. This is a **collateral
ceiling**; unused collateral is refunded and is not billed as reserved gas. Pool exact-output
requirements can still exceed the buffer. Require sufficient wrapped-ETH output reserves
and bounded preview quote coverage for the maximum exposure during authentication;
the fixed test oracle is the policy price, not instantaneous pool spot.

The maximum receipt charge/precharge formula itself must be verified on the actual client.
The published draft includes payer authentication and its serialized data outside the
sender `gas_limit`; do not omit witness DA cost or assume the suggested 100,000 gas is
Vibenet's configured ceiling.

### Immutable initial policy

| Parameter                                              | Value                                           |
| ------------------------------------------------------ | ----------------------------------------------- |
| Witness version / max bytes                            | 1 / 2048 (H prefix excluded)                    |
| Native phases / outer calls                            | Exactly 1 / 1 self-call                         |
| User calls                                             | 1–8; no direct self-target or native value      |
| Failure prefix maximum                                 | 256 bytes                                       |
| MAX_GAS_LIMIT                                          | 1,500,000                                       |
| HARD_MAX_FEE_PER_GAS                                   | 5,000,000,000 wei (5 gwei)                      |
| MAX_PRIORITY_FEE_PER_GAS                               | 100,000,000 wei (0.1 gwei), also <= max fee     |
| MAX_VALIDITY_WINDOW                                    | 120 seconds                                     |
| VALIDATION_MARGIN_BPS / SERVICE_FEE_BPS                | 1000 / 0                                        |
| Nonce / metadata / account changes                     | Channel 0 / empty / empty                       |
| Protocol auth cap / billing overhead / cleanup reserve | Evidence-gated; null until confirmed/calibrated |

Normalize draft timestamps independently: nonzero values below 1e11 represent seconds,
otherwise milliseconds. Builder emits seconds from latest chain time, not local wall time.
Require both bounds nonzero, `validAfter <= now <= validBefore`, and normalized
`validBefore-validAfter <=120000ms`. No unlimited expiry or future-dated mempool queue.

The numerical policy bounds imply a per-attempt exposure bound once the protocol auth
ceiling is known. They do not bound aggregate losses under repeated permissionless attacks.
Testnet treasury capital is deliberately finite; actor revocation/unlock is the stop path.

## 7. Oracle, route and treasury

### Test route

Use existing USDV and wrapped ETH. Discover a pair specifically containing those two
addresses in the pinned factory. Never select the first stablecoin pair: the UI's shared
demo pool is VIBE/USDV, and VIBE cannot unwrap into ETH. If the USDV/wrapped-ETH pair is
absent, create and seed it in a later wallet-approved deployment/setup step.

The factory is a **modified zero-fee Uniswap V2** deployment. The `v3` in its deterministic
deployment salt is a fixture version, not Uniswap V3. Use a minimal immutable adapter to
`swapExactOut(tokenIn,pair,amountOut,maxIn)`; confirm the zero-fee runtime/hash before
using its reserve formula. Do not import a standard 0.3%-fee formula or a V3 router ABI.
Test wrapped token `deposit/withdraw` and native backing. Code presence alone is insufficient.

### Test oracle

`IStablePerETHOracle.read() -> (stablePerEthE6, updatedAt)`.
Implement an immutable fixture quote with an explicit validity end; deployment sets a
positive seed-aligned price and a seven-day fixture lifetime. Return deployment time as
`updatedAt`; reject future timestamps and use the matching immutable seven-day age limit.
Expired fixtures require redeployment/reconfiguration through a new immutable profile.
Mocks may expose mutable prices for failure tests, but the end-to-end fixture is immutable.
No market correctness or depeg protection is claimed for USDV. Before real USDC, replace
this with a reviewed ETH/USD divided by USDC/USD adapter, positive/freshness checks,
depeg bounds and any chain-required sequencer-uptime guard.

### Treasury

Use an ERC-1167 clone of the **live compatible** canonical high-rate payer implementation.
Authorize a scope-0 maintenance/recovery actor and H's actor with only `SPONSOR_PAYER`.
Initial pilot actor expiry is zero and lock delay is 600 seconds. Verify receive works
while locked, outbound ETH/config restrictions, unlock/revoke recovery and actual mempool
tiering on the client. Locking is not an application-level guarantee of solvency.
Setup authority is separate from deterministic per-transaction sponsorship.

T must have ETH for precharge before the transaction. Replenishment comes after the inner
batch within the same transaction. Payer refund accounting and solvency are integration
assertions. No paymaster-controlled path sends ETH to A. Arbitrary third-party actions
or forced ETH transfers can still credit A; the claimed zero-ETH demo invariant is for
controlled flows, not a universal guarantee about arbitrary external contracts.

## 8. Authenticator checklist (implementation algorithm)

1. Reject unsupported witness version, empty/oversized data and malformed canonical RLP.
2. Reconstruct protocol payer hash, decode the fixed fields and bounded wrapper calldata.
3. Enforce chain, A, T, nonce channel, empty metadata/changes, native shape and context cross-checks.
4. Validate A's exact delegation target/runtime; reject alternative or mutable implementations.
5. Enforce fee/priority/gas/validity/witness/call bounds and the calibrated minimum gas floor.
6. Enforce `permission.spender=A`, immutable stablecoin, empty extraData, supported M/S bindings.
7. Preview full withdrawal: registration, revocation, current period, remaining allowance,
   B's balance and B→M token allowance. Reject malformed data before external calls.
8. Read the immutable test price with validity checks; inspect fixed pool tokens/reserves
   and maximum exact-output affordability using bounded view calls.
9. Require maxGasUSDC collateral coverage, withdrawal coverage and finite approvals.
10. Return only H's sponsorship actor ID. Bound total authentication including external reads,
    witness DA and actor lookup below the client ceiling with a measured margin.

All dynamic external reads are potential admission invalidators: permission registration,
revocation, period counters, token allowances/balances, code/delegation, pool reserves and
oracle state if the adapter changes. Mempool invalidation/inclusion revalidation must cover
these dependencies; a Solidity unit test cannot prove this client property.

## 9. Client requirements

- `packages/client`: schema-validated inputs/config; eventually bounded ABI/RLP serialization,
  witness creation, fee/gas estimate, sender signing and native result decoding using viem.
- `packages/cli`: read-only `inspect:vibenet` now; later `prepare`, `simulate`, `send`, and
  `receipt` actions with explicit inputs. No hosted payer endpoint.
- SDK input distinguishes `withdrawalAmount`, `maxGasUSDC`, inner `userCallGasLimit`, outer
  `gasLimit` and calibrated billed overhead. Print all before requesting the user signature.
- Construct minimal integer RLP, prove EOAs' resolved payer hash against native golden vectors.
  Do not assume the installed npm viem has a compatible 8130 module; pin an adapter/codec
  after the compatibility spike, with cross-language vectors.
- Estimate the **full wrapper**, its payer witness and authentication. Gas estimate changes
  fee coverage, maxGasUSDC and witness bytes: rebuild until stable or fail after a bounded
  number of iterations. Never silently replace failed estimation with a magic gas limit.
- Print bill semantics, amount that consumes B's period allowance, expected principal left
  for user calls, and refund destination A. A batch failure can still consume the withdrawal
  and gas bill; show outcome events alongside the native receipt.
- Fee bump/replacement rebuilds witness and user signature. Native nonce consumption after
  wrapper failure must be handled explicitly.

## 10. Acceptance criteria

- Starting A at zero ETH/USDC with B→A permission, complete native sponsorship without payer
  API or payer signature; only the permitted amount leaves B and no paymaster ETH reaches A.
- All downstream calls observe A as caller. Successful calls commit atomically.
- Reverting and gas-exhausting batches roll back user actions but still settle and refund;
  the SDK reports user failure despite outer receipt success.
- Increasing the reserved outer gas limit alone does not change the bill for identical
  measured execution (allow only documented gas-sensitive EVM/code path differences).
- B is debited withdrawalAmount, M records the same period spend, S finishes with no active
  user reserve or router allowance, A gets unused gas stablecoin, T gets target native ETH.
- Malicious self-calls/callbacks cannot falsify gas, settle early, reuse escrow or alter the
  selected token/route/treasury. Returndata bombs cannot starve cleanup.
- Invalid/changed permission, balance, allowance, fee, calldata, witness or code is rejected
  before inclusion sponsorship; admission/inclusion behavior is evidenced on Vibenet.
- Forced outer/settlement failure rolls back the entire wrapper and produces a measured,
  documented payer loss within its per-transaction bound.
- Gas reports cover maximum accepted witness/shape and prove the calibrated reserve under
  native execution. Exact final-receipt billing is not asserted.

See [implementation-plan.md](implementation-plan.md) for milestone tests and
[protocol-compatibility.md](protocol-compatibility.md) for the native go/no-go evidence.
