import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_DIR = path.resolve("docs/images");

async function shotCanvas(page, filePath) {
  const canvas = await page.$("canvas");
  if (!canvas) {
    throw new Error("canvas not found");
  }
  await canvas.screenshot({ path: filePath });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: ["--window-size=1000,800", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });
    await page.goto("http://localhost:5173/", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await page.waitForSelector("canvas", { timeout: 15000 });
    await page.waitForFunction(
      () =>
        globalThis.__nigiruGame?.scene?.isActive("Select") === true,
      { timeout: 10000 },
    );
    await new Promise((r) => setTimeout(r, 400));

    const selectPath = path.join(OUT_DIR, "select.png");
    await shotCanvas(page, selectPath);
    console.log("wrote", selectPath);

    await page.evaluate(() => {
      const game = globalThis.__nigiruGame;
      game.scene.getScene("Select").scene.start("Game", { role: "child" });
    });
    await page.waitForFunction(
      () => globalThis.__nigiruGame?.scene?.isActive("Game") === true,
      { timeout: 10000 },
    );
    await new Promise((r) => setTimeout(r, 1600));

    const playPath = path.join(OUT_DIR, "play.png");
    await shotCanvas(page, playPath);
    console.log("wrote", playPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
