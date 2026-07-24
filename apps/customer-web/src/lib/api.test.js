import { describe, expect, it } from "vitest";
import { carImages, carVideos } from "./api";

describe("vehicle media ordering", () => {
  it("always returns the lowest sort-order image as the website cover", () => {
    const car = {
      media: [
        { id: 30, kind: "image", sort_order: 2, source_url: "https://media.example/rear.webp" },
        { id: 10, kind: "image", sort_order: 0, source_url: "https://media.example/front.webp" },
        { id: 20, kind: "image", sort_order: 1, source_url: "https://media.example/side.webp" },
      ],
    };

    expect(carImages(car)).toEqual([
      "https://media.example/front.webp",
      "https://media.example/side.webp",
      "https://media.example/rear.webp",
    ]);
  });

  it("keeps videos ordered without affecting the first cover image", () => {
    const car = {
      media: [
        { id: 30, kind: "video", sort_order: 2, source_url: "https://media.example/walkaround.mp4" },
        { id: 10, kind: "image", sort_order: 1, source_url: "https://media.example/front.webp" },
        { id: 20, kind: "video", sort_order: 0, source_url: "https://media.example/startup.mp4" },
      ],
    };

    expect(carImages(car)).toEqual(["https://media.example/front.webp"]);
    expect(carVideos(car)).toEqual([
      "https://media.example/startup.mp4",
      "https://media.example/walkaround.mp4",
    ]);
  });
});
