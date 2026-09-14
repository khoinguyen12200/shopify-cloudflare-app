#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const [command, ...args] = process.argv.slice(2);
const signal = AbortSignal.timeout(12_000);
process.on("uncaughtException", (error) => {
  console.error(`Illustration request failed: ${error.name === "TimeoutError" ? "timed out after 12 seconds" : error.message}`);
  process.exit(1);
});
const usage = () => console.error("Usage: npm run illustrations:search -- <query> [--limit N]\n       npm run illustrations:download -- <url> [--out path]");
if (!command) { usage(); process.exit(1); }
if (command === "search") {
  const limitAt = args.indexOf("--limit");
  const limit = Math.min(30, Math.max(1, Number(limitAt >= 0 ? args[limitAt + 1] : 10) || 10));
  const query = args.filter((arg, index) => arg !== "--limit" && index !== limitAt + 1).join("-").trim();
  if (!query) { usage(); process.exit(1); }
  const page = await fetch(`https://undraw.co/search/${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!page.ok) throw new Error(`unDraw search failed (${page.status})`);
  const html = await page.text();
  const urls = [...html.matchAll(/https:\/\/cdn\.undraw\.co\/illustrations?\/[^"' ]+?\.svg/g)].map((match) => match[0]);
  const unique = [...new Set(urls)].slice(0, limit);
  if (!unique.length) { console.error(`No unDraw illustrations found for "${query}".`); process.exit(0); }
  for (const url of unique) console.log(JSON.stringify({ provider: "unDraw", name: url.split("/").pop().replace(/\.svg$/, ""), source: `https://undraw.co/search/${encodeURIComponent(query)}`, download: url, license: "unDraw license", licenseUrl: "https://undraw.co/license" }));
  process.exit(0);
}
if (command !== "download" || args.length < 1) { usage(); process.exit(1); }
const url = args[0];
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args[outAt + 1] : join("public/illustrations", `download${extname(new URL(url).pathname) || ".bin"}`);
const response = await fetch(url, { signal, headers: { "User-Agent": "shopify-cloudflare-app illustration downloader" } });
if (!response.ok || !response.body) throw new Error(`Download failed (${response.status})`);
const type = response.headers.get("content-type") ?? "";
if (!/^image\/(svg\+xml|png|jpeg|webp|gif)|application\/svg/i.test(type)) throw new Error(`Refusing non-image response (${type})`);
await mkdir(dirname(out), { recursive: true });
await pipeline(response.body, createWriteStream(out));
console.log(`Downloaded ${url} to ${out}`);
