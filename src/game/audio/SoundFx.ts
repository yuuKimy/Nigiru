/** Web Audio による短い効果音（外部アセット不要） */
class SoundFxPlayer {
  private ctx: AudioContext | null = null;

  /** ブラウザの自動再生制限解除用。ユーザー操作の直後に呼ぶ。 */
  unlock(): void {
    const ctx = this.getContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  click(): void {
    this.tone(660, 0.06, "triangle", 0.05);
  }

  nigiri(): void {
    this.tone(220, 0.07, "triangle", 0.06);
    this.tone(140, 0.05, "sine", 0.04, 0.02);
  }

  ship(): void {
    this.tone(880, 0.05, "triangle", 0.04);
  }

  enter(): void {
    this.tone(784, 0.07, "sine", 0.05);
    this.tone(988, 0.08, "sine", 0.04, 0.06);
  }

  rush(): void {
    this.speedUp();
  }

  ok(combo: number): void {
    const base = 520 + Math.min(combo, 5) * 40;
    this.tone(base, 0.07, "sine", 0.07);
    this.tone(base * 1.33, 0.09, "sine", 0.05, 0.05);
  }

  miss(): void {
    this.tone(180, 0.14, "square", 0.045);
  }

  trap(): void {
    this.tone(140, 0.08, "sawtooth", 0.04);
    this.tone(110, 0.12, "sawtooth", 0.035, 0.07);
  }

  speedUp(): void {
    this.tone(440, 0.06, "square", 0.04);
    this.tone(554, 0.06, "square", 0.04, 0.07);
    this.tone(659, 0.1, "square", 0.045, 0.14);
  }

  gameOver(): void {
    this.tone(392, 0.12, "triangle", 0.05);
    this.tone(311, 0.14, "triangle", 0.05, 0.12);
    this.tone(233, 0.22, "triangle", 0.055, 0.26);
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const startAt = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.02);
    } catch {
      // AudioContext 未対応環境では無音のまま進める
    }
  }
}

export const SoundFx = new SoundFxPlayer();
