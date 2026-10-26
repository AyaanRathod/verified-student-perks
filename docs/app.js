// Pinned on 2026-10-24. This was the latest commit on master that day.
var HIPO_SCHOOL_LIST_COMMIT = "603e10f51b67c6553b9bca9aecc0db4c2417ed10";
var schoolListFromFallback = false;

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  var date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function countryBadges(deal) {
  var html = (deal.countries || []).map(function (code) {
    return '<span class="badge ok">' + escapeHtml(code) + "</span>";
  }).join("");
  (deal.not_available_in || []).forEach(function (item) {
    html += '<span class="badge no">Not in ' + escapeHtml(item.country) + "</span>";
  });
  return html;
}

function priceLine(deal) {
  if (deal.free_months) return "Free for " + deal.free_months + " months";
  if (deal.price_type === "discount") return deal.discount || "Discount";
  return "Free while you are a student";
}

function priceBadge(deal) {
  if (deal.price_type === "discount") return '<span class="badge disc">' + escapeHtml(deal.discount || "Discount") + "</span>";
  if (deal.free_months) return '<span class="badge tag">Free · ' + deal.free_months + " months</span>";
  return '<span class="badge tag">Free</span>';
}

function safeHex(value) {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value || "") ? value : "";
}

function safeLogoFile(value) {
  return /^[a-z0-9.-]+\.svg$/i.test(value || "") ? value : "";
}

function rowLayout() {
  return window.matchMedia("(max-width: 800px)").matches;
}

function bannerHtml(deal, options) {
  var background = safeHex(deal.banner_color) || "#F1F5F9";
  var brand = escapeHtml(deal.brand);
  var file = safeLogoFile(deal.logo);
  if (!file) {
    return '<div class="card-banner" style="background:' + background + '"><span class="banner-name">' + brand + "</span></div>";
  }
  var fill = safeHex(deal.logo_color);
  var showNow = !options || !rowLayout() || options.featured;
  if (fill) {
    return '<div class="card-banner logo" style="background:' + background + '" data-logo="' + escapeHtml(file) + '" data-fill="' + fill + '" data-alt="' + brand + ' logo"></div>';
  }
  if (!showNow) {
    return '<div class="card-banner logo" style="background:' + background + '" data-src="logos/' + escapeHtml(file) + '" data-alt="' + brand + ' logo"></div>';
  }
  return '<div class="card-banner logo" style="background:' + background + '"><img src="logos/' + escapeHtml(file) + '" alt="' + brand + ' logo" loading="lazy" decoding="async"></div>';
}

var logoTextCache = {};
var logoObserver = null;

function loadLogoText(file) {
  if (!logoTextCache[file]) {
    logoTextCache[file] = fetch("logos/" + file).then(function (response) {
      if (!response.ok) throw new Error("logo");
      return response.text();
    });
  }
  return logoTextCache[file];
}

function paintSlot(slot) {
  if (!slot || slot.getAttribute("data-painted") === "1") return;
  if (getComputedStyle(slot).display === "none") return;
  var file = slot.getAttribute("data-logo");
  var fill = slot.getAttribute("data-fill");
  if (!safeLogoFile(file) || !safeHex(fill)) return;
  slot.setAttribute("data-painted", "1");
  loadLogoText(file).then(function (text) {
    var parsed = new DOMParser().parseFromString(text, "image/svg+xml");
    var svg = parsed.querySelector("svg");
    if (!svg || parsed.querySelector("parsererror")) return;
    parsed.querySelectorAll("script").forEach(function (node) { node.remove(); });
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", slot.getAttribute("data-alt") || "");
    svg.setAttribute("fill", fill);
    svg.style.color = fill;
    svg.style.height = slot.classList.contains("logo-tile") ? "32px" : (slot.closest(".deal") ? "96px" : "64px");
    svg.style.width = "auto";
    svg.style.maxWidth = "70%";
    svg.querySelectorAll("*").forEach(function (node) {
      var current = node.getAttribute("fill");
      if (current && current !== "none") node.setAttribute("fill", fill);
    });
    slot.replaceChildren(svg);
  }).catch(function () {
    slot.removeAttribute("data-painted");
  });
}

