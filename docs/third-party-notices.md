# Third-party notices

## Coinbase Spend Permissions

The `SpendPermission` field layout in `contracts/src/interfaces/PaymasterTypes.sol` and
the planned recurring-permission implementation derive from
[coinbase/spend-permissions](https://github.com/coinbase/spend-permissions), pinned at
`e0004e63edc4e17de7aa978293800ac7a16892e5`. The fork replaces smart-wallet execution
with ERC-20 allowance-based transfers. Preserve this notice with adapted code.

MIT License

Copyright (c) 2024 Coinbase

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Pinned dependencies and reference APIs

- OpenZeppelin Contracts v5.7.0: `lib/openzeppelin-contracts/LICENSE` (MIT), Git submodule
  `cab19933c33c2ad1d4c7a84864a3601dddfd16f3`.
- forge-std v1.16.2: `lib/forge-std/LICENSE-MIT` and `LICENSE-APACHE`, Git submodule
  `bf647bd6046f2f7da30d0c2bf435e5c76a780c1b`.
- EIP-8130 interface signatures are described in the CC0 EIP and the MIT
  [base/eip-8130](https://github.com/base/eip-8130) reference repository. Source pins and
  interface differences are recorded in `protocol-compatibility.md`.
- `base/ui` is used for public deployment research. Its application source/compiled
  artifacts are not bundled in this project's runtime.
- JavaScript dependency licenses are supplied by the installed packages; versions and
  integrity records are pinned in `bun.lock`.
