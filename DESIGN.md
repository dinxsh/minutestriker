# haramball.xyz Design System

## Product Feel

haramball.xyz is a World Cup market terminal. The first thing users should notice is the match market card, then the YES/NO ticket controls, then the leaderboard/profile layer.

## Visual Tokens

- Canvas: pitch green / deep stadium night
- Panel: matchday ticket paper `#fff8dc`
- Ink/borders: near-black `#050507`
- YES: tournament red
- NO: pitch green
- Live/state: scoreboard cyan
- Warnings: trophy yellow
- Pending/finality: matchday orange

## Component Rules

- Keep the market card dominant.
- Onboarding belongs in a modal for fresh users.
- Returning users manage profile, settings, and theme from the top-right profile icon.
- Buttons must be at least 44px tall on touch screens.
- YES and NO are the only large twin action buttons in the core loop.
- Always preview before placing a bet.
- Receipts start summary-first; market id, preview id, ticket id, and account detail belong in disclosure.
- Show the signing wallet and market account separately.

## Required States

- Loading markets: market card says "Loading World Cup markets..."
- No markets: show a closed match board state.
- Missing Builder key: readiness strip names the missing backend env.
- Fresh user: show the Join Matchday modal.
- Profile exists: show top-right avatar dropdown.
- Wallet unavailable: toast asks for an EVM wallet.
- Wallet connected: show signer address and market account when returned.
- Preview pending: disable repeat preview/place controls.
- Bet accepted: show pending finality and poll portfolio.

## Accessibility

- Interactive controls need visible focus states.
- Use semantic buttons/forms/details for keyboard support.
- Maintain 44px touch targets.
- State messages should use visible text, not color alone.
