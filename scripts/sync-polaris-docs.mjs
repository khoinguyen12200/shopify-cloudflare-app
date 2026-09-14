#!/usr/bin/env node

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_BASE = "https://shopify.dev/docs/api/app-home/latest";
const OUTPUT_ROOT = path.resolve("docs/polaris");
const FAMILIES = ["web-components", "app-bridge-web-components", "patterns"];
const EXPECTED_MINIMUMS = {
  "web-components": 48,
  "app-bridge-web-components": 5,
  patterns: 16,
};
const LINK_PATTERN = new RegExp(
  `${SOURCE_BASE}/(?:${FAMILIES.join("|")})(?:/[a-z0-9-]+)*(?:\\.md)?`,
  "g",
);

function canonicalUrl(url) {
  return url.replace(/\.md$/, "").replace(/[)'",.;:]+$/, "");
}

function markdownUrl(url) {
  return `${canonicalUrl(url)}.md`;
}

function relativeSourcePath(url) {
  if (canonicalUrl(url) === SOURCE_BASE) return "overview";
  return canonicalUrl(url).slice(`${SOURCE_BASE}/`.length);
}

function outputPath(url) {
  const relative = relativeSourcePath(url);
  if (relative === "overview") return path.join(OUTPUT_ROOT, "overview.md");
  const parts = relative.split("/");
  return parts.length === 1
    ? path.join(OUTPUT_ROOT, parts[0], "README.md")
    : path.join(OUTPUT_ROOT, `${relative}.md`);
}

function titleFrom(markdown, url) {
  const frontmatterTitle = markdown.match(/^title:\s*(.+)$/m)?.[1];
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1];
  return (frontmatterTitle ?? heading ?? relativeSourcePath(url))
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

async function fetchMarkdown(url) {
  const source = markdownUrl(url);
  const response = await fetch(source, {
    headers: {
      Accept: "text/markdown",
      "User-Agent": "shopify-cloudflare-app-doc-sync/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${source}: HTTP ${response.status}`);
  }
  const markdown = await response.text();
  if (!markdown.includes("source_url:") || !markdown.match(/^#\s+/m)) {
    throw new Error(`Unexpected Markdown response from ${source}`);
  }
  return markdown.endsWith("\n") ? markdown : `${markdown}\n`;
}

function linksFrom(markdown) {
  return [...markdown.matchAll(LINK_PATTERN)]
    .map(([url]) => canonicalUrl(url))
    .filter((url) =>
      FAMILIES.some((family) => url.startsWith(`${SOURCE_BASE}/${family}`)),
    );
}

async function downloadAll() {
  const queue = [
    SOURCE_BASE,
    ...FAMILIES.map((family) => `${SOURCE_BASE}/${family}`),
  ];
  const seen = new Set();
  const pages = [];

  while (queue.length > 0) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const markdown = await fetchMarkdown(url);
    pages.push({
      family: relativeSourcePath(url).split("/")[0],
      title: titleFrom(markdown, url),
      url,
      markdownUrl: markdownUrl(url),
      file: path.relative(OUTPUT_ROOT, outputPath(url)),
      markdown,
    });

    for (const linkedUrl of linksFrom(markdown)) {
      if (!seen.has(linkedUrl)) queue.push(linkedUrl);
    }
  }

  return pages.sort((left, right) => left.file.localeCompare(right.file));
}

function renderIndex(pages, syncedAt) {
  const lines = [
    "# Shopify App Home reference",
    "",
    "Full Markdown reference mirrored from Shopify's official App Home `latest` documentation for fast local agent search.",
    "",
    `- Source: ${SOURCE_BASE}`,
    `- Synced: ${syncedAt}`,
    `- Pages: ${pages.length}`,
    "- Refresh: `npm run docs:polaris:sync`",
    "",
    "## Agent lookup workflow",
    "",
    "1. Search by task, element, prop, or slot with `rg`.",
    "2. Open the matching page template and composition before choosing markup.",
    "3. Open the exact reference page for every web component used; check properties, slots, events, methods, examples, and accessibility guidance.",
    "4. Use `manifest.json` to confirm the canonical source URL and sync metadata.",
    "5. Run the Shopify App Home skill's live lookup and validator before shipping code.",
    "",
    "Search examples:",
    "",
    "```bash",
    'rg -n "gridTemplateColumns|Slots|Examples" docs/polaris/web-components',
    'rg -n "resource picker|save bar" docs/polaris',
    "```",
    "",
    "## Overview",
    "",
    "- [App Home](./overview.md)",
    "",
  ];

  for (const family of FAMILIES) {
    lines.push(`## ${family.replaceAll("-", " ")}`, "");
    for (const page of pages.filter(
      (candidate) => candidate.family === family,
    )) {
      lines.push(`- [${page.title}](./${page.file})`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function writeDocumentation(pages) {
  const syncedAt = new Date().toISOString();
  for (const family of FAMILIES) {
    const count = pages.filter((page) => page.family === family).length;
    if (count < EXPECTED_MINIMUMS[family]) {
      throw new Error(
        `Refusing partial sync: expected at least ${EXPECTED_MINIMUMS[family]} ${family} pages, found ${count}.`,
      );
    }
  }

  for (const family of FAMILIES) {
    await rm(path.join(OUTPUT_ROOT, family), { recursive: true, force: true });
  }

  for (const page of pages) {
    const destination = outputPath(page.url);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, page.markdown, "utf8");
  }

  const manifest = {
    source: SOURCE_BASE,
    syncedAt,
    pageCount: pages.length,
    families: Object.fromEntries(
      FAMILIES.map((family) => [
        family,
        pages.filter((page) => page.family === family).length,
      ]),
    ),
    pages: pages.map(({ family, title, url, markdownUrl: md, file }) => ({
      family,
      title,
      sourceUrl: url,
      markdownUrl: md,
      file,
    })),
  };

  await writeFile(
    path.join(OUTPUT_ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(OUTPUT_ROOT, "README.md"),
    renderIndex(pages, syncedAt),
    "utf8",
  );
}

const pages = await downloadAll();
await writeDocumentation(pages);
console.log(
  `Synced ${pages.length} Shopify App Home Markdown pages to docs/polaris.`,
);
