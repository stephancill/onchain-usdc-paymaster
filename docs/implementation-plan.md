# Implementation plan

> ⛔ **PROJECT PAUSED AT M0 (2026-09-13).** The native autonomous-payer mechanism is not
> supported on Vibenet (canonical-only authenticators; no calls/gasLimit context getters).
> The owner chose to **stop at the blocker** rather than adopt an ERC-8168 co-signing payer
> or re-scope. Do **not** start M1+ or implement the custom authenticator. The scaffold and
> handover are retained unchanged as a design record. See `protocol-compatibility.md`.

Start each milestone by reading the engineering handover and implementation notes.
Ownership labels identify workstreams for the engineer taking the handover; they do not
imply parallel-agent execution. Update evidence links and completion state as work lands.

## M0 — Native compatibility spike (protocol/client engineer)

- [x] Resolve G01–G06 and G08 in `protocol-compatibility.md`; record exact client profile.
      → G01 passed; **G02 failed** (canonical-only), **G03** source-confirmed,
      **G04 failed** (only 3 getters), G05 superseded, G06 partially known, G08 unproven.
- [x] Read-only native probes recorded (`bun run probe:vibenet:8130`).
- [ ] ⛔ **BLOCKED: direction decision.** Native autonomous payer is unsupported. Resume
      only after choosing an ERC-8168 co-signing payer, a Base protocol change, or an
      ERC-4337 re-scope. Do not implement the custom authenticator.
- [ ] Validate EOA 7702 metered-account onboarding at zero account ETH with relayed setup.
- [ ] Determine native signature/codec adapter from the pinned deployed wire format.
- [ ] Resolve G10/G11 before deploying project contracts.

**Exit:** Native sponsorship with custom view authentication is demonstrated, required context
is available or an explicitly reviewed adapter is specified, and gas constants are sourced.
On failure document the exact blocked gate. No claim of permissionless native compatibility.

**Result (2026-09-13): FAILED.** Custom authenticators are rejected (canonical-only) and the
context lacks calls/gasLimit getters. The native autonomous payer is unsupported on Vibenet
`b51ca726c`. See `protocol-compatibility.md`. Milestones M1–M7 as written presume the
blocked mechanism and must be re-planned once a direction is chosen.

## M1 — EOA permission fork (contracts engineer)

- [ ] Adapt recurring structs/hash/period accounting with attribution; implement immutable stablecoin-only transferFrom.
- [ ] Direct `approve`, `revoke`, `spend` and bounded shared `previewSpend`.
- [ ] Unit/fuzz: two permissions with identical fields except salt; period rollover and truncated
      final period; start inclusive/end exclusive; max uint widths; revoked cannot reapprove;
      insufficient full-withdrawal balance/allowance; wrong spender/recipient/token; reentrant token.
- [ ] Fund B, leave A empty, and assert exact B→A movement and period consumption.

**Exit:** Preview and spending agree under the same state, rejected spends produce no state
change, EOA B needs only ERC-20 allowance and registration, no smart-wallet calls remain.

## M2 — Bounded payer witness / authentication (contracts + client engineer)

- [ ] TS payer RLP/hash/witness encoder and bounded Solidity fixed-13-field reader.
- [ ] Golden vectors in `fixtures/` shared by Bun and Foundry; cross-check native M0 output.
- [ ] Fuzz canonical integer/list boundaries, trailing bytes, wrong field counts, wrong widths,
      truncated/oversized blobs, version byte, decoded calls/ABI offsets and seconds/ms normalization.
- [ ] Enforce one self-wrapper call, bounded request, nonce channel 0, empty changes/metadata,
      fees, validity, delegation code, full withdrawal preview and collateral policy.
- [ ] Reject each mutated committed field and attempts to spoof the payer's max fee.

**Exit:** Hash proof and call policy cannot be bypassed by unauthenticated witness bytes;
maximum accepted authentication including data cost fits G05 with measured margin.

## M3 — Metered account and mock settlement (contracts engineer)

- [ ] Strict native self-entry, supported delegation target/hash and transient lifecycle.
- [ ] Pull permission USDC, exact ceiling approval/reserve, one-shot atomic child batch.
- [ ] EIP-150-aware aggregate gas forwarding and cleanup floor, bounded returndata copying.
- [ ] Meter start/stop, callback phase authentication, no user-supplied measured gas.
- [ ] Tests for atomic rollback, preserves A as msg.sender, false outcome with successful
      outer receipt, nested entry, malicious self/settlement callbacks and code/authority changes.
