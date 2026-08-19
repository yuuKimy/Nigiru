import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import { FONT } from "../theme";
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
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private lifeIcons: Phaser.GameObjects.Image[] = [];

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
    this.drawHud();
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
        fontFamily: FONT,
        fontSize: "26px",
        color: "#c62828",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const spark = this.add.image(width / 2 + 110, 110, "star").setDisplaySize(28, 28);
    this.tweens.add({
      targets: spark,
      y: 80,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => spark.destroy(),
    });

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
    this.add.rectangle(width / 2, height / 2, width, height, 0x3e2723, 0.55);

    this.add.image(width / 2, height / 2 - 8, "plate-red").setDisplaySize(360, 360);

    this.add
      .text(width / 2, height / 2 - 48, "おしまい", {
        fontFamily: FONT,
        fontSize: "42px",
        color: "#fff8e1",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 4, `SCORE  ${this.score}`, {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#ffe082",
      })
      .setOrigin(0.5);

    const retry = this.add.container(width / 2, height / 2 + 96);
    const makisu = this.add.image(0, 0, "makisu").setDisplaySize(210, 136);
    const retryHit = this.add
      .rectangle(0, 0, 210, 136, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const retryLabel = this.add
      .text(0, 4, "もういちど", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    retry.add([makisu, retryHit, retryLabel]);

    retryHit.on("pointerover", () => retry.setScale(1.06));
    retryHit.on("pointerout", () => retry.setScale(1));
    retryHit.on("pointerdown", () => this.scene.start("Select"));
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
    const fx = this.add
      .image(x, y - 52, correct ? "star" : "steam")
      .setDisplaySize(correct ? 28 : 32, correct ? 28 : 36);

    const label = this.add
      .text(x, y - 40, message, {
        fontFamily: FONT,
        fontSize: "22px",
        color: correct ? "#2e7d32" : "#c62828",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [label, fx],
      y: "-=30",
      alpha: 0,
      duration: 450,
      ease: "Cubic.easeOut",
      onComplete: () => {
        label.destroy();
        fx.destroy();
      },
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
    const plateKey = type === "trap" ? "plate-octagon" : "plate-empty";
    const plate = this.add.image(0, 8, plateKey).setDisplaySize(PLATE_WIDTH + 4, PLATE_HEIGHT + 6);

    if (type === "trap") {
      plate.setTint(0xcfd8dc);
      plate.setDisplaySize(PLATE_WIDTH + 8, PLATE_HEIGHT + 8);
      return this.add.container(0, 0, [plate]);
    }

    const sushiKey = type === "withWasabi" ? "maguro" : "sake";
    const sushi = this.add.image(0, -8, sushiKey).setDisplaySize(58, 46);
    const parts: Phaser.GameObjects.GameObject[] = [plate, sushi];

    if (type === "withWasabi") {
      parts.push(this.add.image(10, -22, "wasabi").setDisplaySize(22, 24));
    }

    return this.add.container(0, 0, parts);
  }

  private destroySushi(index: number): void {
    const sushi = this.sushis[index];
    sushi.container.destroy();
    this.sushis.splice(index, 1);
  }

  private refreshHud(): void {
    this.scoreText.setText(`${this.score}`);
    const multiplier = Math.min(this.combo, MAX_COMBO_MULTIPLIER);
    if (this.combo > 0) {
      this.comboText.setText(`x${multiplier}`);
      this.comboText.setAlpha(1);
    } else {
      this.comboText.setText("x1");
      this.comboText.setAlpha(0.35);
    }

    for (let i = 0; i < this.lifeIcons.length; i++) {
      const filled = i < this.life;
      this.lifeIcons[i].setTexture(filled ? "wasabi" : "wasabi-empty");
      this.lifeIcons[i].setAlpha(filled ? 1 : 0.7);
    }
  }

  private drawHud(): void {
    const { width } = this.scale;

    this.add.image(width / 2, 38, "title-plaque").setDisplaySize(280, 58);
    this.add
      .text(width / 2, 36, "わさびパニック", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add.image(86, 86, "plate-red").setDisplaySize(118, 118);
    this.add
      .text(86, 68, "SCORE", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);
    this.scoreText = this.add
      .text(86, 92, "0", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#fff8e1",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add.image(178, 92, "soy").setDisplaySize(28, 36);
    this.comboText = this.add
      .text(204, 92, "x1", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    this.lifeIcons = [];
    for (let i = 0; i < INITIAL_LIFE; i++) {
      const icon = this.add
        .image(width - 36 - (INITIAL_LIFE - 1 - i) * 44, 78, "wasabi")
        .setDisplaySize(38, 42);
      this.lifeIcons.push(icon);
    }

    const roleKey = this.role === "child" ? "tamago" : "maguro";
    this.add.image(width - 54, 122, roleKey).setDisplaySize(40, 32);
    if (this.role === "adult") {
      this.add.image(width - 34, 110, "wasabi").setDisplaySize(16, 18);
    }
  }

  private drawBackground(width: number, height: number): void {
    this.add.image(0, 0, "wood").setOrigin(0).setDisplaySize(width, height);
  }

  private drawConveyor(width: number): void {
    this.add
      .image(width / 2, CONVEYOR_Y + 6, "lane")
      .setDisplaySize(width + 20, CONVEYOR_HEIGHT + 32);
  }

  private drawJudgmentZone(zoneLeft: number, zoneRight: number): void {
    const g = this.add.graphics();
    const top = CONVEYOR_Y - CONVEYOR_HEIGHT / 2 - 12;
    const h = CONVEYOR_HEIGHT + 24;

    g.fillStyle(0xffe082, 0.18);
    g.fillRoundedRect(zoneLeft, top, ZONE_WIDTH, h, 10);

    g.lineStyle(3, 0xe53935, 0.85);
    g.strokeRoundedRect(zoneLeft, top, ZONE_WIDTH, h, 10);

    const cx = (zoneLeft + zoneRight) / 2;
    this.add.image(cx, top - 8, "wood-sign").setDisplaySize(92, 32);
    this.add
      .text(cx, top - 10, "ここ!", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .image(cx - 52, top - 6, "chopsticks")
      .setDisplaySize(70, 28)
      .setAngle(-18);
  }

  private drawGuide(): void {
    const targetLabel = this.role === "child" ? "わさび抜き" : "わさびあり";
    this.add
      .text(
        this.scale.width / 2,
        CONVEYOR_Y - CONVEYOR_HEIGHT / 2 - 56,
        `スペースで ${targetLabel} を取る（空皿はスルー）`,
        {
          fontFamily: FONT,
          fontSize: "15px",
          color: "#5d3318",
        },
      )
      .setOrigin(0.5);
  }
}
