# Atomic EVM Arbitrage Engine

A prefunded, **atomic-or-revert** arbitrage backend for EVM chains. It searches cross-venue and triangular routes across:

- Uniswap-V2-compatible routers
- Uniswap-V3-compatible routers and fee tiers
- Uniswap Trading API routes across Uniswap V2, V3 and V4

The backend builds every leg, submits the entire route to `AtomicArbExecutor`, and the contract reverts unless its complete ending balance in the starting token is at least:

```text
full starting balance + minProfit
```

This means no partial route can remain settled. A reverted transaction can still consume gas.

## Important status

This package is production-oriented code, but it is **not an audited financial product**. Deploy on a fork or testnet, validate every configured router/proxy address, then fund a deliberately small WETH float before increasing exposure.

The old V2 engine remains available as `legacy/legacy-v2-index.js` for reference only. The default `npm start` uses the new hybrid engine.

## Docker quick start

```bash
./ops/stack.sh init
# Edit .env and keep ENABLE_EXECUTION=false
./ops/stack.sh validate
./ops/stack.sh deploy-executor
# Put the printed contract address into EXECUTOR= in .env
./ops/stack.sh configure-executor
./ops/stack.sh up
./ops/stack.sh health
./ops/stack.sh ui
```

Skip the deployment step only when `EXECUTOR` already points to the verified contract for the configured chain. The Compose stack binds the admin API to `127.0.0.1` on the host, runs the bot as an unprivileged user with a read-only filesystem, rotates Docker logs, and provides isolated one-shot services for contract deployment and executor configuration. See [`DOCKER.md`](DOCKER.md) for the complete deployment sequence and optional Docker secrets overlay.


## Local React/Reown dashboard

The Docker stack includes a Vite React operations interface at:

```text
http://localhost:4173
```

Add your Reown project ID to `.env` before starting the stack:

```dotenv
REOWN_PROJECT_ID=your_reown_project_id
UI_BIND_ADDRESS=127.0.0.1
UI_PORT=4173
```

Start both services and open the interface from WSL:

```bash
./ops/stack.sh up
./ops/stack.sh ui
```

To view the interface before the backend/executor is fully configured:

```bash
./ops/stack.sh up-ui
./ops/stack.sh ui
```

The dashboard will load and clearly report that the backend is unavailable until the scanner service is ready.

The UI proxies backend requests over the private Compose network, so the browser uses one localhost origin and the backend API remains bound to server loopback. Paste `ADMIN_API_TOKEN` into the interface when prompted; it is retained only in the browser tab's session storage and is not compiled into the frontend image.

The dashboard provides:

- Reown AppKit EVM wallet connection
- backend and chain health
- executor owner, operator, treasury and pause state
- WETH inventory, principal floor, maximum trade size and sweepable excess
- V2/V3/API venue visibility
- latest atomic opportunities
- observation scans
- guarded live scan/execution when backend live mode is enabled
- guarded excess-profit sweep to the configured treasury

Wallet connection is informational and helps confirm whether the connected address matches the executor owner/operator. Backend actions remain protected by `ADMIN_API_TOKEN` and are signed only by the backend operator key.

## Main safety changes

1. **Atomic generic route executor**
   - Supports V2, V3 and API-generated Universal Router/proxy calldata.
   - Every target and spender must be allowlisted on-chain.
   - Exact ERC-20 approvals are set immediately before each step and reset to zero immediately after it.
   - The entire starting token balance is snapshotted, not just `amountIn`.

2. **Correct triangular profit accounting**
   - Profit is `endBalance - startBalance`.
   - The former double-subtraction bug is not present in the new executor.

3. **Principal floor and capped trade size**
   - `principalFloor[token]` is enforced after every trade and every ordinary profit sweep.
   - `maxTradeAmount[token]` limits the declared input size.
   - Emergency recovery requires the contract to be paused and is owner-only.

4. **Safe profit sweeping**
   - `sweepExcess()` can transfer only the amount above `principalFloor`.
   - It pays only the fixed on-chain treasury address.
   - The backend never converts or sweeps the entire executor balance as “profit.”

5. **Protected operations API**
   - `/status`, `/scan-once`, and `/sweep-excess` require `ADMIN_API_TOKEN`.
   - The server binds to `127.0.0.1` by default.
   - There is no unauthenticated remote shutdown route.

6. **Private submission boundary**
   - Live execution requires `PRIVATE_TX_RPC_URL`.
   - Public submission is rejected unless `ALLOW_PUBLIC_MEMPOOL=true` is set deliberately.

7. **No secret included**
   - The distributable ZIP excludes `.env` and `.git`.
   - Rotate the private key from the original uploaded archive before using meaningful funds.

## Architecture

```text
V2 router quotes ─┐
V3 quoter quotes ─┼─> route scanner ─> fresh quotes ─> static preflight
Uniswap API V2+ ──┘                                      │
                                                         v
                                             AtomicArbExecutor.executeAtomic
                                                         │
                          all calls succeed + profit floor met, or full revert
                                                         │
                                                         v
                                      WETH principal remains + profit accumulates
                                                         │
                                                         v
                                      sweep only excess above principal floor
```