function paintColoredLogos(root) {
  if (!root) return;
  if (!logoObserver) {
    logoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        paintSlot(entry.target);
        logoObserver.unobserve(entry.target);
      });
    }, { rootMargin: "200px" });
  }
  Array.prototype.forEach.call(root.querySelectorAll("[data-logo]"), function (slot) {
    if (slot.getAttribute("data-painted") === "1") return;
    if (getComputedStyle(slot).display === "none") return;
    logoObserver.observe(slot);
  });
}

function hydrateLogoImages(root) {
  var row = rowLayout();
  Array.prototype.forEach.call((root || document).querySelectorAll("[data-src]"), function (slot) {
    var tile = slot.classList.contains("logo-tile");
    var featured = !!slot.closest(".featured-row");
    var want = tile ? ((row && !featured) || !!slot.closest(".is-compact")) : (!row || featured);
    if (!want || slot.querySelector("img")) return;
    var img = document.createElement("img");
    img.src = slot.getAttribute("data-src");
    img.alt = slot.getAttribute("data-alt") || "";
    img.loading = "lazy";
    img.decoding = "async";
    slot.appendChild(img);
  });
}

var CATEGORY_LABELS = {
  "github-pack": "GitHub Pack",
  ai: "AI",
  coding: "Coding tools",
  cloud: "Cloud",
  design: "Design",
  notes: "Notes & notebooks",
  learning: "Learning",
  shopping: "Shopping"
};

var verifyNames = {
  "school-email": "School email",
  "sheerid": "SheerID",
  "unidays": "UNiDAYS",
  "student-beans": "Student Beans",
  "id-upload": "ID upload",
  "github-education": "GitHub Education",
  "other": "Other"
};

function countryPhrase(country) {
  if (country === "US") return "the United States";
  if (country === "CA") return "Canada";
  return country;
}

function cardStatus(deal, country) {
  if (isBlocked(deal, country)) return "Not available in " + countryPhrase(country);
  if (deal.ca_school_email === "accepted" && deal.ca_school_email_source && deal.verification === "school-email") {
    return "Works with your school email";
  }
  return "Available in " + countryPhrase(country) + ", verified through " + (verifyNames[deal.verification] || "Other");
}

function cardStatusHtml(deal, country) {
  var text = cardStatus(deal, country);
  if (!isBlocked(deal, country)) return escapeHtml(text);
  var item = (deal.not_available_in || []).filter(function (entry) { return entry.country === country; })[0];
  if (item && typeof item.source === "string" && item.source.indexOf("https://") === 0) {
    return '<a href="' + escapeHtml(item.source) + '">' + escapeHtml(text) + "</a>";
  }
  return escapeHtml(text);
}

function logoTile(deal, options) {
  var background = safeHex(deal.banner_color) || "#F1F5F9";
  var brand = escapeHtml(deal.brand);
  var file = safeLogoFile(deal.logo);
  if (!file) {
    var letter = escapeHtml(String(deal.brand || "?").trim().charAt(0) || "?");
    return '<div class="logo-tile" style="background:' + background + '"><span class="tile-letter">' + letter + "</span></div>";
  }
  var fill = safeHex(deal.logo_color);
  if (fill) {
    return '<div class="logo-tile" style="background:' + background + '" data-logo="' + escapeHtml(file) + '" data-fill="' + fill + '" data-alt="' + brand + ' logo"></div>';
  }
  var showNow = rowLayout() && !(options && options.featured);
  if (!showNow) {
    return '<div class="logo-tile" style="background:' + background + '" data-src="logos/' + escapeHtml(file) + '" data-alt="' + brand + ' logo"></div>';
  }
  return '<div class="logo-tile" style="background:' + background + '"><img src="logos/' + escapeHtml(file) + '" alt="' + brand + ' logo" loading="lazy" decoding="async"></div>';
}

function countryLabel(code) {
  if (!code || code === "GLOBAL") return code || "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch (error) {
    return code;
  }
}

function checkedText(value) {
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "Checked " + escapeHtml(value);
  return "Checked " + months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
}

function cardHref(deal, options) {
  if (options.blocked) {
    var item = (deal.not_available_in || []).filter(function (entry) { return entry.country === options.country; })[0];
    if (item && typeof item.source === "string" && item.source.indexOf("https://") === 0) return item.source;
  }
  return "deal.html?id=" + encodeURIComponent(deal.id);
}

