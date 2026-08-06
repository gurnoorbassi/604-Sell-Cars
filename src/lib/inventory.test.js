import { describe, expect, it } from "vitest";
import {
  chunkArray,
  databaseStatusForUi,
  matchesInventoryTab,
  tierFor,
  uiStatusForDatabase,
} from "./inventory";

describe("tierFor", () => {
  it("classifies dealership price strings", () => {
    expect(tierFor("9,999")).toBe("<$10K");
    expect(tierFor("$28 888")).toBe("<$30K");
    expect(tierFor("82,888")).toBe("$50-100K");
    expect(tierFor("144888")).toBe("High End");
  });

  it("does not classify missing prices", () => {
    expect(tierFor("")).toBeNull();
    expect(tierFor("TBD")).toBeNull();
  });
});

describe("chunkArray", () => {
  it("keeps API batches below their limit without dropping items", () => {
    const items = Array.from({ length: 501 }, (_, index) => index);
    const chunks = chunkArray(items, 250);
    expect(chunks.map((chunk) => chunk.length)).toEqual([250, 250, 1]);
    expect(chunks.flat()).toEqual(items);
  });

  it("rejects invalid chunk sizes", () => {
    expect(() => chunkArray([1], 0)).toThrow("positive integer");
  });
});

describe("inventory statuses", () => {
  it("uses the database check-constraint values for quick actions", () => {
    expect(databaseStatusForUi("live")).toBe("available");
    expect(databaseStatusForUi("available")).toBe("available");
    expect(databaseStatusForUi("sold")).toBe("sold");
  });

  it("keeps available and sold vehicles in exactly one UI tab", () => {
    expect(uiStatusForDatabase("available")).toBe("live");
    expect(matchesInventoryTab("available", "live")).toBe(true);
    expect(matchesInventoryTab("available", "sold")).toBe(false);
    expect(matchesInventoryTab("sold", "sold")).toBe(true);
  });
});
