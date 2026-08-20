import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import {
  pickCustomerKind,
  pickOrder,
  WASABI_LABEL,
  type CustomerKind,
  type WasabiAmount,
} from "../orders";
import {
  INITIAL_LIFE,
  MAX_COMBO_MULTIPLIER,
  SEAT_COUNT,
  applyWalkout,
  canShip,
  isRush,
  resolvePlateAtSeats,
  scoreForOk,
  shouldDiscardPlate,
} from "../rules";
import { FONT } from "../theme";

const CONVEYOR_HEIGHT = 100;
const CONVEYOR_Y = 318;
const PLATE_WIDTH = 72;
const PLATE_HEIGHT = 52;
const BASE_SUSHI_SPEED = 170;
const BASE_PATIENCE_MS = 14000;
const MIN_PATIENCE_MS = 7200;
const ENTER_INTERVAL_START = 5000;
const ENTER_INTERVAL_MIN = 2400;
const RUSH_ENTER_INTERVAL = 1700;
const SHIP_COOLDOWN_MS = 160;

const CHILD_KEYS = ["customer-child-a"] as const;
const ADULT_KEYS = ["customer-adult-a", "customer-adult-b"] as const;

type Plate = {
  amount: WasabiAmount;
  resolved: boolean;
  passed: boolean[];
  container: Phaser.GameObjects.Container;
};

type Customer = {
  kind: CustomerKind;
  amount: WasabiAmount;
  patience: number;
  maxPatience: number;
  spriteKey: string;
};

type SeatView = {
  x: number;
  customer: Customer | null;
  root: Phaser.GameObjects.Container;
  body?: Phaser.GameObjects.Image;
  bubble?: Phaser.GameObjects.Container;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
};

export class GameScene extends Phaser.Scene {
  private plates: Plate[] = [];
  private seats: SeatView[] = [];
  private score = 0;
  private life = INITIAL_LIFE;
  private combo = 0;
  private isGameOver = false;
  private elapsedMs = 0;
  private enterAccMs = 0;
  private shipCoolMs = 0;
  private rushAnnounced = false;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private rushText!: Phaser.GameObjects.Text;
  private chef?: Phaser.GameObjects.Image;
  private chefScaleX = 1;
  private chefScaleY = 1;
  private chefPulse?: Phaser.Tweens.Tween;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private keyNone!: Phaser.Input.Keyboard.Key;
  private keyNormal!: Phaser.Input.Keyboard.Key;
  private keyExtra!: Phaser.Input.Keyboard.Key;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;

  constructor() {
    super("Game");
  }

  init(): void {
    this.plates = [];
    this.seats = [];
    this.score = 0;
    this.life = INITIAL_LIFE;
    this.combo = 0;
    this.isGameOver = false;
    this.elapsedMs = 0;
    this.enterAccMs = 0;
    this.shipCoolMs = 0;
    this.rushAnnounced = false;
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.image(0, 0, "wood").setOrigin(0).setDisplaySize(width, height);
    this.add
      .image(width / 2, CONVEYOR_Y + 6, "lane")
      .setDisplaySize(width + 20, CONVEYOR_HEIGHT + 32);

    this.createSeats(width);
    this.seatCustomer(0);
    this.drawChef();
    this.drawHud(width);
    this.drawButtons(width, height);
    this.refreshHud();

    const keyboard = this.input.keyboard!;
    this.keyNone = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.keyNormal = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.keyExtra = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.keyLeft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyDown = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyRight = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    this.elapsedMs += delta;
    this.shipCoolMs = Math.max(0, this.shipCoolMs - delta);
    this.updateRushCue();
    this.updateEntering(delta);
    this.updatePatience(delta);
    this.updatePlates(delta);
    this.pollKeys();
  }

  private updateRushCue(): void {
    const rushing = isRush(this.elapsedMs);
    this.rushText.setAlpha(rushing ? 1 : 0);
    if (rushing && !this.rushAnnounced) {
      this.rushAnnounced = true;
      SoundFx.rush();
    }
    if (!rushing) {
      this.rushAnnounced = false;
    }
  }

  private enterInterval(): number {
    if (isRush(this.elapsedMs)) {
      return RUSH_ENTER_INTERVAL;
    }
    const t = Math.min(1, this.elapsedMs / 90000);
    return ENTER_INTERVAL_START - (ENTER_INTERVAL_START - ENTER_INTERVAL_MIN) * t;
  }

  private updateEntering(delta: number): void {
    if (!this.seats.some((seat) => seat.customer === null)) {
      this.enterAccMs = 0;
      return;
    }

    this.enterAccMs += delta;
    if (this.enterAccMs >= this.enterInterval()) {
      this.enterAccMs = 0;
      const empty = this.seats
        .map((seat, index) => (seat.customer === null ? index : -1))
        .filter((index) => index >= 0);
      const index = empty[Math.floor(Math.random() * empty.length)];
      if (index !== undefined) {
        this.seatCustomer(index);
        SoundFx.enter();
      }
    }
  }

