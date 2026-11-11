// Browse UI for the home page. Pure helpers first; DOM render only when document exists.
var BROWSE_CATEGORIES = [
  { key: "ai", label: "AI", line: "Chat, voice and coding assistants." },
  { key: "coding", label: "Coding", line: "Editors, IDEs, testing and developer services." },
  { key: "design", label: "Design", line: "UI, prototyping, 3D, CAD and architecture tools." },
  { key: "cloud", label: "Cloud", line: "Hosting, credits, databases and domains." },
  { key: "learning", label: "Learning", line: "Courses and practice for code and languages." },
  { key: "notes", label: "Notes", line: "Notes, docs and notebooks." },
  { key: "shopping", label: "Shopping", line: "Memberships and store tools." }
];

var BROWSE_FILTERS = [
  { key: "free", label: "Free" },
  { key: "discount", label: "Discount" },
  { key: "ca", label: "Works in Canada" },
  { key: "us", label: "Works in US" },
  { key: "pack", label: "GitHub Pack" }
];

var BROWSE_SORTS = ["best", "newest", "longest", "az"];

var BROWSE_ICONS = {
  all: '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  ai: '<path fill="currentColor" d="M12 2.2 13.5 8 19.3 9.5 13.5 11 12 16.8 10.5 11 4.7 9.5 10.5 8Z"/><path fill="currentColor" d="M18 14.2 18.7 16.3 20.8 17 18.7 17.7 18 19.8 17.3 17.7 15.2 17 17.3 16.3Z"/>',
  coding: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M8 8 4 12l4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  design: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 16.5 14.2 6.3a2.2 2.2 0 0 1 3.1 3.1L7.1 19.6H4Z"/>',
  notes: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 3.5h7.2L18 7.3V20.5H7Z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 3.8V8h4.2M9.5 12h6M9.5 15.5h6"/>',
  learning: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 6.5 12 3.5l9 3v11l-9-3-9 3Z"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 6.8v10.6"/>',
  cloud: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7.2 17.5h9.2a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6-1.3A3.2 3.2 0 0 0 7.2 17.5Z"/>',
  shopping: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M10.2 5.2h3.4L19.5 11l-6.6 6.6L6.5 11Z"/><circle cx="13.4" cy="8.6" r="1.15" fill="currentColor"/>'
};

function browseCategory(deal) {
  if (deal && deal.category === "github-pack") return "coding";
  return deal ? deal.category : "";
}

function inPack(deal) {
  return !!(deal && (deal.github_pack === true || deal.category === "github-pack"));
}

// Prefer app.js fitsCountry in the browser; keep a copy for Node tests.
function browseFitsCountry(deal, country) {
  if (typeof fitsCountry === "function") return fitsCountry(deal, country);
  if (country === "CA" && deal.ca_school_email === "unknown") return false;
  var codes = deal.countries || [];
  var listed = deal.countries_scope === "global" || codes.indexOf(country) !== -1 || codes.indexOf("GLOBAL") !== -1;
  var excluded = (deal.not_available_in || []).some(function (item) { return item.country === country; });
  if (!listed || excluded) return false;
  return !(country === "CA" && deal.ca_school_email === "rejected");
}

function categoryLabel(key) {
  for (var i = 0; i < BROWSE_CATEGORIES.length; i++) {
    if (BROWSE_CATEGORIES[i].key === key) return BROWSE_CATEGORIES[i].label;
  }
  return key || "";
}