## Uniswap API integration

The backend uses the Uniswap Trading API with:

```text
x-api-key: <one backend key from UNISWAP_API_KEYS>
x-permit2-disabled: true
x-universal-router-version: 2.0
```

The no-Permit2 proxy flow is used because the swapper is the executor contract and cannot produce an EOA Permit2 signature. Quote requests are restricted to AMM protocols by default:

```text
V2,V3,V4
```

The quote is used to obtain the best split/multi-hop Uniswap route. `/swap` then returns calldata targeting the Uniswap proxy/Universal Router flow. That calldata is executed as one allowlisted step inside the atomic executor.

UniswapX is intentionally excluded because it is an order/filler workflow rather than a synchronous AMM call suitable for this prefunded atomic transaction.

## Requirements

- Node.js 20.12 or newer
- An EVM RPC endpoint
- A private transaction RPC endpoint for live execution
- A Uniswap Developer Platform API key
- A deployed `AtomicArbExecutor`
- WETH and a small, liquid quote-token universe

## Install and validate

```bash
npm install
npm run check
```

`npm run check`:

- compiles `contracts/AtomicArbExecutor.sol`
- writes `artifacts/AtomicArbExecutor.json`
- runs Node tests
- performs JavaScript syntax checks

## Deploy the executor

Compile first:

```bash
npm run compile:contracts
```

Set local deployment variables:

```bash
export RPC_URL='https://...'
export PRIVATE_KEY='0x...'
export TREASURY_ADDRESS='0x...'
export OWNER_ADDRESS='0x...'       # optional; defaults to deployer
export OPERATOR_ADDRESS='0x...'    # optional; defaults to deployer
npm run deploy:contract
```

After deployment, configure the contract before funding it. Fill the one-time on-chain values in `.env`, then run:

```bash
npm run configure:executor
```

The script pauses the executor first, allowlists every configured V2 router, V3 router and the Uniswap proxy as both target and spender, then sets the WETH principal floor, maximum trade size, sweep policy, gas-price ceiling, operator and treasury. It leaves the executor paused unless `UNPAUSE_EXECUTOR=true` is deliberately supplied.

Verify every address against the selected chain before unpausing. Do not assume router or quoter addresses are identical across EVM networks.

## Environment configuration

Copy the template:

```bash
cp .env.example .env
chmod 600 .env
```

### Treasury base

For the dormant-ETH use case, keep the starting token as WETH:

```dotenv
BASE_TOKENS=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
```

This keeps input, profit and gas floors denominated consistently in native-token units.

### Explicit trade-size grid

The scanner does not guess how much treasury capital it may use:

```dotenv
ARB_INPUTS_JSON={"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2":["100000000000000000","250000000000000000","500000000000000000"]}
```

Those values represent 0.1, 0.25 and 0.5 WETH. Start below 5% of the intended working float per route and raise limits only after measured live performance.

### V2 routers

```dotenv
V2_DEXES_JSON=[
  {"id":"dex-a-v2","name":"DEX A V2","router":"0x...","feeBps":30},
  {"id":"dex-b-v2","name":"DEX B V2","router":"0x...","feeBps":30}
]
```

The backend calls each router's `getAmountsOut` directly for configured token pairs and builds `swapExactTokensForTokens` calldata.

### V3 routers

```dotenv
V3_DEXES_JSON=[
  {
    "id":"uniswap-v3",
    "name":"Uniswap V3",
    "router":"0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    "quoter":"0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    "quoterKind":"v2",
    "routerKind":"swap-router-02",
    "feeTiers":[100,500,3000,10000]
  }
]
```

For V3-compatible forks, set the fork's router, quoter, ABI kind and supported fee tiers.

### Uniswap API

```dotenv
UNISWAP_API_ENABLED=true
UNISWAP_API_KEYS=backend_key_one,backend_key_two
UNISWAP_API_PROTOCOLS=V2,V3,V4
UNISWAP_PROXY_ADDRESS=0x0000000085E102724e78eCd2F45DC9cA239Affad
```

Keys remain backend-only, rotate across requests, and retry another configured key for rate-limit, authentication or transient server failures. They are never returned through HTTP endpoints or logs.

## Run in observation mode

Keep execution disabled:

```dotenv
ENABLE_EXECUTION=false
```

Start:

```bash
npm start
```

Public health endpoint:

```bash
curl http://127.0.0.1:4123/health
```

Authenticated status:

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  http://127.0.0.1:4123/status
```

Manual scan without execution:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"execute":false}' \
  http://127.0.0.1:4123/scan-once
```

## Enable live execution

Only after fork/testnet verification:

```dotenv
PRIVATE_TX_RPC_URL=https://your-private-transaction-endpoint
ENABLE_EXECUTION=true
ALLOW_PUBLIC_MEMPOOL=false
```

