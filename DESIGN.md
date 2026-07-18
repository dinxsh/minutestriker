# mineetes Design System

## Product Feel
mineetes is a mobile-first live football arcade. The first thing users should notice is the current minute prediction card, then the lock timer, then settlement/proof context.

## Visual Tokens
- Canvas: deep carbon `#121214`
- Panel: comic paper `#f8f4df`
- Ink/borders: near-black `#050507`
- YES: cyber neon pink `#ff2e93`
- NO: electric lime `#00ffa3`
- Live/state: halftone cyan `#00e5ff`
- Proof/warnings: arcade yellow `#ffe45f`
- Sweat state: orange `#ff8a2a`

## Component Rules
- Use 4px black borders and offset shadows for primary controls.
- Keep the prediction card dominant; setup controls must be compact.
- Buttons must be at least 44px tall on touch screens.
- YES and NO are the only large twin action buttons in the core loop.
- Proof receipts start summary-first; technical detail belongs in disclosure.
- Fixture names may be long, so selects and proof fields must truncate or wrap intentionally.

## Required States
- Loading fixtures: setup strip says "Loading matches" and disables fixture select.
- No fixtures: show a clear closed-market state until TxLINE returns a live fixture.
- TxLINE auth/feed error: show visible configuration or feed failure messages.
- Wallet unavailable: toast instructs user to install a Solana wallet.
- Wallet connected: label wallet as identity only unless a real vault is connected.
- Settlement pending: show locked state from 30s to 60s.
- Settlement complete: show result plus proof summary.

## Accessibility
- Interactive controls need visible focus states.
- Use semantic buttons/selects/details for keyboard support.
- Maintain 44px touch targets.
- State messages should use visible text, not color alone.
