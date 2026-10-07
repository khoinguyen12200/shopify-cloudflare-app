import test from "node:test";
import assert from "node:assert/strict";
import {
  pathsIncludeShopifyConfig,
  touchesShopifyConfig,
  CONFIG_DIFF_LOOKBACK,
} from "./shopify-config-paths.mjs";

test("pathsIncludeShopifyConfig: matches a changed extension file", () => {
  assert.equal(pathsIncludeShopifyConfig(["extensions/trade-in-page/src/Page.jsx"]), true);
});

test("pathsIncludeShopifyConfig: matches a changed shopify.app.toml", () => {
  assert.equal(pathsIncludeShopifyConfig(["shopify.app.toml"]), true);
});

test("pathsIncludeShopifyConfig: does not match an unrelated app file", () => {
  assert.equal(pathsIncludeShopifyConfig(["app/services/ticket.server.ts"]), false);
});

test("pathsIncludeShopifyConfig: returns false for an empty change list", () => {
  assert.equal(pathsIncludeShopifyConfig([]), false);
});

test("touchesShopifyConfig: diffs a wide lookback window", () => {
  let calledArgs;
  const mockRunGit = (args) => {
    calledArgs = args;
    return "app/foo.ts\n";
  };
  touchesShopifyConfig(mockRunGit);
  assert.deepEqual(calledArgs, ["diff", "--name-only", `HEAD~${CONFIG_DIFF_LOOKBACK}`, "HEAD"]);
});

test("touchesShopifyConfig: returns true when a commit within lookback touched extensions/", () => {
  const mockRunGit = () => "README.md\nextensions/trade-in-theme/blocks/trade-in.liquid\n";
  assert.equal(touchesShopifyConfig(mockRunGit), true);
});

test("touchesShopifyConfig: returns false when nothing touched Shopify config", () => {
  const mockRunGit = () => "app/foo.ts\ntest/bar.test.ts\n";
  assert.equal(touchesShopifyConfig(mockRunGit), false);
});

test("touchesShopifyConfig: fails open (deploys) when git cannot diff (e.g. shallow clone)", () => {
  const mockRunGit = () => {
    throw new Error("fatal: ambiguous argument HEAD~20");
  };
  assert.equal(touchesShopifyConfig(mockRunGit), true);
});
