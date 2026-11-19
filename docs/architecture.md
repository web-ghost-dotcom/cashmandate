# Architecture

## State without state

A CashScript contract holds no variables between spends. The mandate keeps its terms in the constructor, and keeps its history in the shape of the UTXO set: each spend consumes the vault output and creates a new one at the same address (covenant recursion). Two properties follow:

- The remaining budget is the value of the vault output. It cannot be spent beyond that by construction.
- `this.age`, the relative timelock (OP_CHECKSEQUENCEVERIFY), measures the time since the last spend, because the vault output is new after every spend. That is the rate limit.

## Recipient allowlist

Constructor arguments are fixed, so a list cannot be stored directly without making the script large. The owner commits to `sha256(entry_0 || entry_1 || ...)`. The agent supplies the full list and an index in the unlocking script. The script checks the hash, slices out the entry at the index, builds the P2PKH locking bytecode, and requires output 0 to match. A bad index fails in `split`.

## Why one input

With two vault outputs in one transaction, the per-spend limit would apply once to the transaction, not once per output. `tx.inputs.length == 1` closes that gap.

## Why no expiry path for the agent

Absolute locktime is chosen by the spender, so a script can require a lower bound but never an upper bound. An agent cannot be forced to stop at a date. The owner ends a mandate by sweeping the vault.

## Policy model in the web app

`src/core/spendPolicy.ts` restates the rules as a pure function so the interface can explain a refusal. The contract is the source of truth, and `tests/spendPolicy.parity.test.ts` runs the same proposals through both and requires agreement.

## Recorded refusals

The demo broadcasts rogue spends with `provider.sendRawTransaction` on a transaction built but not locally verified, so the stored message is the network's reply, not the SDK's.

## Sources

- CashScript documentation: https://cashscript.org/docs
- CashScript 0.14.0 type definitions (npm)
- BCH BLAZE: https://bchblaze.cash
