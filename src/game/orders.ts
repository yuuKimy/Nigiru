export type WasabiAmount = "none" | "normal" | "extra";
export type CustomerKind = "child" | "adult";
export type NetaKind = "maguro" | "tamago";

export type Order = {
  neta: NetaKind;
  wasabi: WasabiAmount;
};

export const WASABI_LABEL: Record<WasabiAmount, string> = {
  none: "なし",
  normal: "普通",
  extra: "大盛り",
};

/** たまご注文の出現率（開始値） */
export const TAMAGO_ORDER_RATE = 0.25;

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

export function pickCustomerOrder(
  kind: CustomerKind,
  rush: boolean,
  random: () => number = Math.random,
): Order {
  if (random() < TAMAGO_ORDER_RATE) {
    return { neta: "tamago", wasabi: "none" };
  }
  return { neta: "maguro", wasabi: pickOrder(kind, rush, random) };
}
