const SHORT = { month: "short", day: "numeric", timeZone: "UTC" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const gallery = document.getElementById("gallery");
const yearNav = document.getElementById("year-nav");
const lightbox = document.getElementById("lightbox");
const lbImg = lightbox.querySelector("img");
const lbCaption = lightbox.querySelector("figcaption");

let flat = []; // every photo in display order, for lightbox prev/next
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

function render({ years, more = [] }) {
  if (!years.length && !more.length) {
    gallery.append(el("p", { className: "empty", textContent: "New photographs are on their way." }));
    return;
  }
  for (const { year, months } of years) {
    yearNav.append(el("a", { href: `#y${year}`, textContent: year }));
    const section = el("section", { className: "year", id: `y${year}` }, [el("h2", { textContent: year })]);

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
  const slides = wide.map(() => el("img", { alt: "", decoding: "async" }));
  holder.append(...slides);
  let i = 0;
  const on = (n) => {
    const img = slides[n];
    if (!img.getAttribute("src")) img.src = wide[n].src;
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
  document.querySelectorAll(".grid button").forEach((b) => observer.observe(b));
}

const header = document.getElementById("site-header");
const hero = document.querySelector(".hero");
new IntersectionObserver(([e]) => header.classList.toggle("solid", !e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" }).observe(hero);

// One clickable thumbnail that opens the full photo in the viewer.
function tile(photo, where) {
  const index = flat.push({ ...photo, label: where }) - 1;
  const img = el("img", {
    src: photo.thumb || photo.src, alt: photo.caption || where, loading: "lazy", decoding: "async",
    width: photo.w, height: photo.h,
  });
  img.addEventListener("load", () => img.classList.add("loaded"));
  if (img.complete) img.classList.add("loaded");
  const btn = el("button", { type: "button", ariaLabel: `Open ${photo.caption || where}` }, [img]);
  btn.addEventListener("click", () => open(index));
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
  current = (i + flat.length) % flat.length;
  const p = flat[current];
  lbImg.classList.add("swap");
  const next = new Image();
  next.onload = () => { lbImg.src = p.src; lbImg.classList.remove("swap"); };
  next.src = p.src;
  document.getElementById("lb-count").textContent = `${current + 1} / ${flat.length}`;
  lbImg.alt = p.caption || p.label;
  lbCaption.textContent = p.caption ? `${p.caption} · ${p.label}` : p.label;
  // warm the cache for the neighbours
  [current - 1, current + 1].forEach((n) => { new Image().src = flat[(n + flat.length) % flat.length].src; });
}

function open(i) {
  show(i);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  lightbox.querySelector(".lb-close").focus();
}

function close() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

lightbox.querySelector(".lb-close").addEventListener("click", close);
lightbox.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
lightbox.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox || e.target.tagName === "FIGURE") close(); });

document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
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
