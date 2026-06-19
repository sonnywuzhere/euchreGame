export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type Card = {
  suit: Suit;
  rank: Rank;
};

export type Player = {
  id: string;
  nickname: string;
  teamId: 0 | 1;
  position: 0 | 1 | 2 | 3;
};

export type RoomPlayer = Player & { connected: boolean };

export type RoomState = {
  roomCode: string;
  players: RoomPlayer[];
  gameStarted: boolean;
};

export type GamePhase =
  | 'waiting'
  | 'bidding_round1'
  | 'bidding_round2'
  | 'dealer_discard'
  | 'playing'
  | 'scoring'
  | 'game_over';

export type GameState = {
  roomCode: string;
  players: Player[];
  hands: Record<string, Card[]>;
  kitty: Card;
  trump: Suit | null;
  maker: string | null;
  goingAlone: boolean;
  alonePlayerId: string | null;
  currentTrick: TrickCard[];
  trickHistory: TrickResult[];
  scores: [number, number];
  roundTricks: [number, number];
  phase: GamePhase;
  dealerPosition: number;
  currentPlayerPosition: number;
  currentRoundBids?: BidAction[];
};

export type TrickCard = {
  playerId: string;
  card: Card;
};

export type TrickResult = {
  winnerId: string;
  winnerTeamId: 0 | 1;
  cards: TrickCard[];
};

export type BidAction =
  | { type: 'order_up'; playerId: string; goAlone: boolean }
  | { type: 'pass'; playerId: string }
  | { type: 'name_suit'; playerId: string; suit: Suit; goAlone: boolean };

export type BidSubmitPayload = {
  pass: boolean;
  suit?: Suit;
  alone?: boolean;
};

export type RoundResult = {
  makerTeam: 0 | 1;
  makerTeamTricks: number;
  defenderTeamTricks: number;
  pointsScored: number;
  scoringTeam: 0 | 1;
  wasEuchre: boolean;
  wentAlone: boolean;
  wonAllFive: boolean;
};

export type ServerToClientEvents = {
  'room:state': (state: RoomState) => void;
  'player:registered': (playerId: string) => void;
  'game:start': (state: GameState) => void;
  'game:state': (state: GameState) => void;
  'trick:complete': (result: { winner: string; trick: Card[] }) => void;
  'round:complete': (result: { scores: [number, number] }) => void;
  'game:over': (result: { winner: 0 | 1; scores: [number, number] }) => void;
  error: (msg: string) => void;
};

export type ClientToServerEvents = {
  'room:create': (payload: { nickname: string }) => void;
  'room:join': (payload: { nickname: string; roomCode: string }) => void;
  'bid:submit': (payload: BidSubmitPayload) => void;
  'dealer:discard': (payload: { card: Card }) => void;
  'card:play': (payload: { card: Card }) => void;
  'player:reconnect': (payload: { roomCode: string; playerId: string }) => void;
};