  private patienceForNewCustomer(): number {
    const comboCut = Math.min(this.combo, MAX_COMBO_MULTIPLIER) * 400;
    const rushCut = isRush(this.elapsedMs) ? 2800 : 0;
    return Math.max(MIN_PATIENCE_MS, BASE_PATIENCE_MS - comboCut - rushCut);
  }

  private updatePatience(delta: number): void {
    for (let i = 0; i < this.seats.length; i++) {
      const seat = this.seats[i];
      const customer = seat.customer;
      if (!customer) {
        continue;
      }

      customer.patience -= delta;
      this.updateSeatBar(seat);
      if (customer.patience <= 0) {
        this.walkout(i);
      }
    }
  }

  private updatePlates(delta: number): void {
    const dx = (BASE_SUSHI_SPEED * delta) / 1000;
    const rightEdge = this.scale.width + PLATE_WIDTH;

    for (let i = this.plates.length - 1; i >= 0; i--) {
      const plate = this.plates[i];
      if (plate.resolved) {
        continue;
      }

      plate.container.x += dx;

      const hit = resolvePlateAtSeats(
        plate.container.x,
        plate.amount,
        this.seats.map((seat) => ({ x: seat.x, amount: seat.customer?.amount ?? null })),
        plate.passed,
      );
      if (hit) {
        plate.passed[hit.seatIndex] = true;
        if (hit.take) {
          this.serve(i, hit.seatIndex);
        }
      }

      if (!plate.resolved && shouldDiscardPlate(plate.container.x, rightEdge)) {
        this.destroyPlate(i);
      }
    }
  }

