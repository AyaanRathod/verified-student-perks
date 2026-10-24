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
    return '<span class="badge ok">' + code + "</span>";
  }).join("");
  (deal.not_available_in || []).forEach(function (item) {
    html += '<span class="badge no">Not in ' + item.country + "</span>";
  });
  return html;
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

function bannerHtml(deal) {
  var background = safeHex(deal.banner_color) || "#F1F5F9";
  var brand = escapeHtml(deal.brand);
  var file = safeLogoFile(deal.logo);
  if (!file) {
    return '<div class="card-banner" style="background:' + background + '"><span class="banner-name">' + brand + "</span></div>";
  }
  var fill = safeHex(deal.logo_color);
  if (fill) {
    return '<div class="card-banner logo" style="background:' + background + '" data-logo="' + escapeHtml(file) + '" data-fill="' + fill + '" data-alt="' + brand + ' logo"></div>';
  }
  return '<div class="card-banner logo" style="background:' + background + '"><img src="logos/' + escapeHtml(file) + '" alt="' + brand + ' logo"></div>';
}

function paintColoredLogos(root) {
  if (!root) return;
  Array.prototype.forEach.call(root.querySelectorAll(".card-banner[data-logo]"), function (slot) {
    var file = slot.getAttribute("data-logo");
    var fill = slot.getAttribute("data-fill");
    if (!safeLogoFile(file) || !safeHex(fill)) return;
    fetch("logos/" + file).then(function (response) {
      if (!response.ok) throw new Error("logo");
      return response.text();
    }).then(function (text) {
      var parsed = new DOMParser().parseFromString(text, "image/svg+xml");
      var svg = parsed.querySelector("svg");
      if (!svg || parsed.querySelector("parsererror")) return;
      parsed.querySelectorAll("script").forEach(function (node) { node.remove(); });
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", slot.getAttribute("data-alt") || "");
      svg.setAttribute("fill", fill);
      svg.style.color = fill;
      svg.style.height = slot.closest(".deal") ? "96px" : "64px";
      svg.style.width = "auto";
      svg.style.maxWidth = "70%";
      svg.querySelectorAll("*").forEach(function (node) {
        var current = node.getAttribute("fill");
        if (current && current !== "none") node.setAttribute("fill", fill);
      });
      slot.replaceChildren(svg);
    }).catch(function () {});
  });
}

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

function renderCards(target, deals, country) {
  target.innerHTML = deals.map(function (deal) {
    var paid = deal.affiliate_url ? '<span class="paid">Paid link</span>' : "";
    var status = country ? '<p class="status">' + cardStatusHtml(deal, country) + "</p>" : "";
    var href = "deal.html?id=" + encodeURIComponent(deal.id) + (country ? "&country=" + encodeURIComponent(country) : "");
    return '<article class="card">' +
      bannerHtml(deal) +
      '<div class="brand">' + escapeHtml(deal.brand) + "</div>" +
      "<h3>" + escapeHtml(deal.title) + "</h3>" +
      '<div class="row">' + countryBadges(deal) + priceBadge(deal) + "</div>" +
      '<div class="row"><span class="badge chip">Checked ' + formatDate(deal.last_verified) + "</span></div>" +
      status +
      '<p class="note">' + escapeHtml(deal.email_rules || "") + "</p>" +
      '<div class="foot"><a class="btn" href="' + href + '">See deal</a>' + paid + "</div>" +
    "</article>";
  }).join("");
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
  return (deal.countries || []).indexOf(country) !== -1 && !(country === "CA" && deal.ca_school_email === "rejected");
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
  return fetch("https://cdn.jsdelivr.net/gh/Hipo/university-domains-list@603e10f51b67c6553b9bca9aecc0db4c2417ed10/world_universities_and_domains.json")
    .then(function (response) {
      if (!response.ok) throw new Error("school list unavailable");
      return response.json();
    })
    .catch(function () { return FALLBACK_SCHOOLS; });
}

(function () {
  var button = document.getElementById("theme");
  if (!button) return;
  if (localStorage.getItem("perkcheck-theme") === "dark") document.body.classList.add("dark");
  button.addEventListener("click", function () {
    document.body.classList.toggle("dark");
    localStorage.setItem("perkcheck-theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
})();
