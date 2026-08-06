export const tierFor = (price) => {
  const numericPrice = Number.parseFloat(String(price).replace(/[^0-9.]/g, ""));
  if (!numericPrice) return null;
  if (numericPrice < 10000) return "<$10K";
  if (numericPrice < 20000) return "<$20K";
  if (numericPrice < 30000) return "<$30K";
  if (numericPrice < 50000) return "$30-50K";
  if (numericPrice < 100000) return "$50-100K";
  return "High End";
};

export const chunkArray = (items, size) => {
  if (!Number.isInteger(size) || size < 1) throw new Error("Chunk size must be a positive integer.");
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export const databaseStatusForUi = (status) => status === "sold" ? "sold" : "available";

export const uiStatusForDatabase = (status) => status === "sold" ? "sold" : "live";

export const matchesInventoryTab = (status, tab) => (
  tab === "sold" ? uiStatusForDatabase(status) === "sold" : uiStatusForDatabase(status) === "live"
);