At startup, the backend verifies:

- RPC chain ID matches `CHAIN_ID`
- the hot wallet is the executor owner or operator
- the executor is not paused
- at least two venues are configured
- public broadcast has not been enabled accidentally

Every candidate is re-quoted immediately before execution, its gas-backed profit floor is recalculated using current fee data, and the complete call is then simulated using `executeAtomic.staticCall`. Failed candidates are skipped without submitting a transaction.

## Route types

### Cross venue

Examples:

```text
WETH -> USDC on V2 router A
USDC -> WETH on V3 router B
```

```text
WETH -> DAI through a configured V3 pool
DAI -> WETH through the Uniswap API's best V2/V3/V4 route
```

### Triangular

The scanner uses a bounded beam search:

```text
WETH -> USDC -> DAI -> WETH
```

At least two distinct venue IDs must be involved. The complete three-step route executes in one executor transaction or reverts.

## Profit floor

A candidate must exceed the maximum of:

```text
absolute native profit floor
ROI floor on WETH input
gas estimate × safety multiplier
1 wei
```

Do not force a daily trade target. A safe engine should submit zero transactions when no route clears all costs and safety margins.

## Profit sweep

Set the WETH principal floor on-chain to the working float. Then enable backend sweeping:

```dotenv
PROFIT_SWEEP_ENABLED=true
PROFIT_SWEEP_MIN_WEI=1000000000000000
```

The backend calls:

```solidity
sweepExcess(WETH, type(uint256).max)
```

The executor computes:

```text
excess = current WETH balance - principalFloor[WETH]
```

Only that excess can reach the fixed treasury address.

## Operational recommendation for roughly US$30,000 of ETH

Do not place all funds in the hot executor initially. A conservative rollout is:

- 70–80% retained outside the executor
- 15–25% working WETH float
- separate native ETH gas balance in the operator wallet
- per-trade cap initially 5–10% of the working float

Raise the working float only after the system has demonstrated positive **net** results after gas, failed attempts and infrastructure costs.

## Files

```text
contracts/AtomicArbExecutor.sol  new atomic V2/V3/V4-capable executor
src/server.js                    authenticated backend and scheduler
src/scanner.js                   cross-route and triangular search
src/venues.js                    V2 and V3 quote/execution adapters
src/uniswap-api.js               Uniswap Trading API quote/swap adapter
src/execution.js                 preflight and private submission
legacy/legacy-v2-index.js        previous V2-only engine, reference only
```

## Remaining production work

Before significant mainnet funding:

- obtain an independent Solidity/security review
- add fork-based integration tests against every configured router
- add metrics and alerts for failed simulations, reverted transactions and API errors
- use a dedicated operator key and hardware/multisig owner
- monitor private relay behaviour and transaction inclusion
- maintain a strict token allowlist; avoid fee-on-transfer, rebasing and malicious tokens

## USD valuation and profit-floor history

Version 3.4.0 derives a native-token USD reference from the median of live on-chain quotes into configured stablecoins. It displays USD estimates beside native values for route input, output, gas, gross profit, net profit, required profit and shortfall.

Positive-spread near misses also include an estimated minimum profitable input. This is a linear observation based on the current quoted spread and must always be re-quoted because liquidity depth and price impact can invalidate the estimate.

Route observations are retained in the `atomic-evm-arbitrage-history` Docker volume. The dashboard summarizes observation count, profitable hits, best threshold coverage, median estimated input floor and the lowest input that actually passed the configured profitability policy.
## Verified estimated-floor quotes

Version 3.5.0 treats the calculated minimum profitable input as a target to test, not as a promise. For the top rejected routes, the scanner re-quotes the exact same venue sequence and preserves the observed V3 fee tier on every leg. The result is stored as `PROFITABLE`, `BELOW_FLOOR`, `QUOTE_FAILED`, or `ABOVE_CAP`.

The floor quote is observation-only. It does not alter `MAX_TRADE_AMOUNT_WEI`, reconfigure the executor, or make an oversized route executable. `FLOOR_REQUOTE_MAX_INPUT_WEI` limits the largest input the scanner will test. Persistent history distinguishes normal grid profitability from confirmed floor-quote hits.

The dashboard sections are collapsible. Route rows show a compact summary by default and expand to show full BNB/USD values, estimated gas, the 2x-gas requirement, shortfall, estimated floor and the real same-path floor quote outcome.


## Multi-RPC scanning

Version 3.6 can shard quote work across several HTTP RPC endpoints while pinning every route leg to the same block. Optional WebSocket watchers trigger deduplicated fast scans on new blocks. See [MULTI-RPC.md](./MULTI-RPC.md) for the safety model, scan modes and health telemetry.

### Full calibration versus fast scans

Version 3.6.1 retains the latest full-scan result separately from WebSocket-triggered fast scans. The main candidate and near-miss panels therefore continue to show coverage across the complete configured input ladder, while fast scans remain visible in infrastructure telemetry without replacing calibration results.
