# mineetes Superteam Submission Checklist

Track: Prediction Markets and Settlement by TxODDS

Source listing: https://superteam.fun/earn/listing/prediction-markets-and-settlement

## Requirement Mapping

| Track expectation | mineetes coverage |
| --- | --- |
| Prediction markets | 60-second binary micro-markets with YES/NO selection, stake lock, frozen pool, and payout state. |
| Settlement | Deterministic settlement receipts include answer, target minute, fixture, sequence, source, event count, and rule. |
| TxODDS/TxLINE live data | Server-side TxLINE API routes fetch fixtures, score snapshots, and score updates without exposing secrets. |
| Oracle tooling | `/api/readiness`, `/api/fixtures`, `/api/live`, and `/api/score-validation` isolate TxLINE access behind backend routes. |
| On-chain proof integrations | `/api/score-validation` proxies TxLINE legacy `statKey` and current V2 `statKeys` proof endpoints for future Solana validation. |
| Frontend | Mobile-first React/Vite match companion UI with fixture selection, wallet identity, staking, timer, settlement, and proof disclosure. |
| Backend | Vercel serverless API routes keep `TXLINE_JWT` and `TXLINE_API_TOKEN` server-side. |
| Blockchain | Wallet identity is integrated; backend exposes TxLINE score-validation proof data. Treasury custody must be connected before accepting real funds. |
| Mobile | Primary layout is a phone-frame responsive experience with touch-sized controls. |
| Design | Comic/arcade visual system documented in `DESIGN.md`, with visible state and accessibility rules. |

## Honest Scope Boundary

mineetes ships the live-data and settlement-proof path for the hackathon build. Real-money custody, compliance, KYC/geofencing, and audited Solana escrow must be completed before public wagering launch.

## Production Flow

1. Open the app on mobile or desktop.
2. Confirm TxLINE readiness chips show configured backend state and a successful live poll.
3. Select a fixture.
4. Enter any positive stake within the available balance.
5. Lock YES/NO during the 00s-30s market-open window.
6. Watch the 30s-60s frozen market window.
7. Inspect the settlement receipt and proof details.

## Required Environment Variables

See `BACKEND.md` for exact env setup and where to get each TxLINE value.

Minimum live TxLINE backend envs:

```env
TXLINE_NETWORK=mainnet
TXLINE_ORIGIN=https://txline.txodds.com
TXLINE_JWT=...
TXLINE_API_TOKEN=...
TXLINE_SERVICE_LEVEL=12
```

Devnet validation support:

```env
TXLINE_NETWORK=devnet
TXLINE_ORIGIN=https://txline-dev.txodds.com
TXLINE_SERVICE_LEVEL=1
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
TOKEN_MINT_ADDRESS=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG
```

## Verification

Run:

```bash
npm.cmd test
npm.cmd run build
```
