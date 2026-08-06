const cleanText = (value) => String(value || "").replace(/[*_#]/g, " ").toLowerCase();

const includes = (text, pattern) => pattern.test(text);

export const inferBodyType = ({ title, description, currentBodyType = "" }) => {
  const heading = cleanText(title);
  const text = `${heading}\n${cleanText(description)}`;

  if (includes(text, /\b(convertible|cabriolet|cabrio|roadster|drop[- ]?top)\b/) || includes(heading, /\b(sl\s?\d{3}|mx-?5|miata|boxster)\b/)) return "Convertible";
  if (includes(text, /\b(minivan|mini van)\b/) || includes(heading, /\b(odyssey|sienna|pacifica|grand caravan|caravan|carnival|sedona)\b/)) return "Minivan";
  if (includes(text, /\b(hatchback|hatch back|\bhb\b)\b/) || includes(heading, /\b(golf(?:\s+r|\s+gti)?|mini cooper|micra|elantra gt|corolla hatchback|civic hatchback)\b/)) return "Hatchback";
  if (includes(text, /\b(wagon|estate)\b/) || includes(heading, /\b(allroad|avant|v60|v90|e\s?class wagon|3\s?series touring)\b/)) return "Wagon";
  if (includes(text, /\b(pickup|crew cab|double cab|quad cab|regular cab)\b/) || includes(heading, /\b(f-?150|f-?250|f-?350|silverado|sierra|ram 1500|ram 2500|ram 3500|tacoma|tundra|frontier|ridgeline|maverick|ranger|colorado|canyon|gladiator|cybertruck)\b/)) return "Truck";
  if (includes(heading, /\b(wrangler|bronco|defender)\b/) || includes(text, /\b(off[- ]?road)\b/)) return "Offroad";
  if (includes(heading, /\b(4runner|rav4|cr-v|hr-v|pilot|passport|highlander|sequoia|pathfinder|rogue|murano|armada|qashqai|kicks|tucson|santa fe|palisade|kona|telluride|sorento|sportage|seltos|tiguan|cx-3|cx-30|cx-5|cx-50|cx-9|cx-90|forester|outback|ascent|crosstrek|escape|explorer|expedition|equinox|traverse|tahoe|suburban|terrain|acadia|yukon|cherokee|grand cherokee|compass|durango|model y|model x|cayenne|macan|range rover|evoque|velar)\b/)) return "SUV";
  if (includes(text, /\b(suv|crossover|sport utility)\b/)) return "SUV";
  if (includes(text, /\b(coupe|two-door|2-door)\b/)) return "Coupe";
  if (includes(text, /\b(sedan|saloon)\b/)) return "Sedan";
  if (includes(text, /\b(cargo van|passenger van)\b/) || includes(heading, /\b(sprinter|transit|promaster|metris)\b/)) return "Van";
  return currentBodyType;
};

export const inferVehicleTags = ({ title, description, existingTags = [] }) => {
  const heading = cleanText(title);
  const text = `${heading}\n${cleanText(description)}`;
  const tags = new Set(existingTags.filter(Boolean));
  const add = (tag, pattern) => { if (includes(text, pattern)) tags.add(tag); };

  add("Hybrid", /\b(hybrid|plug[- ]?in|phev|hev|prius)\b/);
  add("Electric", /\b(all[- ]electric|fully electric|battery electric|electric vehicle|\bev\b|tesla|model [3sxy]|ioniq [56]|ev6|ev9|mach[- ]?e|id\.4|ariya|leaf|bolt|polestar|taycan|e-tron|eq[abes]|bmw i[457x]|\bix\b|lyriq)\b/);
  add("Diesel", /\b(diesel|tdi|bluetec|duramax|cummins|power stroke|ecodiesel)\b/);
  add("Manual", /\b(?:5|6|7)[- ]speed manual\b|\bmanual transmission\b|\bstick shift\b/);
  add("Automatic", /\bautomatic(?: transmission)?\b|\bcvt\b|\bdct\b|\btiptronic\b|\bdual[- ]clutch\b/);
  add("AWD", /\bawd\b|\ball[- ]wheel drive\b|\bquattro\b|\b4matic\b|\bxdrive\b/);
  add("4WD", /\b4wd\b|\b4x4\b|\bfour[- ]wheel drive\b/);
  add("FWD", /\bfwd\b|\bfront[- ]wheel drive\b/);
  add("Performance", /\b(amg|hellcat|srt|scat pack|type r|golf r|gti|wrx|sti|gr corolla|gr supra|mustang gt|shelby|camaro ss|zl1|corvette|nismo|track[- ]focused)\b/);
  add("Luxury", /\b(rolls[- ]?royce|bentley|aston martin|ferrari|lamborghini|maserati|porsche|mercedes|amg|bmw|audi|lexus|acura|infiniti|genesis|land rover|range rover|jaguar|cadillac|lincoln|volvo|tesla|karma)\b/);
  add("Brand New", /\bbrand[- ]new\b|\bnever registered\b/);

  const hasAlternativeFuel = ["Hybrid", "Electric", "Diesel"].some((tag) => tags.has(tag));
  if (!hasAlternativeFuel) tags.add("Gasoline");

  return [...tags];
};

export const normalizeVehicleClassification = (car) => ({
  ...car,
  bodyType: inferBodyType({
    title: car.title,
    description: car.description,
    currentBodyType: car.bodyType,
  }) || car.bodyType,
  fuelTags: inferVehicleTags({
    title: car.title,
    description: car.description,
    existingTags: car.fuelTags,
  }),
});
