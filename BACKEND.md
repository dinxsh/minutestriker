# haramball.xyz Bento Backend Setup

The frontend calls same-origin backend routes so the Bento Builder API key stays server-side:

- `/api/bento-readiness` reports backend configuration.
- `/api/bento-markets` fetches public market catalog rows.
- `/api/bento-market?duelId=...` fetches one market by on-chain `duelId`.
- `/api/bento-login` exchanges a wallet-signed login message for a user JWT.
- `/api/bento-estimate` previews a bet before placement.
- `/api/bento-place-bet` places the previewed bet with an idempotency key.
- `/api/bento-portfolio` reconciles account details and positions after accepted writes.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production and Preview:

```env
BENTO_URL=https://internal-server.bento.fun
BENTO_BUILDER_API_KEY=bnt_...
```

The backend also accepts the hackathon shorthand:

```env
BUILDER_API_KEY=bnt_...
```

Optional:

```env
PARLAY_TOURNMENT_URL=https://bento-fun-tournaments-backend-3nku.onrender.com
```

The `PARLAY_TOURNMENT_URL` spelling matches the hackathon reference repo. The backend also accepts `PARLAY_TOURNAMENT_URL`.

## Bento Flow

1. Load public market catalog.
2. Create a haramball.xyz fan profile.
3. Connect an EVM wallet.
4. Sign the Bento login message:
   `Bento.fun Login\n Timestamp: ${timestamp}\n Wallet: ${address}`
5. Store the returned user JWT in the browser session.
6. Preview the selected option and stake through `/api/bento-estimate`.
7. Place the bet through `/api/bento-place-bet`.
8. Poll `/api/bento-portfolio` until the account reflects the position.

## Legacy TxLINE Routes

The old TxLINE prototype files remain in the repository for reference and tests, but they are no longer the active product path.

## Hackathon Reference

- Reference repo: https://github.com/Bentodotfun/build-on-bento
- Required form: https://forms.gle/UiJB7fVNCpwvnVLa7
