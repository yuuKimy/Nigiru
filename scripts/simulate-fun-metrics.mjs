/**
 * ゲーム性検証用 — 難易度カーブ・テンポ上限の数値シミュレーション。
 * プレイ数値は GameScene / rules.ts と同期させる（検証時点の定数）。
 */

import {
  FIRST_RUSH_AT_MS,
  isRush,
  MAX_ON_BELT,
  RUSH_DURATION_MS,
  RUSH_EVERY_MS,
} from "../src/game/rules.ts";

const BASE_SUSHI_SPEED = 170;
const PLATE_WIDTH = 72;
const SHIP_COOLDOWN_MS = 160;
const ENTER_INTERVAL_START = 5000;
const ENTER_INTERVAL_MIN = 2400;
const RUSH_ENTER_INTERVAL = 1700;
const BASE_PATIENCE_MS = 14000;
const MIN_PATIENCE_MS = 7200;
const MAX_COMBO_MULTIPLIER = 5;
const SCREEN_WIDTH = 800;
const PLATE_START_X = 154;
const SEAT_X = [272, 424.67, 577.33, 730];

function enterInterval(elapsedMs) {
  if (isRush(elapsedMs)) return RUSH_ENTER_INTERVAL;
  const t = Math.min(1, elapsedMs / 90000);
  return ENTER_INTERVAL_START - (ENTER_INTERVAL_START - ENTER_INTERVAL_MIN) * t;
}

function patienceMs(combo, elapsedMs) {
  const comboCut = Math.min(combo, MAX_COMBO_MULTIPLIER) * 400;
  const rushCut = isRush(elapsedMs) ? 2800 : 0;
  return Math.max(MIN_PATIENCE_MS, BASE_PATIENCE_MS - comboCut - rushCut);
}

function beltCrossSeconds(seatIndex) {
  return (SEAT_X[seatIndex] - PLATE_START_X) / BASE_SUSHI_SPEED;
}

function beltDiscardSeconds() {
  return (SCREEN_WIDTH + PLATE_WIDTH - PLATE_START_X) / BASE_SUSHI_SPEED;
}

function fmtSec(ms) {
  return (ms / 1000).toFixed(1);
}

console.log("=== わさびパニック — ゲーム性メトリクス ===\n");

console.log("【T テンポ上限】");
console.log(`  出荷クールダウン: ${SHIP_COOLDOWN_MS}ms → 理論最大 ${(1000 / SHIP_COOLDOWN_MS).toFixed(2)} 皿/秒`);
console.log(`  レーン上限: ${MAX_ON_BELT} 皿`);
console.log(`  レーン通過（右端破棄まで）: ${beltDiscardSeconds().toFixed(2)} 秒`);
SEAT_X.forEach((x, i) => {
  console.log(`  席${i + 1}（x=${Math.round(x)}）到達: ${beltCrossSeconds(i).toFixed(2)} 秒`);
});
console.log(
  `  判定: クールダウン ${SHIP_COOLDOWN_MS}ms はレーン最短 ${(beltCrossSeconds(0) * 1000).toFixed(0)}ms より短い → 連打テンポは維持可能`,
);
console.log(
  `  8 皿詰まり: ${(8 * (PLATE_WIDTH / BASE_SUSHI_SPEED)).toFixed(1)} 秒分の物理列 → 上限到達時は出荷停止`,
);

console.log("\n【D 難易度カーブ — 入店間隔】");
for (const sec of [0, 15, 20, 30, 60, 90, 120, 180]) {
  const ms = sec * 1000;
  const rush = isRush(ms);
  console.log(
    `  ${String(sec).padStart(3)}s  ${rush ? "【繁忙】" : "      "} 入店 ${(enterInterval(ms) / 1000).toFixed(2)}s  我慢(コンボ0) ${(patienceMs(0, ms) / 1000).toFixed(1)}s`,
  );
}