function eligibilityHtml(deal, options) {
  var text = "";
  var kind = "ok";
  if (options.blocked) {
    text = "Not available in " + countryLabel(options.country);
    kind = "bad";
  } else if (deal.schools && deal.schools.length && options.schoolName) {
    text = "Works with a " + options.schoolName + " email";
  } else if (options.country) {
    text = "Works in " + countryLabel(options.country);
  } else {
    return "";
  }
  return '<p class="elig ' + kind + '">' + (kind === "ok" ? '<span class="elig-mark" aria-hidden="true">✓</span> ' : "") + escapeHtml(text) + "</p>";
}

function aboutHtml(deal) {
  var text = String((deal && deal.about) || "").trim();
  if (!text) return "";
  return '<p class="about">' + escapeHtml(text) + "</p>";
}

function renderCards(target, deals, options) {
  options = options || {};
  var country = options.country || "";
  target.innerHTML = (deals || []).map(function (deal) {
    var href = cardHref(deal, options);
    var chips = country ? "" : '<div class="row">' + countryBadges(deal) + "</div>";
    var price = (options.featured || options.compact) ? "" : priceBadge(deal);
    var paid = deal.affiliate_url ? '<span class="paid">Paid link</span>' : "";
    var stamp = "Checked " + escapeHtml(deal.last_verified || "");
    var body = options.featured
      ? '<div class="meta">' + eligibilityHtml(deal, options) + '<p class="checked">' + stamp + "</p></div>"
      : options.compact
        ? '<p class="quiet">' + escapeHtml(priceLine(deal)) + " · " + stamp + "</p>"
        : chips + eligibilityHtml(deal, options) + '<p class="checked">' + checkedText(deal.last_verified) + "</p>";
    return '<a class="card' + (options.blocked ? " is-blocked" : "") + (options.featured ? " is-featured" : "") + (options.compact ? " is-compact" : "") + '" href="' + escapeHtml(href) + '">' +
      bannerHtml(deal, options) +
      '<div class="card-top">' +
        logoTile(deal, options) +
        '<div class="card-copy">' +
          '<div class="brand-line"><span class="brand">' + escapeHtml(deal.brand) + "</span>" + price + paid + "</div>" +
          "<h3>" + escapeHtml(deal.title) + "</h3>" +
          aboutHtml(deal) +
          '<div class="card-body">' + body + "</div>" +
        "</div>" +
        '<span class="chevron" aria-hidden="true">›</span>' +
      "</div>" +
    "</a>";
  }).join("");
  hydrateLogoImages(target);
  paintColoredLogos(target);
}

function hostMatches(host, schoolDomain) {
  schoolDomain = String(schoolDomain || "").toLowerCase();
  host = String(host || "").toLowerCase();
  return !!schoolDomain && (host === schoolDomain || host.endsWith("." + schoolDomain));
}

function findSchool(domain, schools) {
  if (!domain || !schools) return null;
  var host = String(domain).toLowerCase();
  for (var i = 0; i < schools.length; i++) {
    var domains = schools[i].domains || [];
    for (var j = 0; j < domains.length; j++) {
      if (hostMatches(host, domains[j])) return schools[i];
    }
  }
  return null;
}

function schoolListAllows(deal, domain) {
  if (!deal.schools || !deal.schools.length) return true;
  var host = String(domain || "").toLowerCase();
  return deal.schools.some(function (item) { return hostMatches(host, item); });
}

function fitsCountry(deal, country) {
  if (country === "CA" && deal.ca_school_email === "unknown") return false;
  var codes = deal.countries || [];
  var listed = deal.countries_scope === "global" || codes.indexOf(country) !== -1 || codes.indexOf("GLOBAL") !== -1;
  var excluded = (deal.not_available_in || []).some(function (item) { return item.country === country; });
  if (!listed || excluded) return false;
  return !(country === "CA" && deal.ca_school_email === "rejected");
}

function isBlocked(deal, country) {
  if (country === "CA" && deal.ca_school_email === "unknown") return false;
  var excluded = (deal.not_available_in || []).some(function (item) { return item.country === country; });
  if (excluded) return true;
  return country === "CA" && deal.ca_school_email === "rejected";
}

