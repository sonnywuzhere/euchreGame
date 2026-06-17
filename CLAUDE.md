# Euchre Online — Claude Code Reference

## Project Overview
A multiplayer online Euchre card game. 4 human players, 2 teams, private rooms
with invite codes. Built with React + TypeScript (frontend), Node.js + Socket.io
(backend), Redis (game state).

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + TypeScript + Express |
| Real-time | Socket.io |
| State/Sessions | Redis (ioredis) |
| Hosting | Railway |

## Architecture Rules
- All game logic lives in /server/src/game/ as pure functions — no socket or
  HTTP code in game logic files
- Game state is always validated and mutated server-side only
- Clients receive state updates via socket events — they never hold authoritative state
- Shared TypeScript types live in /shared/types.ts — import from there on both
  client and server, never duplicate type definitions

## Critical Game Rules (Do Not Get These Wrong)
- **Left bower**: The Jack of the same COLOR as trump is the second-highest
  trump card, outranking all non-bower trumps. E.g. if hearts is trump,
  Jack of diamonds is the left bower and counts as a heart for following suit.
- **Right bower**: Jack of trump suit — highest card in the game.
- **Stick the dealer**: In bidding round 2, the dealer CANNOT pass. They must
  name a suit (any suit except the one turned down in round 1).
- **Follow suit**: A player must follow the led suit if able. Trump suit includes
  both bowers — a player holding the left bower must treat it as trump.
- **Going alone**: The maker's partner discards their hand and sits out all tricks.

## Scoring
| Outcome | Points |
|---|---|
| Makers win 3 or 4 tricks | 1 pt to makers |
| Euchre (makers win < 3 tricks) | 2 pts to opponents |
| Going alone, win 3-4 tricks | 1 pt to maker's team |
| Going alone, win all 5 tricks | 4 pts to maker's team |
| Game ends at | 10 points |

## Socket Event Reference
| Event | Direction | Payload |
|---|---|---|
| room:create | C → S | { nickname } |
| room:join | C → S | { nickname, roomCode } |
| room:state | S → C | RoomState |
| game:start | S → C | GameState |
| game:state | S → C | GameState |
| bid:submit | C → S | { pass, suit?, alone? } |
| card:play | C → S | { card: Card } |
| trick:complete | S → C | { winner: string, trick: Card[] } |
| round:complete | S → C | { scores: [number, number] } |
| game:over | S → C | { winner: 0 | 1, scores: [number, number] } |
| player:reconnect | C → S | { roomCode, playerId } |

## File Structure
```
euchre-online/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── game/
│   │   │   ├── deck.ts
│   │   │   ├── bidding.ts
│   │   │   ├── tricks.ts
│   │   │   └── scoring.ts
│   │   ├── rooms/
│   │   │   └── roomManager.ts
│   │   ├── socket/
│   │   │   └── handlers.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   └── types.ts
├── CLAUDE.md
├── package.json
└── README.md
```

## Build Status
```
[x] Session 1 — Game engine (deck, bidding, tricks, scoring) + shared types + full scaffold
[x] Session 2 — Room manager + Socket.io handlers
[x] Session 3 — React frontend lobby (routing, hooks, Home + Room pages)
[~] Session 4 — Game table UI (bidding UI, card play, trick display) — 4a done (layout + cards)
[ ] Session 5 — Polish, error handling, Railway deploy
```

**Current session:** Session 4b ready to start (bidding UI)
**Last updated:** June 2026

### Session Notes

```
Session 4a — June 2026
Built: Card.tsx, Hand.tsx, TrickArea.tsx, Scoreboard.tsx, Game.tsx (page); wired into App.tsx.
Card: face-up (rank + suit symbol, red/black) + face-down (emerald back), highlighted (yellow glow),
  disabled (greyed), hover lift on clickable cards.
Hand: gap-2 for ≤5 cards, -24px overlap + z-index for >5 cards; only validPlays are highlighted + clickable.
TrickArea: bottom=me, left=left-opp, top=partner, right=right-opp; empty dashed slot until card played;
  sitting-out state for going-alone partner; trickWinner overlay (2-second timeout set in Game.tsx).
Scoreboard: team score pips (10 pip row), round tricks, trump suit symbol with red/black colour,
  maker nickname + "Going alone!" badge, my team highlighted.
Game page: Scoreboard top, partner top, left/right opponents beside TrickArea, my Hand bottom;
  yellow ring on active player's area; loading spinner + player:reconnect on null gameState;
  card:play emitted on click when isMyTurn; validPlays = all hand cards on my turn (server enforces rules).
Decisions: validPlays simplified to full hand on my turn — server rejects illegal plays; left bower
  follow-suit enforcement left to server. GamePlaceholder removed from App.tsx.
Known issues: None (tsc --noEmit + vite build both clean, 78 modules).
Next session: Session 4b — bidding UI (round 1 order-up / pass, round 2 name-suit / stick-dealer).

Session 3 — June 2026
Built: useSocket.ts (singleton Socket.io client), useGameState.ts (room:state / game:state listeners,
  playerId persisted in sessionStorage), Home.tsx (create/join with error handling), Room.tsx
  (4-slot team display, copy invite button, auto-navigate to /game/:code on game:start),
  App.tsx (BrowserRouter with /, /room/:code, /game/:code routes), Game placeholder page.
Packages added: react-router-dom (client)
Decisions: socket.once for navigation after room:create/join to avoid stale listeners;
  playerId matched from room:state by socket.id so it survives reconnect via sessionStorage.
Known issues: preview_start blocked by system permissions in this environment; verified via
  tsc --noEmit (0 errors) + vite build (clean 73-module bundle).
Next session: Game table — bidding UI, hand display, card play, trick area.
```