console.log("\n【P パニック — 我慢時間（コンボ依存）】");
for (const combo of [0, 1, 3, 5]) {
  const normal = patienceMs(combo, 60000);
  const rush = patienceMs(combo, 20000);
  console.log(
    `  コンボ x${combo}: 通常 ${(normal / 1000).toFixed(1)}s / 繁忙 ${(rush / 1000).toFixed(1)}s`,
  );
}

console.log("\n【繁忙スケジュール】");
console.log(`  初回繁忙: ${fmtSec(FIRST_RUSH_AT_MS)}s  長さ ${fmtSec(RUSH_DURATION_MS)}s  周期 ${fmtSec(RUSH_EVERY_MS)}s`);
let rushCount = 0;
for (let t = 0; t <= 300000; t += 1000) {
  if (isRush(t) && !isRush(t - 1000)) {
    rushCount += 1;
    console.log(`  繁忙 #${rushCount}: ${fmtSec(t)}s 〜 ${fmtSec(t + RUSH_DURATION_MS)}s`);
  }
}

console.log("\n【満席到達の目安 — 入店のみ（退席なし・ランダム席）】");
{
  let elapsed = 0;
  let seated = 1;
  const cap = 4;
  while (seated < cap && elapsed < 120000) {
    const step = enterInterval(elapsed);
    elapsed += step;
    seated += 1;
  }
  console.log(`  1席開始 → 4席: 約 ${(elapsed / 1000).toFixed(0)} 秒（退席なしの理想最短）`);
}

console.log("\n【簡易プレイシミュレーション — 中程度スキル想定】");
console.log("  仮定: 2.5秒/客処理、正解率85%、満席維持、繁忙込み");

function simulateSkill(avgServeSec, accuracy, maxSec) {
  let elapsed = 0;
  let seated = 1;
  let score = 0;
  let combo = 0;
  let life = 3;
  let walkouts = 0;
  const customers = [{ patience: patienceMs(0, 0), max: patienceMs(0, 0) }];

  const enterAcc = { v: 0 };
  let nextEnter = enterInterval(0);

  while (elapsed < maxSec * 1000 && life > 0) {
    const dt = 100;
    elapsed += dt;

    for (const c of customers) {
      c.patience -= dt;
    }
    while (customers.some((c) => c.patience <= 0)) {
      const idx = customers.findIndex((c) => c.patience <= 0);
      if (idx < 0) break;
      customers.splice(idx, 1);
      seated -= 1;
      walkouts += 1;
      life -= 1;
      combo = 0;
      score = Math.max(0, score - 150);
    }

    enterAcc.v += dt;
    if (enterAcc.v >= nextEnter && seated < 4) {
      enterAcc.v = 0;
      seated += 1;
      const p = patienceMs(combo, elapsed);
      customers.push({ patience: p, max: p });
      nextEnter = enterInterval(elapsed);
    }

    if (customers.length > 0 && elapsed % (avgServeSec * 1000) < dt) {
      if (Math.random() < accuracy) {
        combo += 1;
        score += 100 * Math.min(combo, 5) + 25;
        customers.shift();
        seated -= 1;
      }
    }
  }

  return { elapsed, score, combo, life, walkouts, seated: customers.length };
}

for (const maxSec of [180, 300]) {
  const runs = [];
  for (let i = 0; i < 200; i++) {
    runs.push(simulateSkill(2.5, 0.85, maxSec));
  }
  const alive = runs.filter((r) => r.life > 0);
  const avgScore = runs.reduce((s, r) => s + r.score, 0) / runs.length;
  const avgWalk = runs.reduce((s, r) => s + r.walkouts, 0) / runs.length;
  const surv = alive.length / runs.length;
  console.log(
    `  ${maxSec}s: 生存率 ${(surv * 100).toFixed(0)}%  平均スコア ${avgScore.toFixed(0)}  平均退席 ${avgWalk.toFixed(1)}`,
  );
}
