import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import type { GameSceneData, PlayerRole } from "./SelectScene";

/** 中央判定ゾーンの幅（px）。以降のフェーズでもこの値を判定に使う。 */
const ZONE_WIDTH = 120;
const CONVEYOR_HEIGHT = 100;
const CONVEYOR_Y = 300;

/** お皿を含む見た目の幅（スポーン／画面外判定用） */
const PLATE_WIDTH = 72;
const PLATE_HEIGHT = 52;

/** プレイ感チューニング（フェーズ5） */
const BASE_SUSHI_SPEED = 160; // px/秒（開始時。ゾーン内の反応時間は約1秒）
const SPAWN_INTERVAL_MS = 1450;
const WASABI_RATE = 0.5;
const TRAP_RATE = 0.12; // 空のトラップ皿の出現率
const INITIAL_LIFE = 3;
const SCORE_PER_TAKE = 100;
const MAX_COMBO_MULTIPLIER = 5;

/** スコア達成ごとの加速（徐々に判断を速く求める） */
const SPEED_SCORE_STEP = 300; // この点数ごとに1段階加速
const SPEED_INCREMENT = 28; // 1段階あたりの加速量（px/秒）
const MAX_SUSHI_SPEED = 280; // 上限（クリア不能を防ぐ）

type SushiType = "noWasabi" | "withWasabi" | "trap";
type TargetType = "noWasabi" | "withWasabi";

type Sushi = {
  type: SushiType;
  resolved: boolean;
  container: Phaser.GameObjects.Container;
};

const ROLE_TARGET: Record<PlayerRole, TargetType> = {
  child: "noWasabi",
  adult: "withWasabi",
};

const ROLE_LABEL: Record<PlayerRole, string> = {
  child: "子供（わさび抜き）",
  adult: "大人（わさびあり）",
};

export class GameScene extends Phaser.Scene {
  private sushis: Sushi[] = [];
  private zoneLeft = 0;
  private zoneRight = 0;
  private role: PlayerRole = "child";
  private targetType: TargetType = "noWasabi";
  private score = 0;
  private life = INITIAL_LIFE;
  private combo = 0;
  private isGameOver = false;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private spawnEvent?: Phaser.Time.TimerEvent;
  private hudText!: Phaser.GameObjects.Text;

  constructor() {
    super("Game");
  }

  init(data: GameSceneData): void {
    this.role = data.role ?? "child";
    this.targetType = ROLE_TARGET[this.role];
    this.score = 0;
    this.life = INITIAL_LIFE;
    this.combo = 0;
    this.isGameOver = false;
    this.sushis = [];
  }

  create(): void {
    const { width, height } = this.scale;
    this.zoneLeft = (width - ZONE_WIDTH) / 2;
    this.zoneRight = this.zoneLeft + ZONE_WIDTH;

    this.drawBackground(width, height);
    this.drawConveyor(width);
    this.drawJudgmentZone(this.zoneLeft, this.zoneRight);
    this.drawGuide();
    this.hudText = this.add
      .text(width / 2, 68, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#efebe9",
      })
      .setOrigin(0.5);
    this.drawTitle();
    this.refreshHud();

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.spawnSushi();
    this.spawnEvent = this.time.addEvent({
      delay: SPAWN_INTERVAL_MS,
      callback: this.spawnSushi,
      callbackScope: this,
      loop: true,
    });
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    const dx = (this.getSushiSpeed() * delta) / 1000;
    const rightEdge = this.scale.width + PLATE_WIDTH;

    for (let i = this.sushis.length - 1; i >= 0; i--) {
      const sushi = this.sushis[i];
      if (sushi.resolved) {
        continue;
      }

      sushi.container.x += dx;

      if (sushi.container.x > rightEdge) {
        const missedOwn = sushi.type === this.targetType;
        this.destroySushi(i);
        if (missedOwn) {
          this.resetCombo();
          SoundFx.miss();
          this.loseLife();
          this.showFeedback(rightEdge - PLATE_WIDTH, CONVEYOR_Y, false, "見逃し!");
        }
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryTake();
    }
  }

  private tryTake(): void {
    const index = this.findSushiInZoneIndex();
    if (index === null) {
      return;
    }

    const sushi = this.sushis[index];
    const x = sushi.container.x;
    const y = sushi.container.y;
    const isTrap = sushi.type === "trap";
    const correct = sushi.type === this.targetType;

    sushi.resolved = true;
    this.destroySushi(index);

    if (correct) {
      this.combo += 1;
      const multiplier = Math.min(this.combo, MAX_COMBO_MULTIPLIER);
      SoundFx.ok(this.combo);
      this.addScore(SCORE_PER_TAKE * multiplier);
      const comboLabel = this.combo >= 2 ? `OK! x${multiplier}` : "OK!";
      this.showFeedback(x, y, true, comboLabel);
      return;
    }

    this.resetCombo();
    if (isTrap) {
      SoundFx.trap();
    } else {
      SoundFx.miss();
    }
    this.loseLife();
    this.showFeedback(x, y, false, isTrap ? "トラップ!" : "ミス!");
  }

