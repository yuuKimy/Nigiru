import type { NetaKind, WasabiAmount } from "./orders";

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
/** 我慢ゲージの減速倍率が 1 から上限へ到達するまでの時間（入店間隔のランプと同じ 90 秒） */
export const PATIENCE_DRAIN_RAMP_MS = 90000;
/** 経過時間による我慢ゲージ減速の上限倍率（90 秒以降は最大 2.5 倍速で減る） */
export const PATIENCE_DRAIN_MAX = 2.5;
/** 繁忙開始ごとにランダム抽選する、減速への追加倍率の範囲 */
export const RUSH_PATIENCE_DRAIN_MIN = 1.2;
export const RUSH_PATIENCE_DRAIN_MAX = 1.5;

export function isRush(elapsedMs: number): boolean {
  if (elapsedMs < FIRST_RUSH_AT_MS) {
    return false;
  }
  const inCycle = (elapsedMs - FIRST_RUSH_AT_MS) % RUSH_EVERY_MS;
  return inCycle < RUSH_DURATION_MS;
}

/** 経過時間に応じて我慢ゲージの減り方を速くする（1 → PATIENCE_DRAIN_MAX）。繁忙中は rushPatienceBoost を乗算 */
export function patienceDrainMultiplier(elapsedMs: number, rushPatienceBoost = 1): number {
  const t = Math.min(1, Math.max(0, elapsedMs / PATIENCE_DRAIN_RAMP_MS));
  const base = 1 + (PATIENCE_DRAIN_MAX - 1) * t;
  if (isRush(elapsedMs)) {
    return base * rushPatienceBoost;
  }
  return base;
}

/** 繁忙開始時に抽選する追加減速倍率（1.2〜1.5） */
export function rollRushPatienceDrainBoost(random: () => number = Math.random): number {
  return RUSH_PATIENCE_DRAIN_MIN + random() * (RUSH_PATIENCE_DRAIN_MAX - RUSH_PATIENCE_DRAIN_MIN);
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
  neta: NetaKind | null;
  wasabi: WasabiAmount | null;
};

export function resolvePlateAtSeats(
  plateX: number,
  plateNeta: NetaKind,
  plateWasabi: WasabiAmount,
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
    const neta = seats[s].neta;
    const wasabi = seats[s].wasabi;
    const take = neta !== null && wasabi !== null && neta === plateNeta && wasabi === plateWasabi;
    return { seatIndex: s, take };
  }
  return null;
}

export function shouldDiscardPlate(plateX: number, rightEdge: number): boolean {
  return plateX > rightEdge;
}

export function canShip(isGameOver: boolean, shipCoolMs: number, plateCount: number): boolean {
  return !isGameOver && shipCoolMs <= 0 && plateCount < MAX_ON_BELT;
}
