import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

globalThis.window = globalThis;
const dealsCode = fs.readFileSync(path.join(root, "docs", "deals.js"), "utf8");
vm.runInThisContext(dealsCode, { filename: "deals.js" });

const browse = require(path.join(root, "docs", "browse.js"));
const {
  BROWSE_CATEGORIES,
  browseCategory,
  inPack,
  filterDeals,
  sortDeals,
  groupForShelves,
  readState,
  writeState
} = browse;

const active = (globalThis.PERKCHECK_DEALS || []).filter((deal) => deal.status === "active");
const catKeys = new Set(BROWSE_CATEGORIES.map((item) => item.key));

test("every active deal maps to one browse category", () => {
  for (const deal of active) {
    const key = browseCategory(deal);
    assert.ok(catKeys.has(key), `${deal.id} -> ${key}`);
  }
  const packCats = active.filter((deal) => deal.category === "github-pack");
  assert.equal(packCats.length, 2);
  for (const deal of packCats) assert.equal(browseCategory(deal), "coding");
});

test("category counts add up once per active deal", () => {
  const counts = {};
  for (const deal of active) {
    const key = browseCategory(deal);
    counts[key] = (counts[key] || 0) + 1;
  }
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(sum, active.length);
  for (const cat of BROWSE_CATEGORIES) assert.ok(counts[cat.key] > 0, cat.key);
});

test("filterDeals pack/free/discount/us", () => {
  const packExpected = active.filter((deal) => inPack(deal)).length;
  assert.equal(filterDeals(active, { filters: ["pack"], q: "" }).length, packExpected);
  assert.ok(packExpected > 0);

  const free = filterDeals(active, { filters: ["free"], q: "" });
  assert.ok(free.length);
  assert.ok(free.every((deal) => deal.price_type === "free"));

  const discount = filterDeals(active, { filters: ["discount"], q: "" });
  assert.ok(discount.length);
  assert.ok(discount.every((deal) => deal.price_type === "discount"));

  const us = filterDeals(active, { filters: ["us"], q: "" });
  for (const deal of us) {
    const blocked = (deal.not_available_in || []).some((item) => item.country === "US");
    assert.equal(blocked, false, deal.id);
  }
});

test("sortDeals az and longest", () => {
  const az = sortDeals(active, "az");
  for (let i = 1; i < az.length; i++) {
    const brand = String(az[i - 1].brand || "").localeCompare(String(az[i].brand || ""));
    const title = String(az[i - 1].title || "").localeCompare(String(az[i].title || ""));
    assert.ok(brand < 0 || (brand === 0 && title <= 0), `${az[i - 1].brand} before ${az[i].brand}`);
  }

  const forever = { id: "forever", brand: "Aaa", title: "x", price_type: "free", free_months: null };
  const months = { id: "months", brand: "Bbb", title: "x", price_type: "free", free_months: 24 };
  const longest = sortDeals([months, forever], "longest");
  assert.equal(longest[0].id, "forever");
  assert.equal(longest[1].id, "months");
});

test("groupForShelves never repeats ids", () => {
  const grouped = groupForShelves(active);
  const seen = new Set();
  for (const deal of grouped.featured) {
    assert.equal(seen.has(deal.id), false);
    seen.add(deal.id);
  }
  for (const shelf of grouped.shelves) {
    for (const deal of shelf.deals) {
      assert.equal(seen.has(deal.id), false, deal.id);
      seen.add(deal.id);
      assert.equal(grouped.featured.some((item) => item.id === deal.id), false);
    }
  }
});

test("readState and writeState defaults", () => {
  const state = readState("?cat=nope&filter=free,bad&sort=zzz");
  assert.deepEqual(state, { cat: "all", filters: ["free"], sort: "best", q: "" });
  assert.equal(writeState({ cat: "all", filters: [], sort: "best", q: "" }), "");
  assert.equal(writeState({ cat: "design", filters: ["free", "ca"], sort: "newest", q: "figma" }), "cat=design&filter=free%2Cca&sort=newest&q=figma");
});
