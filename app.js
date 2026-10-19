const SHORT = { month: "short", day: "numeric", timeZone: "UTC" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const gallery = document.getElementById("gallery");
const yearNav = document.getElementById("year-nav");
const lightbox = document.getElementById("lightbox");
const lbImg = lightbox.querySelector("img");
const lbCaption = lightbox.querySelector("figcaption");

let flat = []; // every photo in display order, for lightbox prev/next
let list = flat; // the photos the viewer is stepping through (all photos, or one trip)
let current = 0;

// White or black background, remembered on this device.
const toggle = document.getElementById("theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
function applyTheme(dark) {
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  toggle.ariaLabel = dark ? "Switch to white background" : "Switch to black background";
  themeColor.content = dark ? "#000000" : "#ffffff";
}
applyTheme(document.documentElement.dataset.theme === "dark");
toggle.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  applyTheme(dark);
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
});

document.getElementById("year").textContent = new Date().getFullYear();

fetch("photos/manifest.json", { cache: "no-cache" }) // always pick up newly added photos
  .then((r) => r.json())
  .then(render)
  .catch(() => { gallery.textContent = "Photos could not be loaded."; });

function el(tag, attrs = {}, children = []) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children);
  return node;
}

function render({ years, more = [], trips = [] }) {
  if (!years.length && !more.length) {
    gallery.append(el("p", { className: "empty", textContent: "New photographs are on their way." }));
    return;
  }
  for (const { year, months } of years) {
    yearNav.append(el("a", { href: `#y${year}`, textContent: year }));
    const count = months.reduce((n, m) => n + m.photos.length, 0);
    const meta = `${count} photo${count === 1 ? "" : "s"} · ${months.length} month${months.length === 1 ? "" : "s"}`;
    const section = el("section", { className: "year", id: `y${year}` }, [
      el("div", { className: "year-head" }, [el("h2", { textContent: year }), el("p", { className: "year-meta", textContent: meta })]),
    ]);

    for (const { month, title, photos } of months) {
      const label = `${MONTHS[month - 1]} ${year}`;
      const weeks = el("div", { className: "weeks" });
      for (const { week, photos: inWeek } of groupByWeek(photos)) {
        const grid = el("div", { className: "grid" });
        for (const photo of inWeek) grid.append(tile(photo, week ? `Week ${week} · ${label}` : label));
        const block = el("div", { className: "week" });
        if (week) block.append(el("h4", {}, [`Week ${week}`, el("span", { textContent: weekRange(inWeek[0].date) })]));
        block.append(grid);
        weeks.append(block);
      }
      const head = el("div", { className: "month-head" }, [el("h3", { textContent: MONTHS[month - 1] })]);
      if (title) head.append(el("p", { className: "month-title", textContent: title }));
      head.append(el("p", { className: "month-count", textContent: `${photos.length} photo${photos.length === 1 ? "" : "s"}` }));
      section.append(el("div", { className: "month", id: `y${year}-${String(month).padStart(2, "0")}` }, [head, weeks]));
    }
    gallery.append(section);
  }
  if (more.length) {
    yearNav.append(el("a", { href: "#more", textContent: "More" }));
    const grid = el("div", { className: "grid" });
    for (const photo of more) grid.append(tile(photo, "More photographs"));
    gallery.append(el("section", { className: "year", id: "more" }, [el("h2", { textContent: "More" }), grid]));
  }
  renderTrips(trips, years);
  highlightYearOnScroll();
  revealOnScroll();
  startHero(years);
}

// Wide photos cross-fade behind the name at the top of the page.
function startHero(years) {
  const all = years.flatMap((y) => y.months.flatMap((m) => m.photos));
  document.getElementById("hero-sub").textContent =
    `${all.length} favourite frames, ${years.at(-1).year} to ${years[0].year}.`;
  const wide = all.filter((p) => p.w > p.h * 1.3).sort(() => Math.random() - 0.5).slice(0, 8);
  if (!wide.length) return;
  const holder = document.getElementById("hero-slides");
  // first slide is the page's main image, so fetch it before the grid thumbnails
  const slides = wide.map((_, i) => el("img", { alt: "", decoding: "async", fetchPriority: i ? "low" : "high" }));
  holder.append(...slides);
  let i = 0;
  const on = (n) => {
    const img = slides[n];
    if (!img.getAttribute("src")) img.src = best(wide[n], true);
    const go = () => { slides.forEach((s) => s.classList.remove("on")); img.classList.add("on"); };
    img.complete ? requestAnimationFrame(go) : img.addEventListener("load", go, { once: true });
  };
  on(0);
  if (slides.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => { i = (i + 1) % slides.length; on(i); }, 6500);
  }
}

function revealOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); }
  }, { rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".grid button:not(.in)").forEach((b) => observer.observe(b));
}

const header = document.getElementById("site-header");
const hero = document.querySelector(".hero");
new IntersectionObserver(([e]) => header.classList.toggle("solid", !e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" }).observe(hero);

// The full-size file is 3000px on the long side; most screens only need the 1800px copy.
// `cover` is for the hero, where the photo fills the screen instead of fitting inside it.
function best(p, cover = false) {
  if (!p.large) return p.src;
  const fit = cover ? Math.max : Math.min;
  const ratio = p.w / p.h;
  const neededWidth = fit(innerWidth, innerHeight * ratio) * devicePixelRatio;
  const largeWidth = ratio >= 1 ? 1800 : 1800 * ratio;
  return neededWidth > largeWidth * (cover ? 2.2 : 1.15) ? p.src : p.large; // the hero is shaded, so it can be softer
}

// One clickable thumbnail that opens the full photo in the viewer.
// `items` is the list the viewer steps through from this photo.
function tile(photo, where, items = flat) {
  const index = items.push({ ...photo, label: where }) - 1;
  const ratio = photo.w / photo.h;
  const img = el("img", {
    src: photo.thumb || photo.src, alt: photo.caption || where, loading: "lazy", decoding: "async",
    width: photo.w, height: photo.h,
  });
  if (photo.small) {
    // grid rows are about 150px tall on phones and up to 360px on wide screens
    img.srcset = `${photo.small} 600w, ${photo.thumb} 1000w`;
    img.sizes = `(max-width: 760px) ${Math.ceil(ratio * 160)}px, ${Math.ceil(ratio * 360)}px`;
  }
  img.addEventListener("load", () => img.classList.add("loaded"));
  if (img.complete) img.classList.add("loaded");
  const kids = [img];
  if (photo.date) kids.push(el("span", { className: "tile-date", textContent: new Date(`${photo.date}T00:00:00Z`).toLocaleDateString("en", { ...SHORT, year: "numeric" }) }));
  const btn = el("button", { type: "button", ariaLabel: `Open ${photo.caption || where}` }, kids);
  btn.style.setProperty("--r", ratio.toFixed(4));
  if (photo.bg) btn.style.setProperty("--bgi", `linear-gradient(${photo.bg[0]}, ${photo.bg[1]})`);
  btn.addEventListener("click", () => open(index, items));
  return btn;
}

// Photos arrive newest first; consecutive photos in the same week share a block.
function groupByWeek(photos) {
  const groups = [];
  for (const photo of photos) {
    const last = groups.at(-1);
    if (last && last.week === photo.week) last.photos.push(photo);
    else groups.push({ week: photo.week, photos: [photo] });
  }
  return groups;
}

// "Aug 24 – 30" for the Monday-to-Sunday week containing the date.
function weekRange(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const monday = new Date(d - ((d.getUTCDay() + 6) % 7) * 864e5);
  const sunday = new Date(+monday + 6 * 864e5);
  const end = monday.getUTCMonth() === sunday.getUTCMonth() ? sunday.getUTCDate() : sunday.toLocaleDateString("en", SHORT);
  return `${monday.toLocaleDateString("en", SHORT)} – ${end}`;
}

function highlightYearOnScroll() {
  const links = new Map([...yearNav.children].map((a) => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.remove("active"));
        links.get(e.target.id)?.classList.add("active");
      }
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".year").forEach((s) => observer.observe(s));
}

function show(i) {
  current = (i + list.length) % list.length;
  const p = list[current];
  // show the grid copy straight away (already loaded), then swap in the sharp one
  const want = best(p);
  lbImg.src = p.thumb || want;
  const next = new Image();
  next.onload = () => { if (list[current] === p) lbImg.src = want; };
  next.src = want;
  document.getElementById("lb-count").textContent = `${current + 1} / ${list.length}`;
  lbImg.alt = p.caption || p.label;
  lbCaption.textContent = p.caption ? `${p.caption} · ${p.label}` : p.label;
  // warm the cache for the neighbours
  [current - 1, current + 1].forEach((n) => { new Image().src = best(list[(n + list.length) % list.length]); });
}

function open(i, items = flat) {
  list = items;
  show(i);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  lightbox.querySelector(".lb-close").focus();
}

function close() {
  lightbox.hidden = true;
  if (tripPage.hidden) document.body.style.overflow = "";
}

lightbox.querySelector(".lb-close").addEventListener("click", close);
lightbox.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
lightbox.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox || e.target.tagName === "FIGURE") close(); });

