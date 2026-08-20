import type { WasabiAmount } from "./orders";

export const TAKE_HALF = 44;
export const SEAT_COUNT = 4;
export const INITIAL_LIFE = 3;
export const SCORE_PER_OK = 100;
export const EARLY_BONUS_MAX = 50;
export const WALKOUT_PENALTY = 150;
export const MAX_COMBO_MULTIPLIER = 5;
export const RUSH_DURATION_MS = 12000;
export const FIRST_RUSH_AT_MS = 20000;
export const RUSH_EVERY_MS = 32000;
export const MAX_ON_BELT = 8;

export function isRush(elapsedMs: number): boolean {
  if (elapsedMs < FIRST_RUSH_AT_MS) {
    return false;
  }
  const inCycle = (elapsedMs - FIRST_RUSH_AT_MS) % RUSH_EVERY_MS;
  return inCycle < RUSH_DURATION_MS;
}

export function scoreForOk(comboAfterHit: number, remain: number): number {
  const clamped = Math.min(Math.max(remain, 0), 1);
  const bonus = Math.round(EARLY_BONUS_MAX * clamped);
  const multiplier = Math.min(comboAfterHit, MAX_COMBO_MULTIPLIER);
  return SCORE_PER_OK * multiplier + bonus;
}

export function applyWalkout(
  score: number,
  life: number,
): { score: number; combo: number; life: number } {
  return {
    score: Math.max(0, score - WALKOUT_PENALTY),
    combo: 0,
    life: life - 1,
  };
}

export type SeatOrder = {
  x: number;
  amount: WasabiAmount | null;
};

export function resolvePlateAtSeats(
  plateX: number,
  plateAmount: WasabiAmount,
  seats: SeatOrder[],
  passed: boolean[],
  takeHalf = TAKE_HALF,
): { seatIndex: number; take: boolean } | null {
  for (let s = 0; s < seats.length; s++) {
    if (passed[s]) {
      continue;
    }
    if (Math.abs(plateX - seats[s].x) > takeHalf) {
      continue;
    }
    const amount = seats[s].amount;
    return { seatIndex: s, take: amount !== null && amount === plateAmount };
  }
  return null;
}

export function shouldDiscardPlate(plateX: number, rightEdge: number): boolean {
  return plateX > rightEdge;
}

export function canShip(isGameOver: boolean, shipCoolMs: number, plateCount: number): boolean {
  return !isGameOver && shipCoolMs <= 0 && plateCount < MAX_ON_BELT;
}
