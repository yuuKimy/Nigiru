import { describe, expect, it } from "vitest";
import {
  FIRST_RUSH_AT_MS,
  MAX_ON_BELT,
  RUSH_DURATION_MS,
  RUSH_EVERY_MS,
  applyWalkout,
  canShip,
  isRush,
  patienceDrainMultiplier,
  resolvePlateAtSeats,
  rollRushPatienceDrainBoost,
  scoreForOk,
  shouldDiscardPlate,
} from "./rules";

describe("scoreForOk", () => {
  it("adds 100 times combo and an early bonus from remaining patience", () => {
    expect(scoreForOk(1, 1)).toBe(150);
    expect(scoreForOk(1, 0.5)).toBe(125);
    expect(scoreForOk(1, 0)).toBe(100);
  });

  it("caps the combo multiplier at 5", () => {
    expect(scoreForOk(5, 0)).toBe(500);
    expect(scoreForOk(6, 0)).toBe(500);
  });
});

describe("applyWalkout", () => {
  it("subtracts 150, resets combo, and loses a life", () => {
    expect(applyWalkout(200, 3)).toEqual({ score: 50, combo: 0, life: 2 });
  });

  it("does not let score go below 0", () => {
    expect(applyWalkout(100, 1)).toEqual({ score: 0, combo: 0, life: 0 });
  });
});

describe("isRush", () => {
  it("starts after 20 seconds and lasts 12 seconds of each 32-second cycle", () => {
    expect(isRush(FIRST_RUSH_AT_MS - 1)).toBe(false);
    expect(isRush(FIRST_RUSH_AT_MS)).toBe(true);
    expect(isRush(FIRST_RUSH_AT_MS + RUSH_DURATION_MS - 1)).toBe(true);
    expect(isRush(FIRST_RUSH_AT_MS + RUSH_DURATION_MS)).toBe(false);
    expect(isRush(FIRST_RUSH_AT_MS + RUSH_EVERY_MS)).toBe(true);
  });
});

describe("patienceDrainMultiplier", () => {
  it("starts at 1 and ramps to PATIENCE_DRAIN_MAX over 90 seconds", () => {
    expect(patienceDrainMultiplier(0)).toBe(1);
    expect(patienceDrainMultiplier(45000)).toBeCloseTo(1.75);
    expect(patienceDrainMultiplier(90000)).toBe(2.5);
    expect(patienceDrainMultiplier(180000)).toBe(2.5);
  });

  it("multiplies by rush boost only during rush, then returns to base", () => {
    const atRush = FIRST_RUSH_AT_MS + 1000;
    const baseAtRush = 1 + (2.5 - 1) * (atRush / 90000);
    expect(patienceDrainMultiplier(atRush, 1.4)).toBeCloseTo(baseAtRush * 1.4);
    expect(patienceDrainMultiplier(FIRST_RUSH_AT_MS + RUSH_DURATION_MS, 1.4)).toBe(
      patienceDrainMultiplier(FIRST_RUSH_AT_MS + RUSH_DURATION_MS),
    );
  });
});

describe("rollRushPatienceDrainBoost", () => {
  it("returns a value in 1.2..1.5", () => {
    expect(rollRushPatienceDrainBoost(() => 0)).toBeCloseTo(1.2);
    expect(rollRushPatienceDrainBoost(() => 1)).toBeCloseTo(1.5);
    expect(rollRushPatienceDrainBoost(() => 0.5)).toBeCloseTo(1.35);
  });
});

describe("resolvePlateAtSeats", () => {
  const seats = [
    { x: 100, neta: "maguro" as const, wasabi: "none" as const },
    { x: 300, neta: "maguro" as const, wasabi: "normal" as const },
    { x: 500, neta: "maguro" as const, wasabi: "none" as const },
  ];

  it("takes at the first matching seat in range", () => {
    expect(resolvePlateAtSeats(100, "maguro", "none", seats, [false, false, false])).toEqual({
      seatIndex: 0,
      take: true,
    });
  });

  it("passes a mismatch and leaves later matching seats for later", () => {
    expect(resolvePlateAtSeats(100, "maguro", "normal", seats, [false, false, false])).toEqual({
      seatIndex: 0,
      take: false,
    });
    expect(resolvePlateAtSeats(300, "maguro", "normal", seats, [true, false, false])).toEqual({
      seatIndex: 1,
      take: true,
    });
  });

  it("lets the leftmost matching seat take when two seats want the same order", () => {
    expect(resolvePlateAtSeats(500, "maguro", "none", seats, [true, true, false])).toEqual({
      seatIndex: 2,
      take: true,
    });
  });

  it("passes when neta mismatches even if wasabi matches", () => {
    expect(
      resolvePlateAtSeats(100, "tamago", "none", seats, [false, false, false]),
    ).toEqual({ seatIndex: 0, take: false });
  });

  it("takes tamago when seat wants tamago", () => {
    const tamagoSeat = [{ x: 100, neta: "tamago" as const, wasabi: "none" as const }];
    expect(resolvePlateAtSeats(100, "tamago", "none", tamagoSeat, [false])).toEqual({
      seatIndex: 0,
      take: true,
    });
  });

  it("does not take from an empty seat", () => {
    expect(
      resolvePlateAtSeats(100, "maguro", "none", [{ x: 100, neta: null, wasabi: null }], [false]),
    ).toEqual({ seatIndex: 0, take: false });
  });

  it("returns null when no seat is in range", () => {
    expect(resolvePlateAtSeats(200, "maguro", "none", seats, [false, false, false])).toBeNull();
  });
});

describe("shouldDiscardPlate", () => {
  it("discards past the right edge without scoring", () => {
    expect(shouldDiscardPlate(800, 800)).toBe(false);
    expect(shouldDiscardPlate(801, 800)).toBe(true);
  });
});

describe("canShip", () => {
  it("blocks shipping after game over, during cooldown, or at the belt cap", () => {
    expect(canShip(false, 0, 0)).toBe(true);
    expect(canShip(true, 0, 0)).toBe(false);
    expect(canShip(false, 1, 0)).toBe(false);
    expect(canShip(false, 0, MAX_ON_BELT)).toBe(false);
    expect(canShip(false, 0, MAX_ON_BELT - 1)).toBe(true);
  });
});