document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) {
    if (e.key === "Escape" && !tripPage.hidden) location.hash = "trips";
    return;
  }
  if (e.key === "Escape") close();
  if (e.key === "ArrowLeft") show(current - 1);
  if (e.key === "ArrowRight") show(current + 1);
});

let touchX = null;
lightbox.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  touchX = null;
});

// ---- Trips: a card for each trip, and a page with a map of where its photos were taken ----

const tripPage = document.getElementById("trip-page");
const tripBody = document.getElementById("trip-body");
let tripsById = new Map();

function renderTrips(trips, years) {
  if (!trips.length) return;
  const byId = new Map();
  for (const y of years) for (const m of y.months) for (const p of m.photos) byId.set(p.src.match(/_([^/]+)\.\w+$/)[1], p);
  const section = document.getElementById("trips");
  const cards = document.getElementById("trip-cards");
  const built = [];
  for (const trip of trips) {
    const places = trip.places.map((pl) => ({ ...pl, photos: pl.photos.map((id) => byId.get(id)).filter(Boolean) })).filter((pl) => pl.photos.length);
    places.sort((a, b) => Math.min(...a.photos.map((p) => Date.parse(p.date))) - Math.min(...b.photos.map((p) => Date.parse(p.date))));
    const others = (trip.photos || []).map((id) => byId.get(id)).filter(Boolean);
    const all = [...places.flatMap((pl) => pl.photos), ...others];
    if (!all.length) continue;
    const t = { ...trip, places, others, all, when: dateSpan(all) };
    tripsById.set(trip.id, t);
    const cover = (trip.cover && byId.get(trip.cover)) || all.find((p) => p.h > p.w) || all[0];
    const start = all.map((p) => p.date).filter(Boolean).sort()[0] || "";
    built.push({ start, node: el("div", { className: "trip-item" }, [
      // A stop on the timeline above the cards, oldest trip on the left.
      el("div", { className: "trip-tick" }, [el("span", { className: "trip-dot" }), el("span", { textContent: dateSpan([{ date: start }]) })]),
      el("a", { className: "trip-card", href: `#trip/${trip.id}` }, [
        el("img", { src: cover.small || cover.thumb, alt: "", loading: "lazy", decoding: "async" }),
        el("div", { className: "trip-card-text" }, [
          el("h3", {}, [flag(trip), trip.name]),
          el("p", { textContent: `${t.when} · ${all.length} photos` }),
        ]),
      ]),
    ]) });
  }
  built.sort((a, b) => a.start.localeCompare(b.start));
  cards.append(...built.map((b) => b.node));
  if (!tripsById.size) return;
  section.hidden = false;
  yearNav.prepend(el("a", { href: "#trips", textContent: "Trips" }));
  route();
}

// The trip's country flag (vendor/flags), shown before its name.
function flag(trip) {
  return trip.country ? el("img", { className: "flag", src: `vendor/flags/${trip.country}.svg`, alt: "" }) : "";
}