function filterDeals(deals, state) {
  state = state || {};
  var filters = state.filters || [];
  var q = String(state.q || "").trim().toLowerCase();
  var words = q ? q.split(/\s+/).filter(Boolean) : [];
  var wantFree = filters.indexOf("free") !== -1;
  var wantDisc = filters.indexOf("discount") !== -1;
  var wantCa = filters.indexOf("ca") !== -1;
  var wantUs = filters.indexOf("us") !== -1;
  var wantPack = filters.indexOf("pack") !== -1;
  return (deals || []).filter(function (deal) {
    if (wantFree && !wantDisc && deal.price_type !== "free") return false;
    if (wantDisc && !wantFree && deal.price_type !== "discount") return false;
    if (wantCa && !browseFitsCountry(deal, "CA")) return false;
    if (wantUs && !browseFitsCountry(deal, "US")) return false;
    if (wantPack && !inPack(deal)) return false;
    if (words.length) {
      var hay = [deal.brand, deal.title, deal.about, categoryLabel(browseCategory(deal))].join(" ").toLowerCase();
      if (!words.every(function (word) { return hay.indexOf(word) !== -1; })) return false;
    }
    return true;
  });
}

function freeRank(deal) {
  if (deal.price_type !== "free") return -1;
  return deal.free_months == null ? 999 : Number(deal.free_months) || 0;
}

