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

function renderCards(target, deals) {
  target.innerHTML = deals.map(function (deal) {
    var paid = deal.affiliate_url ? '<span class="paid">Paid link</span>' : "";
    return '<article class="card">' +
      '<div class="brand">' + escapeHtml(deal.brand) + "</div>" +
      "<h3>" + escapeHtml(deal.title) + "</h3>" +
      '<div class="row">' + countryBadges(deal) + priceBadge(deal) + "</div>" +
      '<div class="row"><span class="badge chip">Checked ' + formatDate(deal.last_verified) + "</span></div>" +
      '<p class="note">' + escapeHtml(deal.email_rules || "") + "</p>" +
      '<div class="foot"><a class="btn" href="deal.html?id=' + encodeURIComponent(deal.id) + '">See deal</a>' + paid + "</div>" +
    "</article>";
  }).join("");
}

function findSchool(domain, schools) {
  if (!domain) return null;
  var host = domain.toLowerCase();
  for (var i = 0; i < schools.length; i++) {
    var domains = schools[i].domains || [];
    for (var j = 0; j < domains.length; j++) {
      var schoolDomain = String(domains[j]).toLowerCase();
      if (host === schoolDomain || host.endsWith("." + schoolDomain)) return schools[i];
    }
  }
  return null;
}

function fitsCountry(deal, country) {
  return (deal.countries || []).indexOf(country) !== -1 && !(country === "CA" && deal.ca_school_email === "rejected");
}

function isBlocked(deal, country) {
  var excluded = (deal.not_available_in || []).some(function (item) { return item.country === country; });
  if (excluded) return true;
  return country === "CA" && deal.ca_school_email === "rejected";
}

var FALLBACK_SCHOOLS = [
  { name: "Brock University", domains: ["brocku.ca"], alpha_two_code: "CA" },
  { name: "University of Toronto", domains: ["utoronto.ca"], alpha_two_code: "CA" },
  { name: "University of Waterloo", domains: ["uwaterloo.ca"], alpha_two_code: "CA" },
  { name: "Massachusetts Institute of Technology", domains: ["mit.edu"], alpha_two_code: "US" }
];

function loadSchools() {
  return fetch("https://cdn.jsdelivr.net/gh/Hipo/university-domains-list@master/world_universities_and_domains.json")
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
