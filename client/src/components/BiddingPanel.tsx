import { useState } from 'react';
import type { GameState, BidSubmitPayload, Suit } from '../../../shared/types';
import CardComponent from './Card';

interface BiddingPanelProps {
  gameState: GameState;
  playerId: string;
  onBid: (payload: BidSubmitPayload) => void;
}

const SUITS: { suit: Suit; symbol: string; label: string; red: boolean }[] = [
  { suit: 'spades',   symbol: '♠', label: 'Spades',   red: false },
  { suit: 'clubs',    symbol: '♣', label: 'Clubs',    red: false },
  { suit: 'hearts',   symbol: '♥', label: 'Hearts',   red: true  },
  { suit: 'diamonds', symbol: '♦', label: 'Diamonds', red: true  },
];

export default function BiddingPanel({ gameState, playerId, onBid }: BiddingPanelProps) {
  const [pending, setPending] = useState<Suit | 'order_up' | null>(null);
  const [goAlone, setGoAlone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const me = gameState.players.find((p) => p.id === playerId);
  const myPosition = me?.position ?? -1;
  const isMyTurn = gameState.currentPlayerPosition === myPosition;
  const isDealer = gameState.dealerPosition === myPosition;
  const isRound1 = gameState.phase === 'bidding_round1';
  const isRound2 = gameState.phase === 'bidding_round2';
  const turnedDownSuit = gameState.kitty.suit;

  if (!isRound1 && !isRound2) return null;

  // Not this player's turn: show a read-only status of who is bidding
  if (!isMyTurn) {
    const currentPlayer = gameState.players.find(
      (p) => p.position === gameState.currentPlayerPosition
    );
    return (
      <div className="bg-green-900/95 border border-white/20 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-3">
        {isRound1 && (
          <>
            <p className="text-white/60 text-xs uppercase tracking-wider">Turn-up card</p>
            <CardComponent card={gameState.kitty} />
          </>
        )}
        <p className="text-white/70 text-sm">
          {currentPlayer?.nickname ?? 'Someone'} is deciding…
        </p>
      </div>
    );
  }

  function submit(payload: BidSubmitPayload) {
    setSubmitted(true);
    onBid(payload);
  }

  function handleConfirm() {
    if (pending === 'order_up') {
      submit({ pass: false, alone: goAlone });
    } else if (pending) {
      submit({ pass: false, suit: pending, alone: goAlone });
    }
  }

  // Waiting for server response
  if (submitted) {
    return (
      <div className="bg-green-900/95 border border-white/20 rounded-2xl p-6 shadow-2xl flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-white/70 text-sm">Waiting…</span>
      </div>
    );
  }

  // Confirmation step: Go Alone toggle + Confirm
  if (pending !== null) {
    const label =
      pending === 'order_up'
        ? `Order up ${SUITS.find((s) => s.suit === turnedDownSuit)?.symbol ?? ''} ${turnedDownSuit}`
        : `Name ${SUITS.find((s) => s.suit === pending)?.label ?? pending}`;

    return (
      <div className="bg-green-900/95 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 min-w-48">
        <p className="text-white font-semibold text-base">{label}</p>

        <button
          onClick={() => setGoAlone((v) => !v)}
          className={[
            'w-full py-2 px-4 rounded-lg text-sm font-medium border transition-all',
            goAlone
              ? 'bg-yellow-400 border-yellow-300 text-yellow-900'
              : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/15',
          ].join(' ')}
        >
          {goAlone ? '⚡ Going alone' : 'Going alone? (tap to toggle)'}
        </button>

        <div className="flex gap-2 w-full">
          <button
            onClick={() => { setPending(null); setGoAlone(false); }}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 transition-all"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold bg-blue-600 border border-blue-500 text-white hover:bg-blue-500 transition-all"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  // Round 1: show kitty card + Order Up / Pass
  if (isRound1) {
    return (
      <div className="bg-green-900/95 border border-white/20 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-4">
        <p className="text-white/60 text-xs uppercase tracking-wider">Turn-up card</p>
        <CardComponent card={gameState.kitty} />
        <div className="flex gap-3">
          <button
            onClick={() => submit({ pass: true })}
            className="py-2 px-5 rounded-lg text-sm font-medium bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 transition-all"
          >
            Pass
          </button>
          <button
            onClick={() => setPending('order_up')}
            className="py-2 px-5 rounded-lg text-sm font-semibold bg-blue-600 border border-blue-500 text-white hover:bg-blue-500 transition-all"
          >
            Order Up
          </button>
        </div>
      </div>
    );
  }

  // Round 2: name a suit (cannot name turned-down suit; dealer cannot pass)
  return (
    <div className="bg-green-900/95 border border-white/20 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-4">
      <p className="text-white font-semibold text-sm">Name a suit</p>
      <div className="grid grid-cols-2 gap-2">
        {SUITS.map(({ suit, symbol, label, red }) => {
          const disabled = suit === turnedDownSuit;
          return (
            <button
              key={suit}
              disabled={disabled}
              onClick={() => setPending(suit)}
              className={[
                'w-24 py-3 rounded-xl text-lg font-bold border transition-all flex flex-col items-center gap-0.5',
                disabled
                  ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10 text-white/40'
                  : red
                    ? 'bg-white text-red-600 border-white/20 hover:bg-red-50 active:scale-95'
                    : 'bg-white text-slate-900 border-white/20 hover:bg-slate-50 active:scale-95',
              ].join(' ')}
            >
              <span>{symbol}</span>
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      {!isDealer && (
        <button
          onClick={() => submit({ pass: true })}
          className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 transition-all"
        >
          Pass
        </button>
      )}
      {isDealer && (
        <p className="text-white/40 text-xs">Dealer must name a suit</p>
      )}
    </div>
  );
}
