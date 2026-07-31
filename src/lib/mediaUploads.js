export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_FILES_PER_PICK = 60;
export const MAX_PREVIEW_FILES = 12;

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "heic", "heif", "jpeg", "jpg", "png", "webp"]);
const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4"]);

const extensionFor = (file) => String(file?.name || "").split(".").pop()?.toLowerCase() || "";

export const isImageFile = (file) => {
  const type = String(file?.type || "").toLowerCase();
  return type.startsWith("image/") || IMAGE_EXTENSIONS.has(extensionFor(file));
};

export const isVideoFile = (file) => {
  const type = String(file?.type || "").toLowerCase();
  return type.startsWith("video/") || VIDEO_EXTENSIONS.has(extensionFor(file));
};

export const isSupportedMediaFile = (file) => isImageFile(file) || isVideoFile(file);

export const contentTypeForMedia = (file) => {
  if (file?.type) return file.type;
  const inferredTypes = {
    avif: "image/avif", gif: "image/gif", heic: "image/heic", heif: "image/heif",
    jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp",
    m4v: "video/x-m4v", mov: "video/quicktime", mp4: "video/mp4",
  };
  return inferredTypes[extensionFor(file)] || "application/octet-stream";
};

export const fileIdentity = (file) => [file?.name, file?.size, file?.lastModified].join(":");

export const mergeUploadSelection = (existingFiles = [], selectedFiles = []) => {
  const oversized = [];
  const unsupported = [];
  const existingKeys = new Set(existingFiles.map(fileIdentity));
  const unique = [];

  selectedFiles.forEach((file) => {
    if (!isSupportedMediaFile(file)) {
      unsupported.push(file);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      oversized.push(file);
      return;
    }
    const key = fileIdentity(file);
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    unique.push(file);
  });

  const added = unique.slice(0, MAX_FILES_PER_PICK);
  return {
    files: [...existingFiles, ...added],
    added,
    oversized,
    unsupported,
    skippedForBatchLimit: Math.max(0, unique.length - added.length),
  };
};
