export type WasabiAmount = "none" | "normal" | "extra";
export type CustomerKind = "child" | "adult";

export const WASABI_LABEL: Record<WasabiAmount, string> = {
  none: "なし",
  normal: "普通",
  extra: "大盛り",
};

export function pickCustomerKind(random: () => number = Math.random): CustomerKind {
  return random() < 0.5 ? "child" : "adult";
}

export function pickOrder(
  kind: CustomerKind,
  rush: boolean,
  random: () => number = Math.random,
): WasabiAmount {
  const extraBoost = rush ? 0.12 : 0;
  const roll = random();

  if (kind === "child") {
    const none = 0.52;
    const normal = 0.36;
    if (roll < none - extraBoost * 0.4) {
      return "none";
    }
    if (roll < none + normal - extraBoost * 0.2) {
      return "normal";
    }
    return "extra";
  }

  if (roll < 0.14 - extraBoost * 0.4) {
    return "none";
  }
  if (roll < 0.14 + 0.36 - extraBoost * 0.2) {
    return "normal";
  }
  return "extra";
}
