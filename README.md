# haramball.xyz

haramball.xyz is a mobile-first World Cup prediction-market client. It turns Bento catalog reads, wallet login, quotes, bet placement, profile onboarding, leaderboards, and portfolio reconciliation into a fast YES/NO matchday loop.

## Bento Fit

- Public market discovery before login
- Wallet-signed auth for user actions
- Fan profile onboarding and leaderboard identity
- Quote-before-place flow with shares, slippage, and idempotency
- Portfolio polling after accepted writes
- Match ticket drawer with market id, preview id, account, stake, and outcome

## Backend Setup

Bento credentials stay server-side. See [BACKEND.md](BACKEND.md) for required environment variables.

Hackathon reference:

- Repo: https://github.com/Bentodotfun/build-on-bento
- Form: https://forms.gle/UiJB7fVNCpwvnVLa7

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```
