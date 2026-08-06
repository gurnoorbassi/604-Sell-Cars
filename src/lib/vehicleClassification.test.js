import { describe, expect, it } from "vitest";
import { inferBodyType, inferVehicleTags } from "./vehicleClassification";

describe("vehicle classification", () => {
  it("corrects common inventory body styles without guessing from nothing", () => {
    expect(inferBodyType({ title: "2024 Honda Civic Hatchback", currentBodyType: "Sedan" })).toBe("Hatchback");
    expect(inferBodyType({ title: "2024 Chrysler Grand Caravan", currentBodyType: "Van" })).toBe("Minivan");
    expect(inferBodyType({ title: "2021 Ford Mustang EcoBoost Convertible", currentBodyType: "Coupe" })).toBe("Convertible");
    expect(inferBodyType({ title: "2021 Volkswagen Tiguan Comfortline", currentBodyType: "Sedan" })).toBe("SUV");
    expect(inferBodyType({ title: "Unknown model", currentBodyType: "SUV" })).toBe("SUV");
  });

  it("adds explicit drivetrain tags and a safe fuel default", () => {
    expect(inferVehicleTags({ title: "Audi A4 quattro", description: "Automatic AWD sedan" })).toEqual(expect.arrayContaining(["Gasoline", "Automatic", "AWD", "Luxury"]));
    expect(inferVehicleTags({ title: "Tesla Model Y AWD", existingTags: [] })).toEqual(expect.arrayContaining(["Electric", "AWD", "Luxury"]));
    expect(inferVehicleTags({ title: "Tesla Model Y AWD", existingTags: [] })).not.toContain("Gasoline");
  });

  it("preserves manually assigned tags", () => {
    expect(inferVehicleTags({ title: "Custom vehicle", existingTags: ["Performance"] })).toEqual(["Performance", "Gasoline"]);
  });
});
