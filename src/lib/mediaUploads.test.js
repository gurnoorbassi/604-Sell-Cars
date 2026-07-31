import { describe, expect, it } from "vitest";
import {
  MAX_FILES_PER_PICK,
  contentTypeForMedia,
  isImageFile,
  isVideoFile,
  mergeUploadSelection,
} from "./mediaUploads";

const file = (name, { size = 1, type = "", lastModified = 1 } = {}) => ({ name, size, type, lastModified });

describe("iPhone inventory media selection", () => {
  it("recognizes iPhone HEIC photos and MOV videos even when Safari omits the MIME type", () => {
    expect(isImageFile(file("IMG_1001.HEIC"))).toBe(true);
    expect(isVideoFile(file("IMG_1002.MOV"))).toBe(true);
    expect(contentTypeForMedia(file("IMG_1001.HEIC"))).toBe("image/heic");
    expect(contentTypeForMedia(file("IMG_1002.MOV"))).toBe("video/quicktime");
  });

  it("accepts 60 files in one picker action and allows another batch afterward", () => {
    const firstPick = Array.from({ length: MAX_FILES_PER_PICK + 4 }, (_, index) => file(`photo-${index}.jpg`, { type: "image/jpeg", lastModified: index }));
    const first = mergeUploadSelection([], firstPick);
    expect(first.files).toHaveLength(MAX_FILES_PER_PICK);
    expect(first.skippedForBatchLimit).toBe(4);
    const second = mergeUploadSelection(first.files, [file("another.jpg", { type: "image/jpeg", lastModified: 100 })]);
    expect(second.files).toHaveLength(MAX_FILES_PER_PICK + 1);
  });

  it("filters oversized, unsupported, and duplicate files without losing valid selections", () => {
    const existing = file("front.jpg", { type: "image/jpeg", lastModified: 5 });
    const result = mergeUploadSelection([existing], [
      existing,
      file("interior.jpg", { type: "image/jpeg", lastModified: 6 }),
      file("huge.mov", { size: 51 * 1024 * 1024, type: "video/quicktime" }),
      file("notes.pdf", { type: "application/pdf" }),
    ]);
    expect(result.files.map((item) => item.name)).toEqual(["front.jpg", "interior.jpg"]);
    expect(result.oversized.map((item) => item.name)).toEqual(["huge.mov"]);
    expect(result.unsupported.map((item) => item.name)).toEqual(["notes.pdf"]);
  });
});