  private pollKeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyNone) || Phaser.Input.Keyboard.JustDown(this.keyLeft)) {
      this.ship("none");
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keyNormal) ||
      Phaser.Input.Keyboard.JustDown(this.keyDown)
    ) {
      this.ship("normal");
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keyExtra) ||
      Phaser.Input.Keyboard.JustDown(this.keyRight)
    ) {
      this.ship("extra");
    }
  }

  private ship(amount: WasabiAmount): void {
    if (!canShip(this.isGameOver, this.shipCoolMs, this.plates.length)) {
      return;
    }

    this.shipCoolMs = SHIP_COOLDOWN_MS;
    SoundFx.nigiri();
    SoundFx.ship();
    this.pulseChef();

    const container = this.createPlateVisual(amount);
    container.setPosition(154, CONVEYOR_Y).setDepth(2);
    this.plates.push({
      amount,
      resolved: false,
      passed: this.seats.map(() => false),
      container,
    });
  }

  private serve(plateIndex: number, seatIndex: number): void {
    const plate = this.plates[plateIndex];
    const seat = this.seats[seatIndex];
    const customer = seat.customer;
    if (!customer) {
      return;
    }

    const remain = Phaser.Math.Clamp(customer.patience / customer.maxPatience, 0, 1);
    this.combo += 1;
    const multiplier = Math.min(this.combo, MAX_COMBO_MULTIPLIER);
    this.addScore(scoreForOk(this.combo, remain));
    SoundFx.ok(this.combo);
    this.showFeedback(seat.x, CONVEYOR_Y - 70, true, this.combo >= 2 ? `OK! x${multiplier}` : "OK!");

    plate.resolved = true;
    this.destroyPlate(plateIndex);
    this.clearSeat(seatIndex);
  }

  private walkout(seatIndex: number): void {
    const seat = this.seats[seatIndex];
    if (!seat.customer) {
      return;
    }

    const next = applyWalkout(this.score, this.life);
    this.score = next.score;
    this.combo = next.combo;
    SoundFx.miss();
    this.showFeedback(seat.x, CONVEYOR_Y - 70, false, "退席…");
    this.clearSeat(seatIndex);
    this.loseLife();
  }

  private clearSeat(index: number): void {
    const seat = this.seats[index];
    seat.customer = null;
    this.drawSeat(seat);
  }

  private updateSeatBar(seat: SeatView): void {
    const customer = seat.customer;
    if (!customer) {
      seat.barFill.scaleX = 0;
      seat.barBg.setAlpha(0.2);
      return;
    }
    seat.barBg.setAlpha(1);
    const ratio = Phaser.Math.Clamp(customer.patience / customer.maxPatience, 0, 1);
    seat.barFill.scaleX = ratio;
    seat.barFill.setFillStyle(ratio < 0.28 ? 0xe53935 : ratio < 0.55 ? 0xffb74d : 0x81c784);
  }

  private seatCustomer(index: number): void {
    const kind = pickCustomerKind();
    const amount = pickOrder(kind, isRush(this.elapsedMs));
    const keys = kind === "child" ? CHILD_KEYS : ADULT_KEYS;
    const spriteKey = keys[Math.floor(Math.random() * keys.length)];
    const patience = this.patienceForNewCustomer();
    this.seats[index].customer = {
      kind,
      amount,
      patience,
      maxPatience: patience,
      spriteKey,
    };
    this.drawSeat(this.seats[index]);
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

  private addScore(amount: number): void {
    this.score += amount;
    this.refreshHud();
  }

  private createSeats(width: number): void {
    const left = 272;
    const right = width - 70;
    const span = right - left;
    for (let i = 0; i < SEAT_COUNT; i++) {
      const x = left + (span * i) / (SEAT_COUNT - 1);
      const root = this.add.container(x, CONVEYOR_Y - 118);
      const barBg = this.add.rectangle(0, 56, 72, 10, 0x5d3318, 0.35);
      const barFill = this.add.rectangle(-36, 56, 72, 10, 0x81c784).setOrigin(0, 0.5);
      root.add([barBg, barFill]);
      this.seats.push({
        x,
        customer: null,
        root,
        barBg,
        barFill,
      });
      this.drawSeat(this.seats[i]);
    }
  }

  private drawChef(): void {
    if (!this.textures.exists("chef")) {
      return;
    }
    this.chef = this.add.image(102, CONVEYOR_Y - 50, "chef").setDisplaySize(146, 212);
    this.chefScaleX = this.chef.scaleX;
    this.chefScaleY = this.chef.scaleY;
    this.tweens.add({
      targets: this.chef,
      y: CONVEYOR_Y - 44,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private pulseChef(): void {
    if (!this.chef) {
      return;
    }
    this.chefPulse?.stop();
    this.chef.setScale(this.chefScaleX, this.chefScaleY);
    this.chefPulse = this.tweens.add({
      targets: this.chef,
      scaleX: this.chefScaleX * 1.06,
      scaleY: this.chefScaleY * 1.06,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private drawSeat(seat: SeatView): void {
    seat.body?.destroy();
    seat.bubble?.destroy();
    seat.body = undefined;
    seat.bubble = undefined;

    const customer = seat.customer;
    if (!customer) {
      seat.barFill.scaleX = 0;
      seat.barBg.setAlpha(0.2);
      const vacant = this.add
        .text(0, 8, "空席", {
          fontFamily: FONT,
          fontSize: "13px",
          color: "#8d6e4c",
        })
        .setOrigin(0.5);
      seat.bubble = this.add.container(0, 0, [vacant]);
      seat.root.add(seat.bubble);
      return;
    }

    if (this.textures.exists(customer.spriteKey)) {
      const child = customer.kind === "child";
      seat.body = this.add
        .image(0, child ? -4 : -8, customer.spriteKey)
        .setDisplaySize(child ? 84 : 94, child ? 100 : 110);
      seat.root.add(seat.body);
    }

    const bubble = this.add.container(0, -78);
    const g = this.add.graphics();
    g.fillStyle(0xfff8e1, 0.95);
    g.lineStyle(2, 0x5d3318, 0.85);
    g.fillRoundedRect(-40, -22, 80, 40, 10);
    g.strokeRoundedRect(-40, -22, 80, 40, 10);
    const mini = this.createMiniOrder(customer.amount);
    bubble.add([g, mini]);
    seat.bubble = bubble;
    seat.root.add(bubble);
    this.updateSeatBar(seat);
    seat.root.bringToTop(seat.barBg);
    seat.root.bringToTop(seat.barFill);
  }

  private createMiniOrder(amount: WasabiAmount): Phaser.GameObjects.Container {
    const mini = this.add.container(0, -4);
    if (this.textures.exists("maguro")) {
      mini.add(this.add.image(-10, 0, "maguro").setDisplaySize(28, 22));
    }
    if (amount !== "none" && this.textures.exists("wasabi")) {
      const size = amount === "extra" ? 18 : 11;
      mini.add(this.add.image(10, -8, "wasabi").setDisplaySize(size, size + 2));
    }
    mini.add(
      this.add
        .text(0, 16, WASABI_LABEL[amount], {
          fontFamily: FONT,
          fontSize: "11px",
          color: "#5d3318",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );
    return mini;
  }

  private createPlateVisual(amount: WasabiAmount): Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (this.textures.exists("plate-empty")) {
      parts.push(this.add.image(0, 8, "plate-empty").setDisplaySize(PLATE_WIDTH + 4, PLATE_HEIGHT + 6));
    }
    if (this.textures.exists("maguro")) {
      parts.push(this.add.image(0, -8, "maguro").setDisplaySize(58, 46));
    }
    if (amount !== "none" && this.textures.exists("wasabi")) {
      const extra = amount === "extra";
      parts.push(
        this.add
          .image(extra ? 12 : 10, extra ? -28 : -20, "wasabi")
          .setDisplaySize(extra ? 34 : 18, extra ? 38 : 20),
      );
    }
    return this.add.container(0, 0, parts);
  }

  private drawButtons(width: number, height: number): void {
    const amounts: WasabiAmount[] = ["none", "normal", "extra"];
    amounts.forEach((amount, i) => {
      const x = width * (0.2 + i * 0.3);
      const y = height - 62;
      const root = this.add.container(x, y);
      const hit = this.add
        .rectangle(0, 0, 150, 92, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });
      const g = this.add.graphics();
      g.fillStyle(0xfff3e0, 0.95);
      g.lineStyle(3, 0x5d3318, 0.9);
      g.fillRoundedRect(-72, -40, 144, 80, 16);
      g.strokeRoundedRect(-72, -40, 144, 80, 16);
      const preview = this.createPlateVisual(amount);
      preview.setScale(0.72);
      preview.y = -8;
      const label = this.add
        .text(0, 26, WASABI_LABEL[amount], {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#5d3318",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      root.add([g, preview, label, hit]);

      hit.on("pointerover", () => root.setScale(1.06));
      hit.on("pointerout", () => root.setScale(1));
      hit.on("pointerdown", () => {
        SoundFx.unlock();
        this.ship(amount);
      });
    });
  }

  private drawHud(width: number): void {
    this.add.image(width / 2, 32, "title-plaque").setDisplaySize(260, 50);
    this.add
      .text(width / 2, 30, "わさびパニック", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.rushText = this.add
      .text(width / 2, 58, "繁忙!", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#c62828",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add.image(70, 78, "plate-red").setDisplaySize(96, 96);
    this.add
      .text(70, 56, "SCORE", {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);
    this.scoreText = this.add
      .text(70, 74, "0", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#fff8e1",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.comboText = this.add
      .text(70, 94, "コンボ x1", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#ffe082",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.lifeIcons = [];
    for (let i = 0; i < INITIAL_LIFE; i++) {
      const icon = this.add
        .image(width - 32 - (INITIAL_LIFE - 1 - i) * 40, 70, "wasabi")
        .setDisplaySize(32, 36);
      this.lifeIcons.push(icon);
    }
  }

  private refreshHud(): void {
    this.scoreText.setText(`${this.score}`);
    const multiplier = Math.min(Math.max(this.combo, 1), MAX_COMBO_MULTIPLIER);
    this.comboText.setText(`コンボ x${multiplier}`);
    this.comboText.setAlpha(this.combo > 0 ? 1 : 0.35);

    for (let i = 0; i < this.lifeIcons.length; i++) {
      const filled = i < this.life;
      this.lifeIcons[i].setTexture(filled ? "wasabi" : "wasabi-empty");
      this.lifeIcons[i].setAlpha(filled ? 1 : 0.7);
    }
  }

  private showFeedback(x: number, y: number, correct: boolean, message: string): void {
    const fxKey = correct ? "star" : "steam";
    const fx = this.textures.exists(fxKey)
      ? this.add.image(x, y - 18, fxKey).setDisplaySize(correct ? 24 : 28, correct ? 24 : 32).setDepth(5)
      : undefined;
    const label = this.add
      .text(x, y, message, {
        fontFamily: FONT,
        fontSize: "18px",
        color: correct ? "#2e7d32" : "#c62828",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(5);
    const targets = fx ? [label, fx] : [label];
    this.tweens.add({
      targets,
      y: "-=28",
      alpha: 0,
      duration: 450,
      ease: "Cubic.easeOut",
      onComplete: () => {
        label.destroy();
        fx?.destroy();
      },
    });
  }

  private destroyPlate(index: number): void {
    this.plates[index].container.destroy();
    this.plates.splice(index, 1);
  }

  private enterGameOver(): void {
    this.isGameOver = true;
    SoundFx.gameOver();
    for (const plate of this.plates) {
      plate.resolved = true;
      plate.container.destroy();
    }
    this.plates = [];

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x3e2723, 0.55);
    if (this.textures.exists("plate-red")) {
      this.add.image(width / 2, height / 2 - 8, "plate-red").setDisplaySize(360, 360);
    }
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
    const makisu = this.textures.exists("makisu")
      ? this.add.image(0, 0, "makisu").setDisplaySize(210, 136)
      : undefined;
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
    if (makisu) {
      retry.add(makisu);
    }
    retry.add([retryHit, retryLabel]);
    retryHit.on("pointerover", () => retry.setScale(1.06));
    retryHit.on("pointerout", () => retry.setScale(1));
    retryHit.on("pointerdown", () => this.scene.start("Select"));
  }
}
