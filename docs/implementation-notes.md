# Implementation notes

## 2026-09-13 — M0 compatibility spike: native design blocked

Started M0 and traced the actual client. Vibenet's discovery endpoint reports
`_commit = b51ca726c`; all six EIP-8130 contract addresses in that revision match the
live manifest, linking the live deployment to the pinned source.

**Two blocking findings (read-only, reproducible via `bun run probe:vibenet:8130`):**

1. **Canonical-only authenticators.** The native 8130 path accepts only native
   secp256k1 (`address(1)`), P-256, WebAuthn, and depth-1 delegate. A non-canonical
   payer `payer_auth` is rejected at the RPC layer (`-32602`, "unrecognized
   authenticator selector") and the execution dispatcher returns `NotCanonical`. The
   proposed `AutonomousUSDCPayerAuthenticator` cannot be a payer actor, so sponsorship
   cannot be decided by custom onchain code and a **per-transaction payer signature is
   unavoidable**. The payer-witness mechanism is moot.
2. **Context lacks calls/gasLimit.** `getTransactionCalls` and `getTransactionGasLimit`
   revert (unknown selectors). Only sender/payer/senderActorId exist. The
   authenticator-inspects-calls design step is impossible.

**Additional corrections:** authenticator metering is a fixed enshrined gas schedule
(`base-common-eip8130` `Eip8130GasSchedule`); there is no `MAX_AUTHENTICATION_GAS`.
Actor scope bits are renumbered, so `SCOPE_SPONSOR_PAYER = 0x04`, not the draft's `0x10`.
The payer hash formula matches the draft (`keccak256(0x7a || rlp([...resolved sender...]))`).

**Consequence:** the handover's central novelty (signature-free autonomous payer) cannot
run on the chosen target. Build is paused at the M0 gate pending a direction decision:
an ERC-8168 co-signing payer service (buildable now), a Base protocol change (not
available), or an ERC-4337 paymaster re-scope. No contract implementation was started,
which is the intended outcome of a failed go/no-go gate.

**Decision (2026-09-13): stop at the blocker.** The owner declined the ERC-8168
co-signing fallback and the ERC-4337 re-scope, and chose to leave the scaffold unchanged
as a design record. Nothing in M1–M7 is to be started; the project is intentionally
frozen at this documented M0 outcome. Resume only if the target chain gains permissive
or enshrined authenticator support, or the owner chooses a different architecture.

Evidence: [probe.json](research/2026-09-13T16-36-38.037Z/probe.json),
[discovery report](research/2026-09-13T15-42-29.265Z/report.json).

## 2026-09-13 — Design closure and initial scaffold

- Resolved the funding model: B funds; A has zero ETH/USDC and a pre-registered B→A spend
  permission. The EOA-friendly manager uses ERC-20 transferFrom and fixed spender recipient.
- Replaced the initial reservation-billed native two-phase design with a single metered
  account wrapper, gas-capped atomic child batch and catch-and-settle behavior.
- Agreed billing measures wrapper work plus published calibrated overhead; final receipt
  charge equality is not promised. No service fee. Explicit withdrawal principal and gas
  ceiling; unused gas stablecoin goes to A and full withdrawal consumes B's allowance.
- Selected Vibenet USDV/wrapped ETH, existing zero-fee V2 factory/helper and immutable
  fixture oracle. Existing VIBE/USDV cannot redeem ETH.
- Pinned public source revisions and recorded EIP/reference context-interface mismatch
  and discovery/UI address drift as engineering evidence gates.
- Initialized local Git, Foundry/Bun workspaces, project AGENTS.md, MIT licensing, pinned
  dependencies, interface-only contract boundaries and read-only discovery tooling.
- No production paymaster, permission manager, metered account or transaction codec is
  implemented by the scaffold. Native compatibility and economic calibration remain M0/M7 work.

- Corrected an initial manual chain-ID conversion error: RPC `0x509f455` is **84538453**,
  matching faucet metadata. The preliminary inspector report's candidate mismatch was
  caused by that incorrect candidate configuration, not by an RPC/faucet disagreement.
- Live read-only discovery at block 1308110 confirmed USDV=6 decimals, WETH=18 decimals,
  zero reported WETH supply, one factory pair (VIBE/USDV), and no USDV/WETH pair.
- Scaffold verification: `bun run check` passed (format, lint, typecheck and 9 boundary tests);
  `bun run contracts:check` compiled all 8 Solidity interface files with 0.8.36 successfully.
  The inspector completed and saved block-pinned metadata/code hashes and raw public API data.
- A second discovery run with the corrected candidate chain and pinned genesis completed
  with no discovery conflicts. See
  [the final scaffold discovery report](research/2026-09-13T15-42-29.265Z/report.json).
  Native authenticator/context support remains unproven; discovery does not close those gates.
