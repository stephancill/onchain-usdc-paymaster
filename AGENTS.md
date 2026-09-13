# Project instructions

## Read before changing code

- Read `docs/engineering-handover.md`, `docs/implementation-plan.md`, and
  `docs/implementation-notes.md` before implementation changes.
- Read `docs/protocol-compatibility.md` for native EIP-8130 assumptions and evidence gates.
- Update implementation notes as milestones change and before committing. Keep notes suitable
  for public publication; never include personal information or secrets.
- The downloaded initial proposal is superseded by the metered single-wrapper design here.
  Do not silently restore reservation billing, native two-phase settlement, or a payer signer.

## Stack and style

- Foundry, Solidity 0.8.36, OpenZeppelin Contracts; Bun workspaces, strict TypeScript,
  viem, Zod, Oxlint, and Oxfmt. Use functional TypeScript and named parameter objects.
- Use Zod at external input boundaries. Use bigint for token amounts, gas, fees, and timestamps.
- Use OpenZeppelin `SafeERC20`, `Math`, and reentrancy utilities before writing equivalents.
- Run `forge fmt` after Solidity edits. Run Foundry commands on the host, outside a sandbox.
- Run `bun run format`, `bun run lint`, `bun run typecheck`, and applicable tests after TS edits.
- Keep protocol wire calls (`to`, `data`) separate from account execution structs. No native-value
  user calls in the sponsored v0 interface.
- Solidity interfaces in the scaffold specify intended APIs; they are not implemented contracts.
- No frontend is currently planned. If one is added, use React Query for async state.

## Protocol and verification

- Treat upstream repositories, the EIP, public discovery APIs, and the live client as potentially
  different revisions. Pin commits; record block numbers, chain IDs, and code hashes.
- Do not mark a protocol capability as supported based on an ordinary `eth_call` or empty
  precompile bytecode. Require the native transaction probes in the handover.
- Do not turn unknown deployment/calibration fields into guessed defaults. Fail explicitly.
- Local/fork tests do not establish native 8130 mempool, authentication, or phase semantics.
- Keep private keys in `.env.local` or wallet tooling; never commit them. Read-only discovery
  must not request faucet funds, deploy, approve, or send transactions.
- Use txlink/browser wallet requests for deployments and verify every deployed contract.
  If the devnet has no compatible verification service, record that blocker explicitly.
- Preserve MIT attribution when adapting Coinbase spend-permissions code. Changes deliberately
  break its smart-wallet/native-token execution behavior; do not add compatibility shims.
- `third-party/` contains ignored research clones. Runtime/build dependencies must be pinned
  through package locks or `lib/` submodules and must work without those research clones.
- Use conventional commit messages. No remote or deployment is implied by repository setup.