  private resetCombo(): void {
    if (this.combo === 0) {
      return;
    }
    this.combo = 0;
    this.refreshHud();
  }

  private getSushiSpeed(): number {
    const steps = Math.floor(this.score / SPEED_SCORE_STEP);
    return Math.min(MAX_SUSHI_SPEED, BASE_SUSHI_SPEED + steps * SPEED_INCREMENT);
  }

  private addScore(amount: number): void {
    const previousSpeed = this.getSushiSpeed();
    this.score += amount;
    this.refreshHud();

    const nextSpeed = this.getSushiSpeed();
    if (nextSpeed > previousSpeed) {
      SoundFx.speedUp();
      this.showSpeedUpFeedback();
    }
  }

  private showSpeedUpFeedback(): void {
    const { width } = this.scale;
    const label = this.add
      .text(width / 2, 110, "スピードアップ!", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#ffe082",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: label,
      y: 80,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private loseLife(): void {
    if (this.isGameOver) {
      return;
    }

    this.life -= 1;
    this.refreshHud();

    if (this.life <= 0) {
      this.life = 0;
      this.refreshHud();
      this.enterGameOver();
    }
  }

  private enterGameOver(): void {
    this.isGameOver = true;
    this.spawnEvent?.remove(false);
    SoundFx.gameOver();

    for (const sushi of this.sushis) {
      sushi.resolved = true;
      sushi.container.destroy();
    }
    this.sushis = [];

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);

    this.add
      .text(width / 2, height / 2 - 40, "GAME OVER", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "48px",
        color: "#ffcdd2",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, `SCORE: ${this.score}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(width / 2, height / 2 + 70, "[ リトライ ]", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#ffe082",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retry.on("pointerover", () => retry.setColor("#fff8e1"));
    retry.on("pointerout", () => retry.setColor("#ffe082"));
    retry.on("pointerdown", () => this.scene.start("Select"));
  }

  /** 判定ゾーン内の未解決寿司のうち、最も左にあるもののインデックス。 */
  private findSushiInZoneIndex(): number | null {
    let bestIndex: number | null = null;
    let bestX = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.sushis.length; i++) {
      const sushi = this.sushis[i];
      if (sushi.resolved) {
        continue;
      }

      const x = sushi.container.x;
      if (x >= this.zoneLeft && x <= this.zoneRight && x < bestX) {
        bestX = x;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  private showFeedback(x: number, y: number, correct: boolean, message: string): void {
    const label = this.add
      .text(x, y - 40, message, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: correct ? "#c8e6c9" : "#ffcdd2",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: label,
      y: y - 70,
      alpha: 0,
      duration: 450,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private spawnSushi(): void {
    if (this.isGameOver) {
      return;
    }

    let type: SushiType;
    if (Math.random() < TRAP_RATE) {
      type = "trap";
    } else {
      type = Math.random() < WASABI_RATE ? "withWasabi" : "noWasabi";
    }

    const container = this.createSushiVisual(type);
    container.setPosition(-PLATE_WIDTH, CONVEYOR_Y);

    this.sushis.push({
      type,
      resolved: false,
      container,
    });
  }

  private createSushiVisual(type: SushiType): Phaser.GameObjects.Container {
    const g = this.add.graphics();

    // 皿の影
    g.fillStyle(0x3e2723, 0.28);
    g.fillEllipse(2, PLATE_HEIGHT / 2 - 4, PLATE_WIDTH - 4, 14);

    if (type === "trap") {
      // トラップ：空皿（少しくすんだ縁で「おかしい」と気づける）
      g.fillStyle(0xc5cdd3, 1);
      g.fillEllipse(0, 6, PLATE_WIDTH, PLATE_HEIGHT);
      g.lineStyle(3, 0x78909c, 1);
      g.strokeEllipse(0, 6, PLATE_WIDTH, PLATE_HEIGHT);
      g.lineStyle(2, 0xeceff1, 0.7);
      g.strokeEllipse(0, 5, PLATE_WIDTH - 10, PLATE_HEIGHT - 12);
      g.fillStyle(0xb0bec5, 0.7);
      g.fillEllipse(0, 7, PLATE_WIDTH - 22, PLATE_HEIGHT - 24);
      // 空っぽの印
      g.lineStyle(2, 0x90a4ae, 0.9);
      g.strokeCircle(0, 4, 10);
      g.lineBetween(-6, -2, 6, 10);
      return this.add.container(0, 0, [g]);
    }

    g.fillStyle(0xd8e0e6, 1);
    g.fillEllipse(0, 6, PLATE_WIDTH, PLATE_HEIGHT);

    g.lineStyle(3, 0x90a4ae, 1);
    g.strokeEllipse(0, 6, PLATE_WIDTH, PLATE_HEIGHT);

    g.lineStyle(2, 0xf5fafc, 0.85);
    g.strokeEllipse(0, 5, PLATE_WIDTH - 10, PLATE_HEIGHT - 12);

    g.fillStyle(0xcfd8dc, 0.55);
    g.fillEllipse(0, 7, PLATE_WIDTH - 22, PLATE_HEIGHT - 24);

    g.fillStyle(0xf7f2e8, 1);
    g.fillRoundedRect(-16, -2, 32, 20, 6);
    g.fillStyle(0xe5dccf, 1);
    g.fillRoundedRect(-16, 10, 32, 8, { tl: 0, tr: 0, bl: 6, br: 6 });

    const netaX = -24;
    const netaY = -14;
    const netaW = 48;
    const netaH = 16;
    g.fillStyle(0xb71c1c, 1);
    g.fillRoundedRect(netaX, netaY + 2, netaW, netaH, 5);
    g.fillStyle(0xd32f2f, 1);
    g.fillRoundedRect(netaX, netaY, netaW, netaH - 2, 5);

    g.lineStyle(2.5, 0xffffff, 0.55);
    g.beginPath();
    g.moveTo(netaX + 8, netaY + 5);
    g.lineTo(netaX + netaW - 14, netaY + 4);
    g.strokePath();
    g.lineStyle(1.5, 0xffcdd2, 0.7);
    g.beginPath();
    g.moveTo(netaX + 10, netaY + 9);
    g.lineTo(netaX + netaW - 12, netaY + 8);
    g.strokePath();

    if (type === "withWasabi") {
      g.lineStyle(2, 0x8bc34a, 1);
      g.strokeRoundedRect(-26, -16, 52, 36, 7);

      g.fillStyle(0x558b2f, 1);
      g.fillTriangle(-10, netaY + 4, 10, netaY + 4, 0, netaY - 12);
      g.fillStyle(0x9ccc65, 1);
      g.fillTriangle(-7, netaY + 2, 7, netaY + 2, 0, netaY - 9);
      g.fillStyle(0xc5e1a5, 1);
      g.fillTriangle(-3, netaY, 3, netaY, 0, netaY - 6);
    }

    return this.add.container(0, 0, [g]);
  }

  private destroySushi(index: number): void {
    const sushi = this.sushis[index];
    sushi.container.destroy();
    this.sushis.splice(index, 1);
  }

  private refreshHud(): void {
    const comboText = this.combo > 0 ? `COMBO: x${Math.min(this.combo, MAX_COMBO_MULTIPLIER)}` : "COMBO: -";
    this.hudText.setText(
      `SCORE: ${this.score}    LIFE: ${this.life}    ${comboText}    属性: ${ROLE_LABEL[this.role]}`,
    );
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();

    g.fillStyle(0x6b4226, 1);
    g.fillRect(0, 0, width, height);

    const plankColors = [0x5c3a1e, 0x7a4f2e, 0x654321, 0x8b5a2b];
    const plankHeight = 40;
    for (let y = 0, i = 0; y < height; y += plankHeight, i++) {
      g.fillStyle(plankColors[i % plankColors.length], 0.55);
      g.fillRect(0, y, width, plankHeight - 2);
      g.lineStyle(1, 0x3e2723, 0.35);
      g.lineBetween(0, y + plankHeight - 2, width, y + plankHeight - 2);
    }
  }

  private drawConveyor(width: number): void {
    const g = this.add.graphics();
    const top = CONVEYOR_Y - CONVEYOR_HEIGHT / 2;

    g.fillStyle(0xc4a574, 1);
    g.fillRect(0, top, width, CONVEYOR_HEIGHT);

    g.lineStyle(3, 0x8d6e4c, 1);
    g.strokeRect(0, top, width, CONVEYOR_HEIGHT);

    g.lineStyle(1, 0xa08060, 0.6);
    for (let x = 20; x < width; x += 40) {
      g.lineBetween(x, top + 8, x - 12, top + CONVEYOR_HEIGHT - 8);
    }
  }

  private drawJudgmentZone(zoneLeft: number, zoneRight: number): void {
    const g = this.add.graphics();
    const top = CONVEYOR_Y - CONVEYOR_HEIGHT / 2 - 12;
    const h = CONVEYOR_HEIGHT + 24;

    g.fillStyle(0xffe082, 0.28);
    g.fillRect(zoneLeft, top, ZONE_WIDTH, h);

    g.lineStyle(2, 0xffc107, 0.9);
    g.strokeRect(zoneLeft, top, ZONE_WIDTH, h);

    this.add
      .text((zoneLeft + zoneRight) / 2, top - 18, "判定ゾーン", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#ffe082",
      })
      .setOrigin(0.5);
  }

  private drawGuide(): void {
    const targetLabel = this.role === "child" ? "わさび抜き" : "わさびあり";
    this.add
      .text(
        this.scale.width / 2,
        CONVEYOR_Y - CONVEYOR_HEIGHT / 2 - 56,
        `スペースで ${targetLabel} を取る（空皿はスルー）`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "16px",
          color: "#f5e6d3",
        },
      )
      .setOrigin(0.5);
  }

  private drawTitle(): void {
    this.add
      .text(this.scale.width / 2, 36, "わさびパニック", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);
  }
}
