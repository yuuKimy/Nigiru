import { describe, expect, it } from "vitest";
import { pickCustomerKind, pickCustomerOrder, pickOrder, TAMAGO_ORDER_RATE } from "./orders";

describe("pickCustomerKind", () => {
  it("returns child below 0.5 and adult at 0.5", () => {
    expect(pickCustomerKind(() => 0.49)).toBe("child");
    expect(pickCustomerKind(() => 0.5)).toBe("adult");
  });
});

describe("pickOrder", () => {
  it("leans none for children when not rushing", () => {
    expect(pickOrder("child", false, () => 0)).toBe("none");
    expect(pickOrder("child", false, () => 0.519)).toBe("none");
    expect(pickOrder("child", false, () => 0.52)).toBe("normal");
    expect(pickOrder("child", false, () => 0.879)).toBe("normal");
    expect(pickOrder("child", false, () => 0.88)).toBe("extra");
  });

  it("leans extra for adults when not rushing", () => {
    expect(pickOrder("adult", false, () => 0)).toBe("none");
    expect(pickOrder("adult", false, () => 0.139)).toBe("none");
    expect(pickOrder("adult", false, () => 0.14)).toBe("normal");
    expect(pickOrder("adult", false, () => 0.499)).toBe("normal");
    expect(pickOrder("adult", false, () => 0.5)).toBe("extra");
  });

  it("shifts toward extra during rush", () => {
    expect(pickOrder("child", true, () => 0.48)).toBe("normal");
    expect(pickOrder("adult", true, () => 0.1)).toBe("normal");
    expect(pickOrder("adult", true, () => 0.48)).toBe("extra");
  });

  it("picks none more often for children than adults over a sweep", () => {
    const samples = 1000;
    let childNone = 0;
    let adultNone = 0;
    let adultExtra = 0;
    let adultRushExtra = 0;
    for (let i = 0; i < samples; i++) {
      const roll = i / samples;
      if (pickOrder("child", false, () => roll) === "none") {
        childNone += 1;
      }
      const adult = pickOrder("adult", false, () => roll);
      if (adult === "none") {
        adultNone += 1;
      }
      if (adult === "extra") {
        adultExtra += 1;
      }
      if (pickOrder("adult", true, () => roll) === "extra") {
        adultRushExtra += 1;
      }
    }
    expect(childNone).toBeGreaterThan(adultNone);
    expect(adultExtra).toBeGreaterThan(adultNone);
    expect(adultRushExtra).toBeGreaterThan(adultExtra);
  });
});

describe("pickCustomerOrder", () => {
  it("returns tamago with none wasabi below TAMAGO_ORDER_RATE", () => {
    expect(pickCustomerOrder("adult", false, () => 0)).toEqual({
      neta: "tamago",
      wasabi: "none",
    });
    expect(pickCustomerOrder("child", false, () => TAMAGO_ORDER_RATE - 0.001)).toEqual({
      neta: "tamago",
      wasabi: "none",
    });
  });

  it("returns maguro with wasabi roll at or above TAMAGO_ORDER_RATE", () => {
    expect(pickCustomerOrder("adult", false, () => TAMAGO_ORDER_RATE)).toEqual({
      neta: "maguro",
      wasabi: "normal",
    });
    expect(pickCustomerOrder("child", false, () => 0.99)).toEqual({
      neta: "maguro",
      wasabi: "extra",
    });
  });

  it("uses separate rolls for neta and wasabi", () => {
    let calls = 0;
    const random = () => {
      calls += 1;
      return calls === 1 ? 0.99 : 0;
    };
    expect(pickCustomerOrder("adult", false, random)).toEqual({
      neta: "maguro",
      wasabi: "none",
    });
  });
});