var FALLBACK_SCHOOLS = [
  { name: "Brock University", domains: ["brocku.ca"], alpha_two_code: "CA" },
  { name: "University of Toronto", domains: ["utoronto.ca", "toronto.edu"], alpha_two_code: "CA" },
  { name: "University of Waterloo", domains: ["uwaterloo.ca"], alpha_two_code: "CA" },
  { name: "York University", domains: ["yorku.ca"], alpha_two_code: "CA" },
  { name: "McMaster University", domains: ["mcmaster.ca"], alpha_two_code: "CA" },
  { name: "University of Western Ontario", domains: ["uwo.ca"], alpha_two_code: "CA" },
  { name: "Queen's University", domains: ["queensu.ca"], alpha_two_code: "CA" },
  { name: "University of British Columbia", domains: ["ubc.ca"], alpha_two_code: "CA" },
  { name: "McGill University", domains: ["mcgill.ca"], alpha_two_code: "CA" },
  { name: "Sheridan College", domains: ["sheridancollege.ca"], alpha_two_code: "CA" },
  { name: "Niagara College Canada", domains: ["niagaracollege.ca"], alpha_two_code: "CA" },
  { name: "Massachusetts Institute of Technology", domains: ["mit.edu"], alpha_two_code: "US" }
];

function loadSchools() {
  var url = "https://cdn.jsdelivr.net/gh/Hipo/university-domains-list@" + HIPO_SCHOOL_LIST_COMMIT + "/world_universities_and_domains.json";
  schoolListFromFallback = false;
  return fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error("school list unavailable");
      return response.json();
    })
    .catch(function () {
      schoolListFromFallback = true;
      return FALLBACK_SCHOOLS;
    });
}

(function () {
  var button = document.getElementById("theme");
  if (!button) return;
  if (localStorage.getItem("perkcheck-theme") === "dark") document.body.classList.add("dark");
  button.addEventListener("click", function () {
    document.body.classList.toggle("dark");
    localStorage.setItem("perkcheck-theme", document.body.classList.contains("dark") ? "dark" : "light");
    button.dataset.tip = document.body.classList.contains("dark") ? "Switch to light mode" : "Switch to dark mode";
  });
})();

var logoResizeTimer = 0;
window.addEventListener("resize", function () {
  window.clearTimeout(logoResizeTimer);
  logoResizeTimer = window.setTimeout(function () {
    hydrateLogoImages(document);
    paintColoredLogos(document);
  }, 150);
});

