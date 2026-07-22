import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = path.join(root, "src", "data", "seed.json");
const sqlDir = path.join(root, "supabase", "seed");
const sqlPath = path.join(sqlDir, "classified-inventory.sql");
const records = JSON.parse(fs.readFileSync(seedPath, "utf8"));

const includes = (text, pattern) => pattern.test(text);
const textFor = (record) => `${record.t || ""}\n${record.de || ""}`.replace(/[*_#]/g, " ").toLowerCase();
const titleFor = (record) => (record.t || "").replace(/[*_#]/g, " ").toLowerCase();

function classifyBody(record) {
  const text = textFor(record);
  const title = titleFor(record);

  if (includes(text, /\b(minivan|passenger van|cargo van)\b/) || includes(title, /\b(odyssey|sienna|pacifica|grand caravan|caravan|carnival|sedona|sprinter|transit|promaster|metris|savana|express 2500|express 3500)\b/)) return "Van";
  if (includes(text, /\b(pickup|crew cab|double cab|quad cab|regular cab)\b/) || includes(title, /\b(f-?150|f-?250|f-?350|silverado|sierra|ram 1500|ram 2500|ram 3500|tacoma|tundra|frontier|ridgeline|maverick|ranger|colorado|canyon|gladiator|cybertruck)\b/)) return "Truck";
  if (includes(title, /\b(wrangler|bronco|defender)\b/) || includes(text, /\b(off-road|offroad)\b/)) return "Offroad";
  if (includes(text, /\b(suv|crossover|sport utility)\b/) || includes(title, /\b(4runner|rav4|cr-v|hr-v|pilot|passport|highlander|sequoia|pathfinder|rogue|murano|armada|qashqai|kicks|tucson|santa fe|palisade|kona|telluride|sorento|sportage|seltos|cx-3|cx-30|cx-5|cx-50|cx-9|cx-90|forester|outback|ascent|crosstrek|escape|explorer|expedition|edge|ecosport|bronco sport|equinox|traverse|tahoe|suburban|trailblazer|trax|terrain|acadia|yukon|encore|envision|enclave|cherokee|grand cherokee|compass|renegade|durango|journey|model y|model x|mach-e|ioniq 5|ev6|id\.4|ariya|bentayga|cayenne|macan|urus|levante|stelvio|grecale|g-class|gl[abceks]|ml\s?\d|x[1-7]\b|xm\b|q[2-8]\b|e-tron|xc40|xc60|xc90|q[ux]\d{2}|rdx|mdx|zdx|rx\d|nx\d|gx\d|lx\d|ux\d|range rover|discovery|evoque|velar|f-pace|e-pace|gv60|gv70|gv80|escalade|xt[4-6]|aviator|navigator|corsair)\b/)) return "SUV";
  if (includes(text, /\b(coupe|convertible|roadster|cabriolet|hardtop convertible|two-door|2-door)\b/) || includes(title, /\b(911|718|cayman|boxster|mustang(?! mach-e)|camaro|challenger|corvette|supra|brz|gr86|86 gt|miata|mx-5|rc\s?f|lc\s?500|sl\s?\d|amg gt|r8|tt\s|continental gt)\b/)) return "Coupe";
  if (includes(text, /\b(sedan|saloon|hatchback|wagon)\b/)) return "Sedan";
  return "Sedan";
}

function classifyTags(record) {
  const text = textFor(record);
  const title = titleFor(record);
  const intro = (record.de || "").replace(/[*_#]/g, " ").trim().toLowerCase().slice(0, 220);
  const kmText = String(record.k || "").toLowerCase().replaceAll(",", "").trim();
  const thousands = kmText.match(/(\d{1,3})\s*(?:xxx|k\b)/);
  const exactKm = kmText.match(/\d+/);
  const knownKm = thousands ? Number(thousands[1]) * 1000 : exactKm ? Number(exactKm[0]) : null;
  const tags = [];

  const hybrid = includes(text, /\b(hybrid|plug[- ]?in|phev|hev)\b/) || includes(title, /\b(prius|ioniq hybrid|revero)\b/);
  const electric = includes(text, /\b(all[- ]electric|fully electric|electric vehicle|electric powertrain|battery electric|\bev\b)\b/) || includes(title, /\b(tesla|model [3sxy]|ioniq [56]|kona ev|ev6|ev9|mach-e|mustang mach e|id\.4|ariya|leaf|bolt|polestar|taycan|e-tron|eq[abes]|bmw i[457x]|i4|i5|i7|ix\b|lyriq|revero)\b/);
  const diesel = includes(text, /\b(diesel|tdi|bluetec|duramax|cummins|power stroke|ecodiesel)\b/);
  const manual = includes(text, /\b(5|6|7)[- ]speed manual\b|\bmanual transmission\b|\bstick shift\b/) || includes(title, /\bmanual\b/);
  const performance = includes(text, /\b(high[- ]performance|performance (sedan|suv|coupe|car|vehicle)|track[- ]focused)\b/) || includes(title, /\b(amg|brabus|hellcat|srt|scat pack|r\/t|type r|civic si|elantra n|kona n|veloster n|golf r|gti|wrx|sti|gr corolla|gr supra|gr86|brz|mustang gt|shelby|camaro (ss|zl1)|corvette|challenger|charger (r\/t|srt)|m[23458]\b|m\d{3}i|rs[34567]\b|audi s[345678]\b|gts\b|gt3\b|gt4\b|turbo s|cayenne turbo|macan turbo|panamera turbo|911 turbo|quadrifoglio|blackwing|v-series|nismo)\b/);
  const luxury = includes(text, /\b(ultra[- ]luxury|luxury (sedan|suv|coupe|vehicle|car)|executive luxury)\b/) || includes(title, /\b(rolls[- ]?royce|bentley|aston martin|ferrari|lamborghini|maserati|porsche|mercedes|amg|bmw|audi|lexus|acura|infiniti|genesis|land rover|range rover|jaguar|cadillac|lincoln|volvo|tesla|karma)\b/);
  const brandNewClaim = includes(title, /\bbrand[- ]new\b|\bnew\b/) ||
    includes(intro, /^(brand[- ]new\b|(19|20)\d{2}[^\n]{0,100}[–—-]\s*brand[- ]new\b|🔥\s*brand[- ]new\b)/) ||
    includes(intro, /\bnever registered\b/);
  const brandNew = brandNewClaim && (knownKm === null || knownKm < 10000);

  if (hybrid) tags.push("Hybrid");
  if (electric) tags.push("Electric");
  if (diesel) tags.push("Diesel");
  if (manual) tags.push("Manual");
  if (performance) tags.push("Performance");
  if (luxury) tags.push("Luxury");
  if (brandNew) tags.push("Brand New");
  return tags;
}

const classified = records.map((record) => ({
  ...record,
  b: classifyBody(record),
  f: classifyTags(record),
}));

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = classified.map((record) => `(${sqlString(record.id)}, ${sqlString(record.b)}, array[${record.f.map(sqlString).join(", ")}]::text[])`);
const sql = `-- Generated by scripts/classify-inventory.mjs\nwith classified(id, body_type, fuel_tags) as (\n  values\n  ${values.join(",\n  ")}\n)\nupdate public.inventory as inventory\nset body_type = classified.body_type,\n    fuel_tags = classified.fuel_tags,\n    updated_at = now()\nfrom classified\nwhere inventory.id = classified.id;\n`;

if (process.argv.includes("--write")) {
  fs.writeFileSync(seedPath, `${JSON.stringify(classified, null, 2)}\n`);
  fs.mkdirSync(sqlDir, { recursive: true });
  fs.writeFileSync(sqlPath, sql);
}

const bodyCounts = Object.fromEntries([...new Set(classified.map((record) => record.b))].sort().map((body) => [body, classified.filter((record) => record.b === body).length]));
const tagCounts = Object.fromEntries(["Hybrid", "Electric", "Diesel", "Manual", "Performance", "Luxury", "Brand New"].map((tag) => [tag, classified.filter((record) => record.f.includes(tag)).length]));
console.log(JSON.stringify({ vehicles: classified.length, bodyCounts, tagCounts, wroteFiles: process.argv.includes("--write") }, null, 2));