- [ ] Gas burner, INVALID, revert bomb, huge successful return and arbitrary gas-sensitive call tests.

**Exit:** Reverted/OOG child work is billed and cleanup survives; no callback can counterfeit
or reuse the meter. Outer failure leaves no escrow, permission spend or user-call state.

## M4 — Exact-output settlement (contracts engineer)

- [ ] Stablecoin ceiling escrow; zero-fee V2 fixed-pair/helper adapter; positive/valid fixture oracle.
- [ ] Exact router allowance/reset, wrapped-ETH withdrawal, ETH to T, USDC refund to A.
- [ ] Settled/outcome events and balance-delta assertions; no active escrow after success.
- [ ] Tests for reserve movement, insufficient output liquidity, max input, dust, incorrect fee
      implementation, wrong tokens, ETH receive stipend, treasury rejection, router reentrancy and expiry.

**Exit:** Actual USDC input is <= signed ceiling and buys the calculated metered ETH amount.
Outer settlement failure is measured as payer loss, not disguised as successful repayment.

## M5 — Vibenet fixture/treasury setup (integration engineer)

- [ ] Confirm/reuse USDV and backed wrapped ETH; create/seed missing USDV/wrapped-ETH pair.
- [ ] Fixed-order CREATE bootstrap resolves mutual S/account constructor references; assert predicted addresses and verify each child.
- [ ] Deploy immutable seven-day oracle aligned to seed ratio and project contracts through wallet links.
- [ ] Canonical high-rate clone, scope-0 maintenance actor, scope-0x10 H actor, 600-second lock.
- [ ] Verify contracts; save constructor args, addresses, code hashes, tx hashes and protocol profile.
- [ ] B pre-registration/allowance and separately relayed A delegation.

**Exit:** Verified fixture manifest passes readiness validation; all setup transactions have
artifacts. G09–G11 proven. No deployment is part of the initial repository scaffold.

## M6 — Native client and end-to-end demo (client + integration engineer)

- [ ] Bounded full-wrapper estimation loop, signed fee caps, witness generation, sender signing.
- [ ] Direct RPC send; no hosted payer or paymaster signing key.
- [ ] Receipt and custom outcome parsing, explicit billed-vs-receipt gas comparison.
- [ ] Successful call, inner revert, child OOG, outer failure and replacement/nonce demos.
- [ ] G07 state invalidation experiments for balances, allowances, permissions, code and reserves.

**Exit:** All handover acceptance criteria have native evidence. Local/fork outcomes alone do
not close this milestone; catch-and-settle outcome must be distinguishable in client output.

## M7 — Calibration and adversarial review (contracts + protocol engineer)

- [ ] Benchmark minimum/maximum witness, ABI payload, call count, permission/oracle/pool reads.
- [ ] Fit and publish fixed BILLING_OVERHEAD_GAS and separate CLEANUP_GAS_RESERVE for this profile.
- [ ] Verify gas floors across cold/warm storage, storage refunds, token approval paths and failures.
- [ ] Quantify per-attempt native max exposure and remaining aggregate repeated-failure risk.
- [ ] Test attacker-controlled user actions that move the pool before settlement.
- [ ] Review RLP/ABI parser, metering callback and account-control surfaces.

**Exit:** Reproducible gas reports, no unset deployment constants, all accepted inputs inside
the tested gas/authentication envelope, and documented delta from final protocol fees.

## Directory map / expected implementation files

```text
contracts/src/
  accounts/MeteredUSDCAccount.sol
  auth/AutonomousUSDCPayerAuthenticator.sol
  auth/PayerWitness.sol
  auth/PayerRLPReader.sol
  permissions/EOASpendPermissionManager.sol
  settlement/USDCPaymasterSettlement.sol
  settlement/ZeroFeeV2ExactOutputAdapter.sol
  oracle/FixedTestPriceOracle.sol
  interfaces/*.sol                       # scaffolded API contracts
contracts/test/{unit,fuzz,integration}/  # introduce alongside actual implementation
contracts/script/                       # verified browser-wallet deployment tooling
packages/client/src/                    # input/config schemas now, codec/builder next
packages/cli/src/                       # read-only discovery now, native workflows next
config/                                # candidate configuration, explicit null gates
fixtures/                              # native/TS/Solidity wire vectors as M0/M2 land
docs/research/                          # public raw discovery and pinned-block report
```

At scaffold stage the listed concrete contract files are planned, not placeholder deployable
contracts. Interfaces compile and configuration tests exercise real boundary validation.