(function () {
  var nav = document.querySelector(".nav");
  var links = nav && nav.querySelector(".links");
  if (!nav || !links) return;

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!page || page === "index.html") {
    var home = nav.querySelector("a.logo");
    if (home) home.setAttribute("aria-current", "page");
  }
  Array.prototype.forEach.call(links.querySelectorAll("a[href]"), function (link) {
    var href = (link.getAttribute("href") || "").split("#")[0].split("?")[0];
    if (href && href === page) link.setAttribute("aria-current", "page");
  });

  var repo = nav.querySelector(".repo");
  if (repo) {
    repo.classList.add("tip");
    repo.dataset.tip = "GitHub";
  }
  var theme = document.getElementById("theme");
  if (theme) {
    theme.classList.add("tip");
    theme.dataset.tip = document.body.classList.contains("dark") ? "Switch to light mode" : "Switch to dark mode";
  }

  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  var shortcut = mac ? "⌘K" : "Ctrl K";
  var opener = document.createElement("button");
  opener.type = "button";
  opener.className = "search-open";
  opener.setAttribute("aria-label", "Search deals");
  opener.setAttribute("aria-keyshortcuts", mac ? "Meta+K" : "Control+K");
  opener.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg><span class="search-short">Search</span><span class="search-label">Search deals</span><kbd>' + shortcut + "</kbd>";
  nav.insertBefore(opener, links);

  var palette = document.createElement("div");
  palette.className = "palette";
  palette.hidden = true;
  palette.innerHTML = '<div class="palette-panel" role="dialog" aria-modal="true" aria-label="Search deals"><input class="palette-input" type="search" placeholder="Search by brand or perk" aria-autocomplete="list" aria-controls="palette-list" aria-expanded="false"><p class="palette-status" aria-live="polite"></p><ul class="palette-list" id="palette-list" role="listbox"></ul><p class="palette-hint"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> open <kbd>Esc</kbd> close</p></div>';
  document.body.appendChild(palette);

  var input = palette.querySelector(".palette-input");
  var list = palette.querySelector(".palette-list");
  var status = palette.querySelector(".palette-status");
  var items = [];
  var active = 0;
  var lastFocus = null;

  function deals() {
    return window.PERKCHECK_DEALS || [];
  }

  function go(href) {
    closePalette();
    if (href) location.href = href;
  }

  function commands() {
    return [
      { label: "Home", hint: "Email check", href: "index.html" },
      { label: "Perks", hint: "Deals for your school", href: "results.html" }
    ];
  }

  function matchingDeals(query) {
    var needle = query.toLowerCase();
    return deals().filter(function (deal) {
      var category = CATEGORY_LABELS[deal.category] || deal.category || "";
      return [deal.brand, deal.title, category, deal.id].join(" ").toLowerCase().indexOf(needle) !== -1;
    }).slice(0, 8);
  }

  function renderPalette() {
    var query = input.value.trim();
    var rows = query ? matchingDeals(query).map(function (deal) {
      return {
        label: deal.brand,
        hint: deal.title,
        href: "deal.html?id=" + encodeURIComponent(deal.id)
      };
    }) : commands();
    items = rows;
    active = 0;
    if (!rows.length) {
      list.innerHTML = "";
      status.textContent = 'No deal matches "' + query + '".';
      input.removeAttribute("aria-activedescendant");
      return;
    }
    status.textContent = query ? rows.length + (rows.length === 1 ? " matching deal" : " matching deals") : "Jump to a page, or type a deal.";
    list.innerHTML = rows.map(function (row, index) {
      return '<li role="option" id="palette-opt-' + index + '" aria-selected="' + (index === 0 ? "true" : "false") + '"><span>' + escapeHtml(row.label) + '</span><small>' + escapeHtml(row.hint) + "</small></li>";
    }).join("");
    input.setAttribute("aria-activedescendant", "palette-opt-0");
  }

  function move(step) {
    if (!items.length) return;
    active = (active + step + items.length) % items.length;
    Array.prototype.forEach.call(list.children, function (node, index) {
      node.setAttribute("aria-selected", index === active ? "true" : "false");
    });
    input.setAttribute("aria-activedescendant", "palette-opt-" + active);
    if (list.children[active]) list.children[active].scrollIntoView({ block: "nearest" });
  }

  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false;
    document.body.style.overflow = "hidden";
    input.setAttribute("aria-expanded", "true");
    renderPalette();
    input.focus();
    input.select();
  }

  function closePalette() {
    palette.hidden = true;
    document.body.style.overflow = "";
    input.setAttribute("aria-expanded", "false");
    input.value = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  opener.addEventListener("click", openPalette);
  palette.addEventListener("click", function (event) {
    if (event.target === palette) closePalette();
  });
  input.addEventListener("input", renderPalette);
  list.addEventListener("mousemove", function (event) {
    var option = event.target.closest("[role='option']");
    if (!option) return;
    move(Array.prototype.indexOf.call(list.children, option) - active);
  });
  list.addEventListener("mousedown", function (event) {
    var option = event.target.closest("[role='option']");
    if (!option) return;
    event.preventDefault();
    var index = Array.prototype.indexOf.call(list.children, option);
    if (items[index]) go(items[index].href);
  });
  document.addEventListener("keydown", function (event) {
    var key = event.key.toLowerCase();
    var command = (event.metaKey || event.ctrlKey) && key === "k";
    var slash = key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
    var typing = document.activeElement && /^(input|textarea|select)$/i.test(document.activeElement.tagName);
    if (command) {
      event.preventDefault();
      if (palette.hidden) openPalette();
      else closePalette();
      return;
    }
    if (slash && palette.hidden && !typing) {
      event.preventDefault();
      openPalette();
      return;
    }
    if (palette.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter" && items[active]) {
      event.preventDefault();
      go(items[active].href);
    }
  });
})();
