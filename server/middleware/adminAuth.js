import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

function matches(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminAuth(req, res, next) {
  const [scheme, encoded] = String(req.headers.authorization || "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (matches(password, config.adminPassword)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="604 Sell Cars Admin", charset="UTF-8"');
  return res.status(401).send("Authentication required.");
}