// "Aug – Sep 2026", "Jul 2024" or "Dec 2025 – Jan 2026"
function dateSpan(photos) {
  const dates = photos.map((p) => p.date).filter(Boolean).sort();
  if (!dates.length) return "";
  const fmt = (d, opts) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { timeZone: "UTC", ...opts });
  const [a, b] = [dates[0], dates.at(-1)];
  if (a.slice(0, 7) === b.slice(0, 7)) return fmt(a, { month: "short", year: "numeric" });
  if (a.slice(0, 4) === b.slice(0, 4)) return `${fmt(a, { month: "short" })} – ${fmt(b, { month: "short", year: "numeric" })}`;
  return `${fmt(a, { month: "short", year: "numeric" })} – ${fmt(b, { month: "short", year: "numeric" })}`;
}

function route() {
  const m = location.hash.match(/^#trip\/([\w-]+)/);
  const trip = m && tripsById.get(m[1]);
  if (trip) openTrip(trip);
  else if (!tripPage.hidden) closeTrip();
}
addEventListener("hashchange", route);

function openTrip(trip) {
  const items = [];
  const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");
  const sections = trip.places.map((pl, i) => {
    const grid = el("div", { className: "grid" });
    for (const p of [...pl.photos].sort(byDate)) grid.append(tile(p, `${pl.name} · ${trip.name}`, items));
    const count = `${pl.photos.length} photo${pl.photos.length === 1 ? "" : "s"}`;
    return el("section", { className: "place", id: `place-${i}` }, [el("h3", {}, [pl.name, el("span", { textContent: count })]), grid]);
  });
  if (trip.others.length) {
    const grid = el("div", { className: "grid" });
    for (const p of [...trip.others].sort(byDate)) grid.append(tile(p, trip.name, items));
    sections.push(el("section", { className: "place" }, [el("h3", { textContent: "More from the trip" }), grid]));
  }
  const map = el("div", { className: "trip-map", id: "trip-map" });
  tripBody.replaceChildren(
    el("div", { className: "trip-title" }, [
      el("h1", {}, [flag(trip), trip.name]),
      el("p", { textContent: `${trip.when} · ${trip.all.length} photos · ${trip.places.length} ${trip.places.length === 1 ? "place" : "places"}` }),
    ]),
    map,
    ...sections,
  );
  document.getElementById("trip-bar-name").textContent = trip.name;
  tripPage.hidden = false;
  tripPage.scrollTop = 0;
  document.body.style.overflow = "hidden";
  tripPage.querySelectorAll(".grid button").forEach((b) => b.classList.add("in"));
  document.title = `${trip.name} · Edward Khouy-Ly`;
  drawMap(map, trip);
}

function closeTrip() {
  tripPage.hidden = true;
  tripBody.replaceChildren();
  document.body.style.overflow = "";
  document.title = "Edward Khouy-Ly · Photographs";
}

tripPage.addEventListener("scroll", () => tripPage.classList.toggle("scrolled", tripPage.scrollTop > 160), { passive: true });

// Leaflet is only fetched the first time someone opens a trip.
let leaflet;
function loadLeaflet() {
  leaflet ??= new Promise((resolve, reject) => {
    const base = "vendor/leaflet/"; // Leaflet 1.9.4, kept in the repo
    document.head.append(el("link", { rel: "stylesheet", href: `${base}leaflet.css` }));
    const script = el("script", { src: `${base}leaflet.js` });
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.append(script);
  });
  return leaflet;
}

async function drawMap(node, trip) {
  let L;
  try { L = await loadLeaflet(); } catch { node.remove(); return; }
  if (!node.isConnected) return;
  const map = L.map(node, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  const points = trip.places.map((pl, i) => {
    const cover = pl.photos[0];
    const icon = L.divIcon({
      className: "",
      html: `<div class="pin" style="background-image:url('${cover.small || cover.thumb}')"><span>${pl.photos.length}</span></div>`,
      iconSize: [52, 52], iconAnchor: [26, 26],
    });
    L.marker([pl.lat, pl.lng], { icon, title: pl.name, keyboard: true })
      .bindTooltip(pl.name, { className: "pin-label", direction: "top", offset: [0, -30] })
      .on("click", () => {
        const target = document.getElementById(`place-${i}`);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 1400);
      })
      .addTo(map);
    return [pl.lat, pl.lng];
  });
  if (points.length === 1) map.setView(points[0], 13);
  else map.fitBounds(points, { padding: [60, 60], maxZoom: 13 });
}
