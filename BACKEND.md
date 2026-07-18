# mineetes Backend Setup

The frontend calls same-origin backend routes so TxLINE credentials stay server-side:

- `/api/readiness` reports which backend envs are configured.
- `/api/fixtures` fetches TxLINE fixtures.
- `/api/live?fixtureId=...` fetches TxLINE score snapshots and updates.
- `/api/score-validation?fixtureId=...&seq=...&statKey=...` proxies legacy single-stat validation.
- `/api/score-validation?fixtureId=...&seq=...&statKeys=1,2,3001,3002` proxies current V2 multi-stat validation.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production and Preview:

- `TXLINE_NETWORK`: `mainnet` or `devnet`. Use `mainnet` for the World Cup free-tier docs.
- `TXLINE_ORIGIN`: `https://txline.txodds.com` for mainnet or `https://txline-dev.txodds.com` for devnet.
- `TXLINE_JWT`: guest JWT from `POST https://txline.txodds.com/auth/guest/start`.
- `TXLINE_API_TOKEN`: activated API token from `POST https://txline.txodds.com/api/token/activate`.
- `TXLINE_SERVICE_LEVEL`: `1` for delayed free access or `12` for real-time if your subscription supports it.

Optional:

- `TXLINE_FIXTURE_ID`: pin the app to one fixture instead of choosing from `/api/fixtures`.

Devnet activation/script variables from the runnable examples:

- `ANCHOR_PROVIDER_URL`: `https://api.devnet.solana.com`
- `ANCHOR_WALLET`: path to a funded devnet wallet JSON file, for example `./_keys/testuser-wallet-1.json`
- `TOKEN_MINT_ADDRESS`: `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`

The runnable devnet examples require Node.js `20` or newer.

## Where To Get Them

Use the TxLINE docs:

- Quickstart: https://txline.txodds.com/documentation/quickstart
- World Cup free tier: https://txline.txodds.com/documentation/worldcup
- Runnable devnet examples: https://txline.txodds.com/documentation/examples/devnet-examples

Local setup:

```bash
npm.cmd run txline:setup
```

This writes `.env.local`, selects mainnet World Cup service level `12`, and fetches a guest JWT from `POST https://txline.txodds.com/auth/guest/start`. To use delayed free data instead, run:

```bash
npm.cmd run txline:setup -- --service-level=1
```

For devnet:

```bash
npm.cmd run txline:setup -- --network=devnet --service-level=1
```

Flow:

1. Connect/fund the wallet required by TxLINE.
2. Run `npm.cmd run txline:setup` to write the network, origin, service level, and guest JWT.
3. Submit the TxLINE on-chain `subscribe` transaction for the same network and service level.
4. Sign the exact activation message `txSig::TXLINE_JWT` with the subscribing wallet.
5. Activate the token at `POST https://txline.txodds.com/api/token/activate`.
6. Store the activated token as `TXLINE_API_TOKEN` in `.env.local` and Vercel.
7. Restart local dev or redeploy Vercel so API routes receive the envs.

Devnet notes:

- Use `TXLINE_NETWORK=devnet` with `TXLINE_ORIGIN=https://txline-dev.txodds.com`.
- Keep the wallet network, Solana RPC, TxLINE program, guest JWT host, and activation endpoint on devnet together.
- Use service level `1` for current devnet free-tier examples.
- The docs' fixed `fixtureId` and `seq` pairs are example values. For production settlement, derive `fixtureId`, `seq`, phase, and status from observed score snapshots, updates, historical data, or streams.

Score validation notes:

- Legacy validation uses `statKey`.
- Current V2 validation uses comma-separated `statKeys`; the stat order is part of the proof contract.
- Final score records use `action=game_finalised`, `statusId=100`, and `period=100`.
