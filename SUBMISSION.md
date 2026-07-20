# haramball.xyz Bento Integration Notes

haramball.xyz is scoped as a World Cup prediction-market client designed to bring more users into Bento markets through a clean matchday experience.

## Product Mapping

| Bento surface | haramball.xyz coverage |
| --- | --- |
| Public market catalog | `/api/bento-markets` powers the primary card feed. |
| Market detail | `/api/bento-market` reads by `duelId`, not database row id. |
| Wallet login | Browser wallet signs Bento's EOA login message. |
| Managed account | UI separates signing wallet from market account. |
| Quote flow | `/api/bento-estimate` previews shares/slippage before placement. |
| Bet placement | `/api/bento-place-bet` submits the previewed position with idempotency. |
| Reconciliation | `/api/bento-portfolio` polls account details and positions after acceptance. |
| Growth loop | Profiles, leaderboard, match tickets, and onboarding make the market board feel social and repeatable. |

## Honest Scope Boundary

The app is wired for Bento testnet/backend integration. Real-money launch still depends on account funding, market eligibility, compliance/geofencing, and production API access.

## Production Flow

1. Open haramball.xyz.
2. Create or update a fan profile.
3. Confirm backend readiness is configured.
4. Browse public markets.
5. Connect an EVM wallet.
6. Select YES/NO.
7. Preview the stake.
8. Place the bet.
9. Inspect the ticket and portfolio reconciliation state.

## Required Environment Variables

```env
BENTO_URL=https://internal-server.bento.fun
BENTO_BUILDER_API_KEY=...
BUILDER_API_KEY=...
PARLAY_TOURNMENT_URL=https://bento-fun-tournaments-backend-3nku.onrender.com
```

`BENTO_BUILDER_API_KEY` is the official SDK env name. `BUILDER_API_KEY` is accepted as a hackathon-note alias. `PARLAY_TOURNMENT_URL` intentionally uses the spelling from the Bento hackathon repo.

## Submission Reference

- Repo: https://github.com/Bentodotfun/build-on-bento
- Required form: https://forms.gle/UiJB7fVNCpwvnVLa7

## Verification

Run:

```bash
npm.cmd test
npm.cmd run build
```
