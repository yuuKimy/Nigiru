import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import {
  pickCustomerKind,
  pickCustomerOrder,
  WASABI_LABEL,
  type CustomerKind,
  type NetaKind,
  type Order,
  type WasabiAmount,
} from "../orders";
import {
  INITIAL_LIFE,
  MAX_COMBO_MULTIPLIER,
  SEAT_COUNT,
  applyWalkout,
  canShip,
  isRush,
  patienceDrainMultiplier,
  resolvePlateAtSeats,
  rollRushPatienceDrainBoost,
  scoreForOk,
  shouldDiscardPlate,
} from "../rules";
import { FONT, formatScore } from "../theme";

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
const PATIENCE_ORANGE_RATIO = 0.55;
const PATIENCE_RED_RATIO = 0.28;
const ANGER_MARK_SIZE = { child: 16, adult: 20 } as const;
const ANGER_MARK_AT = {
  child: { x: 34, y: -40 },
  adult: { x: 38, y: -44 },
} as const;

const CHILD_KEYS = ["customer-child-a"] as const;
const ADULT_KEYS = ["customer-adult-a", "customer-adult-b"] as const;

type Plate = {
  neta: NetaKind;
  wasabi: WasabiAmount;
  resolved: boolean;
  passed: boolean[];
  container: Phaser.GameObjects.Container;
};