function sortDeals(deals, sortKey) {
  var list = (deals || []).slice();
  var key = BROWSE_SORTS.indexOf(sortKey) === -1 ? "best" : sortKey;
  list.sort(function (a, b) {
    if (key === "newest") {
      if (b.last_verified > a.last_verified) return 1;
      if (b.last_verified < a.last_verified) return -1;
      return String(a.brand || "").localeCompare(String(b.brand || ""));
    }
    if (key === "longest") {
      var rank = freeRank(b) - freeRank(a);
      if (rank) return rank;
      return String(a.brand || "").localeCompare(String(b.brand || ""));
    }
    if (key === "az") {
      var brand = String(a.brand || "").localeCompare(String(b.brand || ""));
      if (brand) return brand;
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    // best: free first, then featured rank, then newest, then brand
    var price = (a.price_type === "free" ? 0 : 1) - (b.price_type === "free" ? 0 : 1);
    if (price) return price;
    var fa = a.featured ? (a.featured_rank || 9) : 99;
    var fb = b.featured ? (b.featured_rank || 9) : 99;
    if (fa !== fb) return fa - fb;
    if (b.last_verified > a.last_verified) return 1;
    if (b.last_verified < a.last_verified) return -1;
    return String(a.brand || "").localeCompare(String(b.brand || ""));
  });
  return list;
}

function groupForShelves(deals) {
  var pool = deals || [];
  var featured = pool.filter(function (deal) { return deal.featured === true; })
    .sort(function (a, b) { return (a.featured_rank || 9) - (b.featured_rank || 9); })
    .slice(0, 4);
  var shown = {};
  featured.forEach(function (deal) { shown[deal.id] = true; });
  var shelves = [];
  BROWSE_CATEGORIES.forEach(function (cat) {
    var inCat = pool.filter(function (deal) { return browseCategory(deal) === cat.key; });
    var rest = sortDeals(inCat.filter(function (deal) { return !shown[deal.id]; }), "best").slice(0, 10);
    if (!rest.length) return;
    shelves.push({ key: cat.key, label: cat.label, line: cat.line, total: inCat.length, deals: rest });
  });
  return { featured: featured, shelves: shelves };
}

function readState(search) {
  var raw = String(search == null ? "" : search);
  if (raw.charAt(0) === "?") raw = raw.slice(1);
  var params = new URLSearchParams(raw);
  var cat = params.get("cat") || "all";
  if (cat !== "all" && !BROWSE_CATEGORIES.some(function (item) { return item.key === cat; })) cat = "all";
  var filters = String(params.get("filter") || "").split(",").filter(function (key) {
    return BROWSE_FILTERS.some(function (item) { return item.key === key; });
  });
  var sort = params.get("sort") || "best";
  if (BROWSE_SORTS.indexOf(sort) === -1) sort = "best";
  var q = params.get("q") || "";
  return { cat: cat, filters: filters, sort: sort, q: q };
}

function writeState(state) {
  state = state || {};
  var params = new URLSearchParams();
  if (state.cat && state.cat !== "all") params.set("cat", state.cat);
  if (state.filters && state.filters.length) params.set("filter", state.filters.join(","));
  if (state.sort && state.sort !== "best") params.set("sort", state.sort);
  if (state.q) params.set("q", state.q);
  return params.toString();
}

function newestVerified(deals) {
  return (deals || []).reduce(function (max, deal) {
    return deal.last_verified > max ? deal.last_verified : max;
  }, "");
}

function freshCutoff(deals) {
  var newest = newestVerified(deals);
  if (!newest) return "";
  var start = new Date(newest + "T00:00:00");
  start.setDate(start.getDate() - 6);
  return start.toISOString().slice(0, 10);
}

function isFreshDeal(deal, cutoff) {
  return !!(cutoff && deal.last_verified && deal.last_verified >= cutoff);
}

function browsePriceText(deal) {
  if (deal.price_type === "discount") {
    var text = deal.discount || "Discount";
    return text.length <= 12 ? text : "Discount";
  }
  if (deal.free_months) return "Free · " + deal.free_months + " mo";
  return "Free while student";
}

function browseEsc(value) {
  if (typeof escapeHtml === "function") return escapeHtml(value);
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function browseSvg(key) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (BROWSE_ICONS[key] || "") + "</svg>";
}

function safeBrowseLogo(value) {
  if (typeof safeLogoFile === "function") return safeLogoFile(value);
  return /^[a-z0-9.-]+\.svg$/i.test(value || "") ? value : "";
}

function safeBrowseHex(value) {
  if (typeof safeHex === "function") return safeHex(value);
  return /^#[0-9A-Fa-f]{3,8}$/.test(value || "") ? value : "";
}

// Attributes hydrateLogoImages / paintColoredLogos understand (same as bannerHtml / logoTile).
function browseLogoAttrs(deal) {
  var brand = browseEsc(deal.brand);
  var file = safeBrowseLogo(deal.logo);
  if (!file) return "";
  var fill = safeBrowseHex(deal.logo_color);
  if (fill) return ' data-logo="' + browseEsc(file) + '" data-fill="' + fill + '" data-alt="' + brand + ' logo"';
  return ' data-src="logos/' + browseEsc(file) + '" data-alt="' + brand + ' logo"';
}

function browseLetterHtml(deal) {
  if (safeBrowseLogo(deal.logo)) return "";
  var letter = browseEsc(String(deal.brand || "?").trim().charAt(0) || "?");
  return '<span class="browse-letter">' + letter + "</span>";
}

function browsePillsHtml(deal) {
  var priceClass = deal.price_type === "free" ? "free" : "disc";
  var html = '<span class="browse-pill ' + priceClass + '">' + browseEsc(browsePriceText(deal)) + "</span>";
  html += browseFitsCountry(deal, "CA")
    ? '<span class="browse-pill">CA</span>'
    : '<span class="browse-pill no">Not in CA</span>';
  html += browseFitsCountry(deal, "US")
    ? '<span class="browse-pill">US</span>'
    : '<span class="browse-pill no">Not in US</span>';
  if (inPack(deal)) html += '<span class="browse-pill pack">Pack</span>';
  return html;
}

function browseCardHtml(deal, options) {
  options = options || {};
  var background = safeBrowseHex(deal.banner_color) || "#F1F5F9";
  var fresh = options.fresh ? '<span class="browse-new">NEW</span>' : "";
  var about = options.withAbout && deal.about
    ? '<span class="browse-about">' + browseEsc(deal.about) + "</span>"
    : "";
  // Logo slot is separate so paintColoredLogos does not wipe the NEW badge.
  return '<a class="browse-card" href="deal.html?id=' + encodeURIComponent(deal.id) + '">' +
    '<div class="browse-banner" style="background:' + background + '">' +
      '<div class="browse-logo-slot"' + browseLogoAttrs(deal) + ">" + browseLetterHtml(deal) + "</div>" +
      fresh +
    "</div>" +
    '<div class="browse-body">' +
      '<span class="browse-brand">' + browseEsc(deal.brand) + "</span>" +
      '<span class="browse-title">' + browseEsc(deal.title) + "</span>" +
      about +
      '<div class="browse-foot">' + browsePillsHtml(deal) + "</div>" +
    "</div></a>";
}

function browseFeatHtml(deal) {
  var shortTitle = String(deal.title || "").split(",")[0];
  var background = safeBrowseHex(deal.banner_color) || "#334155";
  return '<a class="browse-feat" href="deal.html?id=' + encodeURIComponent(deal.id) + '" style="background:' + background + '">' +
    '<div class="browse-feat-logo"><div class="browse-logo-slot"' + browseLogoAttrs(deal) + ">" + browseLetterHtml(deal) + "</div></div>" +
    '<div class="browse-feat-copy">' +
      '<span class="browse-feat-k">Featured · ' + browseEsc(deal.brand) + "</span>" +
      '<span class="browse-feat-t">' + browseEsc(shortTitle) + "</span>" +
      '<span class="browse-feat-a">' + browseEsc(deal.about || "") + "</span>" +
      '<div class="browse-foot">' + browsePillsHtml(deal) + "</div>" +
    "</div></a>";
}

if (typeof module !== "undefined") {
  module.exports = {
    BROWSE_CATEGORIES: BROWSE_CATEGORIES,
    BROWSE_FILTERS: BROWSE_FILTERS,
    browseCategory: browseCategory,
    inPack: inPack,
    filterDeals: filterDeals,
    sortDeals: sortDeals,
    groupForShelves: groupForShelves,
    readState: readState,
    writeState: writeState
  };
}

if (typeof document !== "undefined") {
  (function () {
    var root = document.getElementById("browse");
    if (!root || !document.getElementById("browse-view")) return;

    var ALL = (window.PERKCHECK_DEALS || []).filter(function (deal) { return deal.status === "active"; });
    var freshCut = freshCutoff(ALL);
    var state = readState(location.search);
    var catsEl = document.getElementById("browse-cats");
    var filtersEl = document.getElementById("browse-filters");
    var viewEl = document.getElementById("browse-view");
    var qEl = document.getElementById("browse-q");
    var sortEl = document.getElementById("browse-sort");
    var countEl = document.getElementById("browse-count");
    var clearEl = document.getElementById("browse-clear");
    var headLine = document.getElementById("browse-head-line");
    var searchTimer = 0;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function syncUrl(push) {
      var query = writeState(state);
      var url = location.pathname + (query ? "?" + query : "") + "#browse";
      history[push ? "pushState" : "replaceState"](null, "", url);
    }

    function scrollBrowseTop() {
      var top = root.getBoundingClientRect().top + window.scrollY - 64;
      if (window.scrollY > top + 4) {
        window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
      }
    }

    function describeFilters() {
      var parts = state.filters.map(function (key) {
        for (var i = 0; i < BROWSE_FILTERS.length; i++) {
          if (BROWSE_FILTERS[i].key === key) return BROWSE_FILTERS[i].label;
        }
        return key;
      });
      if (state.q) parts.push('"' + state.q + '"');
      return parts.join(" + ") || "these filters";
    }

    function paintBrowse() {
      if (typeof hydrateLogoImages === "function") hydrateLogoImages(viewEl);
      if (typeof paintColoredLogos === "function") paintColoredLogos(viewEl);
    }

    function syncShelfArrows(row) {
      var wrap = row.parentNode;
      if (!wrap) return;
      var prev = wrap.querySelector(".browse-arrow.prev");
      var next = wrap.querySelector(".browse-arrow.next");
      if (!prev || !next) return;
      prev.hidden = row.scrollLeft < 8;
      next.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 8;
    }

    function setCategory(cat) {
      state.cat = cat;
      syncUrl(true);
      draw();
      scrollBrowseTop();
    }

    function clearExtras() {
      state.filters = [];
      state.q = "";
      state.sort = "best";
      if (qEl) qEl.value = "";
      if (sortEl) sortEl.value = "best";
      syncUrl(false);
      draw();
    }

    function renderAllView(pool) {
      var grouped = groupForShelves(pool);
      var html = "";
      if (grouped.featured.length) {
        html += '<section class="browse-shelf"><div class="browse-shelf-head"><h2>Featured</h2><span class="browse-blurb">Big ones most students should claim first</span></div>' +
          '<div class="browse-featured">' + grouped.featured.map(browseFeatHtml).join("") + "</div></section>";
      }
      grouped.shelves.forEach(function (shelf) {
        html += '<section class="browse-shelf" aria-labelledby="browse-sh-' + shelf.key + '">' +
          '<div class="browse-shelf-head"><h2 id="browse-sh-' + shelf.key + '">' + browseSvg(shelf.key) + browseEsc(shelf.label) + "</h2>" +
          '<span class="browse-blurb">' + browseEsc(shelf.line) + "</span>" +
          '<button type="button" class="browse-see" data-cat="' + shelf.key + '">See all ' + shelf.total + " →</button></div>" +
          '<div class="browse-row-wrap">' +
            '<button class="browse-arrow prev" type="button" aria-label="Scroll ' + browseEsc(shelf.label) + ' left" hidden>‹</button>' +
            '<div class="browse-row">' + shelf.deals.map(function (deal) {
              return browseCardHtml(deal, { fresh: isFreshDeal(deal, freshCut) });
            }).join("") + "</div>" +
            '<button class="browse-arrow next" type="button" aria-label="Scroll ' + browseEsc(shelf.label) + ' right"' +
              (shelf.deals.length > 4 ? "" : " hidden") + ">›</button>" +
          "</div></section>";
      });
      viewEl.innerHTML = html;
      Array.prototype.forEach.call(viewEl.querySelectorAll(".browse-row"), syncShelfArrows);
    }

    function renderGridView(list, catInfo) {
      var head = "";
      if (catInfo) {
        var allInCat = ALL.filter(function (deal) { return browseCategory(deal) === catInfo.key; });
        var freeCount = allInCat.filter(function (deal) { return deal.price_type === "free"; }).length;
        var bothCount = allInCat.filter(function (deal) {
          return browseFitsCountry(deal, "CA") && browseFitsCountry(deal, "US");
        }).length;
        head = '<section class="browse-cat-head"><div class="browse-cat-ico">' + browseSvg(catInfo.key) + "</div>" +
          "<div><h2>" + browseEsc(catInfo.label) + "</h2><p>" + browseEsc(catInfo.line) + "</p></div>" +
          '<div class="browse-facts"><span class="browse-fact">' + allInCat.length + " deals</span>" +
          '<span class="browse-fact">' + freeCount + " free</span>" +
          '<span class="browse-fact">' + bothCount + " work in CA and US</span></div></section>";
      }
      viewEl.innerHTML = head + '<div class="browse-grid">' + sortDeals(list, state.sort).map(function (deal) {
        return browseCardHtml(deal, { withAbout: true, fresh: isFreshDeal(deal, freshCut) });
      }).join("") + "</div>";
    }

    function draw() {
      var pool = filterDeals(ALL, state);
      var chips = [{ key: "all", label: "All" }].concat(BROWSE_CATEGORIES);
      catsEl.innerHTML = chips.map(function (cat) {
        var n = cat.key === "all" ? pool.length : pool.filter(function (deal) { return browseCategory(deal) === cat.key; }).length;
        var zero = !n && state.cat !== cat.key ? " zero" : "";
        return '<button type="button" class="browse-cat' + zero + '" data-cat="' + cat.key + '" aria-pressed="' + (state.cat === cat.key) + '">' +
          browseSvg(cat.key) + "<span>" + browseEsc(cat.label) + '</span><span class="browse-n">' + n + "</span></button>";
      }).join("");

      filtersEl.innerHTML = BROWSE_FILTERS.map(function (filter) {
        return '<button type="button" class="browse-fchip" data-filter="' + filter.key + '" aria-pressed="' +
          (state.filters.indexOf(filter.key) !== -1) + '">' + browseEsc(filter.label) + "</button>";
      }).join("");

      var activeChip = catsEl.querySelector('[aria-pressed="true"]');
      if (activeChip) {
        catsEl.scrollLeft = activeChip.offsetLeft - catsEl.offsetLeft - (catsEl.clientWidth - activeChip.offsetWidth) / 2;
      }

      if (qEl) qEl.value = state.q;
      if (sortEl) sortEl.value = state.sort;
      var busy = state.filters.length || state.q || state.sort !== "best";
      clearEl.hidden = !busy;

      if (headLine) {
        var freeTotal = ALL.filter(function (deal) { return deal.price_type === "free"; }).length;
        headLine.textContent = ALL.length + " deals checked for Canada and the US. " + freeTotal + " are free.";
      }

      var catInfo = BROWSE_CATEGORIES.filter(function (cat) { return cat.key === state.cat; })[0];
      var list = catInfo ? pool.filter(function (deal) { return browseCategory(deal) === catInfo.key; }) : pool;
      var where = catInfo ? " in " + catInfo.label : "";
      var countText = list.length + (list.length === 1 ? " deal" : " deals") + where;
      if (state.q) countText += ' matching "' + state.q + '"';
      countEl.textContent = countText;

      if (!list.length) {
        viewEl.innerHTML = '<div class="browse-empty"><h3>No deals match</h3><p>Nothing' + browseEsc(where) +
          " fits " + browseEsc(describeFilters()) + '.</p><button type="button" data-clear>Clear filters</button></div>';
        paintBrowse();
        return;
      }

      if (catInfo || state.q || state.sort !== "best") renderGridView(list, catInfo);
      else renderAllView(pool);
      paintBrowse();
    }

    catsEl.addEventListener("click", function (event) {
      var button = event.target.closest("[data-cat]");
      if (button) setCategory(button.getAttribute("data-cat"));
    });

    filtersEl.addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button) return;
      var key = button.getAttribute("data-filter");
      var index = state.filters.indexOf(key);
      if (index === -1) state.filters.push(key);
      else state.filters.splice(index, 1);
      syncUrl(false);
      draw();
    });

    viewEl.addEventListener("click", function (event) {
      var see = event.target.closest(".browse-see");
      if (see) {
        setCategory(see.getAttribute("data-cat"));
        return;
      }
      if (event.target.closest("[data-clear]")) {
        clearExtras();
        return;
      }
      var arrow = event.target.closest(".browse-arrow");
      if (!arrow) return;
      var row = arrow.parentNode.querySelector(".browse-row");
      if (!row) return;
      var delta = (arrow.classList.contains("next") ? 1 : -1) * row.clientWidth * 0.9;
      row.scrollBy({ left: delta, behavior: reduceMotion ? "auto" : "smooth" });
    });

    viewEl.addEventListener("scroll", function (event) {
      if (event.target.classList && event.target.classList.contains("browse-row")) syncShelfArrows(event.target);
    }, true);

    if (qEl) {
      qEl.addEventListener("input", function () {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(function () {
          state.q = qEl.value.trim();
          syncUrl(false);
          draw();
        }, 150);
      });
    }

    if (sortEl) {
      sortEl.addEventListener("change", function () {
        state.sort = sortEl.value;
        syncUrl(false);
        draw();
      });
    }

    clearEl.addEventListener("click", clearExtras);
    window.addEventListener("popstate", function () {
      state = readState(location.search);
      draw();
    });

    draw();

    var params = new URLSearchParams(location.search);
    if (params.get("cat") || params.get("filter") || params.get("sort") || params.get("q") || location.hash === "#browse") {
      root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  })();
}
