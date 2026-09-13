# Permissionless USDC Paymaster

An EIP-8130 prototype for an account with zero ETH/USDC to execute its own calls using
a pre-registered USDC spend permission from a funded account. Gas is paid through an
onchain payer authenticator and a metered account wrapper.

**Start with [the engineering handover](docs/engineering-handover.md).** It records the
agreed design, billing semantics, contract boundaries, failure behavior and acceptance criteria.

- [Implementation plan](docs/implementation-plan.md) — milestones and expected files.
- [Protocol compatibility](docs/protocol-compatibility.md) — pinned sources and native Vibenet gates.
- [Implementation notes](docs/implementation-notes.md) — what exists and what has been verified.

## Current state

This repository is an implementation scaffold: Solidity interfaces, TypeScript request/config
validation, read-only Vibenet discovery and compatibility probes, and development tooling.
The permission manager, metered account, authenticator, settlement and native transaction
codec are milestone work.

> ⛔ **M0 blocker (2026-09-13):** the native autonomous-payer design is not supported on
> Vibenet. The live client is **canonical-only** (no custom authenticators) and its
> transaction context exposes **no calls/gasLimit getters**. Sponsorship therefore requires
> a per-transaction payer signature, contradicting the "no payer signature" goal. See
> [protocol-compatibility.md](docs/protocol-compatibility.md). Implementation is paused at
> the M0 gate pending a direction decision.

**Status (2026-09-13): intentionally stopped at the M0 gate.** The owner chose not to
adopt a co-signing payer fallback or an alternative architecture. The scaffold is retained
unchanged as a design record; no further milestones are planned unless the target chain
gains permissive/enshrined authenticator support or a different architecture is chosen.

The target is Vibenet (observed chain **84538453**), with **USDV** as the six-decimal test
USDC stand-in and wrapped ETH for replenishment. Candidate configuration contains explicit
nulls for unknown deployment and gas values.

## Setup

Requires Bun **1.3.14** and Foundry (scaffold checked with **1.7.1**).

```sh
git submodule update --init --recursive
bun install --frozen-lockfile
cp .env.example .env.local
bun run check
bun run contracts:check
```

Run Foundry commands on the host, outside a sandbox. The pinned compiler is Solidity
0.8.36 targeting Cancun; this is a local build choice, not proof of native 8130 support.

After edits:

```sh
forge fmt
bun run format
bun run check
bun run contracts:check
```

`bun test` currently checks real input/readiness boundaries. There are no contract behavior
tests yet because only interfaces exist. Introduce Foundry unit/fuzz/native integration
tests alongside their implementations, following the milestone acceptance matrix.

## Inspect the live devnet

```sh
bun run inspect:vibenet
bun run probe:vibenet:8130
```

`inspect:vibenet` reads the public manifest, faucet status, RPC identity, token metadata,
pool reserves and code hashes at a pinned block. `probe:vibenet:8130` records the two
native capability gates (custom-authenticator acceptance and transaction-context getters)
plus the contract-address linkage to the discovered client commit. Both are read-only,
write timestamped reports to `docs/research/`, and never deploy or send transactions.
Command success means the probe ran, not that a gate passed; read the report.

Bun loads optional `VIBENET_RPC_URL` and `VIBENET_API_URL` from ignored `.env.local`.
The inspector enumerates at most 64 pools and errors rather than silently truncating.

## Agreed transaction flow

```text
B: funded EOA -> token allowance + registered spend permission for A
A: zero-ETH delegated metered account
  one sponsored native self-call:
    withdraw B -> A
    escrow maxGasUSDC in settlement
    gas-capped atomic self-call batch; catch failure
    swap metered charge USDV -> wrapped ETH -> ETH to payer
    refund unused gas USDV to A
```

Billing is **measured wrapper gas plus published calibrated overhead**, not reserved gas
and not the exact final receipt fee. Failed inner calls are billed; failed outer settlement
rolls the wrapper back and leaves the testnet payer paying gas. See the handover for details.

MIT. Upstream attribution is in [third-party notices](docs/third-party-notices.md).
