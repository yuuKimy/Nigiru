import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { SelectScene } from "./game/scenes/SelectScene";
import { GameScene } from "./game/scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 800,
  height: 600,
  backgroundColor: "#d6ae70",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, SelectScene, GameScene],
};

type GameHolder = { __nigiruGame?: Phaser.Game };
const holder = globalThis as GameHolder;

holder.__nigiruGame?.destroy(true);
document.getElementById("game-container")?.replaceChildren();

const game = new Phaser.Game(config);
holder.__nigiruGame = game;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
    delete holder.__nigiruGame;
    window.location.reload();
  });
}
