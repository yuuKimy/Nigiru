import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.error(`[Boot] failed to load "${file.key}" from ${file.src}`);
    });

    this.load.image("sake", "assets/sushi/sake.png");
    this.load.image("maguro", "assets/sushi/maguro.png");
    this.load.image("tamago", "assets/sushi/tamago.png");
    this.load.image("ebi", "assets/sushi/ebi.png");
    this.load.image("ikura", "assets/sushi/ikura.png");
    this.load.image("maki", "assets/sushi/maki.png");

    this.load.image("wasabi", "assets/ui/wasabi.png");
    this.load.image("wasabi-empty", "assets/ui/wasabi-empty.png");
    this.load.image("soy", "assets/ui/soy.png");
    this.load.image("ginger", "assets/ui/ginger.png");
    this.load.image("chopsticks", "assets/ui/chopsticks.png");
    this.load.image("makisu", "assets/ui/makisu.png");
    this.load.image("plate-red", "assets/ui/plate-red.png");
    this.load.image("plate-octagon", "assets/ui/plate-octagon.png");
    this.load.image("plate-cat", "assets/ui/plate-cat.png");
    this.load.image("plate-empty", "assets/ui/plate-empty.png");
    this.load.image("wood", "assets/ui/wood.png");
    this.load.image("lane", "assets/ui/lane.png");
    this.load.image("star", "assets/ui/star.png");
    this.load.image("steam", "assets/ui/steam.png");
    this.load.image("wood-sign", "assets/ui/wood-sign.png");
    this.load.image("title-plaque", "assets/ui/title-plaque.png");
  }

  create(): void {
    let started = false;
    const start = () => {
      if (started) {
        return;
      }
      started = true;
      this.scene.start("Select");
    };

    this.time.delayedCall(1200, start);
    void document.fonts?.ready.then(start);
  }
}