type Customer = {
  kind: CustomerKind;
  neta: NetaKind;
  wasabi: WasabiAmount;
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
  angerMark?: Phaser.GameObjects.Image;
  bodyShake?: Phaser.Tweens.Tween;
  bodyBaseX?: number;
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
  private rushPatienceBoost = 1;
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
  private keyTamago!: Phaser.Input.Keyboard.Key;

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
    this.rushPatienceBoost = 1;
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
    this.keyTamago = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
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
      this.rushPatienceBoost = rollRushPatienceDrainBoost();
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

      customer.patience -= delta * patienceDrainMultiplier(this.elapsedMs, this.rushPatienceBoost);
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
        plate.neta,
        plate.wasabi,
        this.seats.map((seat) => ({
          x: seat.x,
          neta: seat.customer?.neta ?? null,
          wasabi: seat.customer?.wasabi ?? null,
        })),
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
      this.ship({ neta: "maguro", wasabi: "none" });
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keyNormal) ||
      Phaser.Input.Keyboard.JustDown(this.keyDown)
    ) {
      this.ship({ neta: "maguro", wasabi: "normal" });
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keyExtra) ||
      Phaser.Input.Keyboard.JustDown(this.keyRight)
    ) {
      this.ship({ neta: "maguro", wasabi: "extra" });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyTamago)) {
      this.ship({ neta: "tamago", wasabi: "none" });
    }
  }

  private ship(order: Order): void {
    if (!canShip(this.isGameOver, this.shipCoolMs, this.plates.length)) {
      return;
    }

    this.shipCoolMs = SHIP_COOLDOWN_MS;
    SoundFx.nigiri();
    SoundFx.ship();
    this.pulseChef();

    const container = this.createPlateVisual(order.neta, order.wasabi);
    container.setPosition(154, CONVEYOR_Y).setDepth(2);
    this.plates.push({
      neta: order.neta,
      wasabi: order.wasabi,
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
    seat.barFill.setFillStyle(
      ratio < PATIENCE_RED_RATIO ? 0xe53935 : ratio < PATIENCE_ORANGE_RATIO ? 0xffb74d : 0x81c784,
    );
    this.syncSeatMood(seat, ratio);
  }

  private syncSeatMood(seat: SeatView, ratio: number): void {
    const mark = seat.angerMark;
    if (!seat.customer || !mark) {
      this.stopBodyShake(seat);
      return;
    }

    if (ratio >= PATIENCE_ORANGE_RATIO) {
      mark.setVisible(false);
      this.stopBodyShake(seat);
      return;
    }

    const furious = ratio < PATIENCE_RED_RATIO;
    mark.setVisible(true);
    const base = ANGER_MARK_SIZE[seat.customer.kind === "child" ? "child" : "adult"];
    const px = furious ? base * 1.1 : base;
    mark.setDisplaySize(px, px);

    if (furious) {
      this.startBodyShake(seat);
    } else {
      this.stopBodyShake(seat);
    }
  }

  private startBodyShake(seat: SeatView): void {
    if (!seat.body || seat.bodyShake) {
      return;
    }
    seat.bodyBaseX = seat.body.x;
    seat.bodyShake = this.tweens.add({
      targets: seat.body,
      x: seat.bodyBaseX + 3,
      duration: 70,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopBodyShake(seat: SeatView): void {
    seat.bodyShake?.stop();
    seat.bodyShake = undefined;
    if (seat.body && seat.bodyBaseX !== undefined) {
      seat.body.x = seat.bodyBaseX;
    }
    seat.bodyBaseX = undefined;
  }

  private seatCustomer(index: number): void {
    const kind = pickCustomerKind();
    const order = pickCustomerOrder(kind, isRush(this.elapsedMs));
    const keys = kind === "child" ? CHILD_KEYS : ADULT_KEYS;
    const spriteKey = keys[Math.floor(Math.random() * keys.length)];
    const patience = this.patienceForNewCustomer();
    this.seats[index].customer = {
      kind,
      neta: order.neta,
      wasabi: order.wasabi,
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
    this.stopBodyShake(seat);
    seat.body?.destroy();
    seat.bubble?.destroy();
    seat.angerMark?.destroy();
    seat.body = undefined;
    seat.bubble = undefined;
    seat.angerMark = undefined;

    const customer = seat.customer;
    if (!customer) {
      seat.barFill.scaleX = 0;
      seat.barBg.setAlpha(0.2);
      if (this.textures.exists("seat-empty")) {
        seat.body = this.add.image(0, -6, "seat-empty").setDisplaySize(80, 112);
        seat.root.add(seat.body);
      }
      return;
    }

    const child = customer.kind === "child";
    if (this.textures.exists(customer.spriteKey)) {
      seat.body = this.add
        .image(0, child ? -4 : -8, customer.spriteKey)
        .setDisplaySize(child ? 84 : 94, child ? 100 : 110);
      seat.root.add(seat.body);
    }

    const bubble = this.add.container(0, -86);
    const g = this.add.graphics();
    g.fillStyle(0xfff8e1, 0.95);
    g.lineStyle(2, 0x5d3318, 0.85);
    g.fillRoundedRect(-48, -26, 96, 54, 12);
    g.strokeRoundedRect(-48, -26, 96, 54, 12);
    const mini = this.createMiniOrder(customer.neta, customer.wasabi);
    bubble.add([g, mini]);
    seat.bubble = bubble;
    seat.root.add(bubble);

    if (this.textures.exists("anger-mark")) {
      const at = ANGER_MARK_AT[child ? "child" : "adult"];
      const size = ANGER_MARK_SIZE[child ? "child" : "adult"];
      seat.angerMark = this.add
        .image(at.x, at.y, "anger-mark")
        .setDisplaySize(size, size)
        .setVisible(false);
      seat.root.add(seat.angerMark);
      seat.root.bringToTop(seat.angerMark);
    }

    this.updateSeatBar(seat);
    seat.root.bringToTop(seat.barBg);
    seat.root.bringToTop(seat.barFill);
  }

  private createMiniOrder(neta: NetaKind, wasabi: WasabiAmount): Phaser.GameObjects.Container {
    const mini = this.add.container(0, -4);
    const netaKey = neta === "tamago" ? "tamago" : "maguro";
    if (this.textures.exists(netaKey)) {
      mini.add(this.add.image(-10, -2, netaKey).setDisplaySize(32, 26));
    }
    if (neta === "maguro" && wasabi !== "none" && this.textures.exists("wasabi")) {
      const size = wasabi === "extra" ? 20 : 13;
      mini.add(this.add.image(12, -10, "wasabi").setDisplaySize(size, size + 2));
    }
    const labelText = neta === "tamago" ? "たまご" : WASABI_LABEL[wasabi];
    mini.add(
      this.add
        .text(0, 18, labelText, {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#5d3318",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );
    return mini;
  }

  private createPlateVisual(neta: NetaKind, wasabi: WasabiAmount): Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (this.textures.exists("plate-empty")) {
      parts.push(this.add.image(0, 8, "plate-empty").setDisplaySize(PLATE_WIDTH + 4, PLATE_HEIGHT + 6));
    }
    const netaKey = neta === "tamago" ? "tamago" : "maguro";
    if (this.textures.exists(netaKey)) {
      parts.push(this.add.image(0, -8, netaKey).setDisplaySize(58, 46));
    }
    if (neta === "maguro" && wasabi !== "none" && this.textures.exists("wasabi")) {
      const extra = wasabi === "extra";
      parts.push(
        this.add
          .image(extra ? 12 : 10, extra ? -28 : -20, "wasabi")
          .setDisplaySize(extra ? 34 : 18, extra ? 38 : 20),
      );
    }
    return this.add.container(0, 0, parts);
  }

  private drawButtons(width: number, height: number): void {
    const maguroAmounts: WasabiAmount[] = ["none", "normal", "extra"];
    const buttonW = 180;
    const buttonH = 80;
    const slots = 4;

    maguroAmounts.forEach((wasabi, i) => {
      this.drawShipButton(
        width * (i + 0.5) / slots,
        height - 62,
        buttonW,
        buttonH,
        { neta: "maguro", wasabi },
        WASABI_LABEL[wasabi],
      );
    });

    this.drawShipButton(
      width * (3 + 0.5) / slots,
      height - 62,
      buttonW,
      buttonH,
      { neta: "tamago", wasabi: "none" },
      "たまご",
    );
  }

  private drawShipButton(
    x: number,
    y: number,
    buttonW: number,
    buttonH: number,
    order: Order,
    labelText: string,
  ): void {
    const root = this.add.container(x, y);
    const halfW = buttonW / 2;
    const halfH = buttonH / 2;
    const hit = this.add
      .rectangle(0, 0, buttonW - 8, buttonH + 12, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const g = this.add.graphics();
    g.fillStyle(0xfff3e0, 0.95);
    g.lineStyle(3, 0x5d3318, 0.9);
    g.fillRoundedRect(-halfW, -halfH, buttonW, buttonH, 16);
    g.strokeRoundedRect(-halfW, -halfH, buttonW, buttonH, 16);
    const preview = this.createPlateVisual(order.neta, order.wasabi);
    preview.setScale(0.72);
    preview.y = -8;
    const label = this.add
      .text(0, 26, labelText, {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    root.add([g, preview, label, hit]);

    hit.on("pointerover", () => root.setScale(1.06));
    hit.on("pointerout", () => root.setScale(1));
    hit.on("pointerdown", () => {
      SoundFx.unlock();
      this.ship(order);
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
      .text(width / 2, 62, "繁忙!", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#c62828",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setStroke("#fff8e1", 6)
      .setAlpha(0);

    this.add.image(70, 78, "plate-octagon").setDisplaySize(96, 96);
    this.scoreText = this.add
      .text(70, 78, "0", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#3e2723",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.comboText = this.add
      .text(70, 138, "コンボ x1", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#5d3318",
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
    this.scoreText.setText(formatScore(this.score));
    const multiplier = Math.min(Math.max(this.combo, 1), MAX_COMBO_MULTIPLIER);
    this.comboText.setText(`コンボ x${multiplier}`);
    if (this.combo > 0) {
      this.comboText.setColor("#3e2723");
    } else {
      this.comboText.setColor("#5d3318");
    }
    this.comboText.setAlpha(1);

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
      .setStroke("#fff8e1", 5)
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
    this.add.rectangle(width / 2, height / 2, width, height, 0x3e2723, 0.72);
    if (this.textures.exists("plate-octagon")) {
      this.add.image(width / 2, height / 2 - 8, "plate-octagon").setDisplaySize(360, 360);
    }
    this.add
      .text(width / 2, height / 2 - 28, "おしまい", {
        fontFamily: FONT,
        fontSize: "36px",
        color: "#3e2723",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 8, `SCORE  ${formatScore(this.score)}`, {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const retry = this.add.container(width / 2, height / 2 + 96);
    const makisu = this.textures.exists("makisu")
      ? this.add.image(0, 0, "makisu").setDisplaySize(210, 136).setAlpha(0.78)
      : undefined;
    const retryHit = this.add
      .rectangle(0, 0, 210, 136, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const retryLabel = this.add
      .text(0, 4, "もういちど", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#c62828",
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
