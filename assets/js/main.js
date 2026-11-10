/* Nectar Flo Studio — інтерактивність і рух. Без залежностей, без збору даних. */
(function () {
  "use strict";

  var D = window.NECTAR || {};
  var C = D.contacts || {};
  var SHOW_PRICES = !!(D.settings && D.settings.showPrices);
  var PHOTO = "assets/photos/";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function photo(src) { return (window.NF_IMG && window.NF_IMG[src]) || PHOTO + src; }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

  if (SHOW_PRICES) document.documentElement.classList.remove("no-prices");

  /* ---------- контакти, адреса, реквізити ---------- */
  $$("[data-contact]").forEach(function (a) { var k = a.getAttribute("data-contact"); if (C[k]) a.href = C[k]; });
  if (C.address) {
    var addr = $("[data-address]"); if (addr) addr.textContent = "Студія знаходиться за адресою: " + C.address + ".";
    var fa = $("[data-address-footer]"); if (fa) { fa.textContent = C.address; fa.hidden = false; }
  }
  var links = $("[data-footer-links]");
  if (links) {
    if (C.telegram) links.appendChild(el("li", null, '<a href="' + esc(C.telegram) + '" target="_blank" rel="noopener">Telegram</a>'));
    if (C.phone) links.appendChild(el("li", null, '<a href="tel:' + esc(C.phone.replace(/\s/g, "")) + '">' + esc(C.phone) + "</a>"));
  }
  var S = D.seller || {};
  var sellerBox = $("[data-seller]");
  if (sellerBox && S.name) {
    var rows = [S.name, S.code ? "РНОКПП / ЄДРПОУ: " + S.code : null, S.address, S.email].filter(Boolean);
    sellerBox.innerHTML = "<p>" + rows.map(esc).join("<br>") + "</p>";
    sellerBox.hidden = false;
  }
  var yr = $("[data-year]"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- «завіси» для фото: обгортка + шторка ---------- */
  $$(".img-rv").forEach(function (fig) {
    var img = fig.querySelector("img");
    if (!img || img.parentNode.classList.contains("img-clip")) return;
    var clip = el("div", { class: "img-clip" });
    img.parentNode.insertBefore(clip, img);
    clip.appendChild(img);
    clip.appendChild(el("span", { class: "curtain", "aria-hidden": "true" }));
  });

  /* ---------- біжучий рядок ---------- */
  var mtrack = $(".marq__track");
  if (mtrack && !reduceMotion) $$(":scope > *", mtrack).forEach(function (n) { mtrack.appendChild(n.cloneNode(true)); });

  /* ---------- каталог робіт ---------- */
  var grid = $("[data-grid]");
  var items = D.items || [];
  // журнальна сітка: ширина (з 12 колонок), пропорції фото, зсув униз
  var LAYOUT = [
    { span: 7, ar: "3 / 4" }, { span: 5, ar: "4 / 5", end: true }, { span: 4, ar: "3 / 4" }, { span: 4, ar: "3 / 4", down: true },
    { span: 4, ar: "3 / 4" }, { span: 5, ar: "4 / 5" }, { span: 7, ar: "16 / 10", end: true }, { span: 5, ar: "4 / 5", start: 4 },
  ];
  function imgTag(im, cls, lazy) {
    return "<img" + (cls ? ' class="' + cls + '"' : "") + ' src="' + esc(photo(im.src)) + '" width="' + im.w + '" height="' + im.h + '"' +
      (lazy ? ' loading="lazy"' : "") + ' alt="' + (cls ? "" : esc(im.alt)) + '"' + (im.pos ? ' style="object-position:' + esc(im.pos) + '"' : "") + ">";
  }
  function cardHTML(it) {
    var imgs = it.layout === "feature" ? it.images.slice(0, 2) : it.images.slice(0, 1);
    var media = imgs.map(function (im) { return imgTag(im, null, true); }).join("");
    if (it.layout !== "feature" && it.images.length > 1) media += imgTag(it.images[1], "card__alt", true);
    return '<button class="card__btn" type="button" data-open="' + esc(it.id) + '" aria-haspopup="dialog">' +
      '<span class="card__media">' + media + "</span>" +
      '<span class="card__info">' +
        '<span class="card__no">' + esc(it.no) + "</span>" +
        '<span class="card__title">' + esc(cap(it.title)) + "</span>" +
        '<span class="card__status' + (it.statusTone === "live" ? " is-live" : "") + '">' + esc(it.status || "") + "</span>" +
        '<span class="card__lead">' + esc(it.lead) + (SHOW_PRICES && it.price ? " · " + esc(it.price) : "") + "</span>" +
      "</span></button>";
  }
  if (grid && items.length) {
    grid.innerHTML = "";
    items.forEach(function (it, i) {
      var L = LAYOUT[i % LAYOUT.length];
      var card = el("article", { class: "card" + (it.layout === "feature" ? " card--feature" : "") + (L.down ? " is-down" : ""), "data-cat": it.category, "aria-label": cap(it.title) }, cardHTML(it));
      card.style.setProperty("--span", L.span);
      card.style.setProperty("--ar", L.ar);
      if (L.end) card.style.alignSelf = "end";
      if (L.start) card.style.gridColumnStart = L.start;
      grid.appendChild(card);
    });
  }
  var tabsBox = $("[data-filters]");
  if (tabsBox && D.filters) {
    D.filters.forEach(function (f, i) {
      var n = f.id === "all" ? items.length : items.filter(function (it) { return it.category === f.id; }).length;
      if (!n) return;
      tabsBox.appendChild(el("button", { class: "tab", type: "button", "aria-pressed": i === 0 ? "true" : "false", "data-filter": f.id }, esc(cap(f.label)) + "<sup>" + n + "</sup>"));
    });
    tabsBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]"); if (!b) return;
      var id = b.getAttribute("data-filter");
      $$(".tab", tabsBox).forEach(function (t) { t.setAttribute("aria-pressed", t === b ? "true" : "false"); });
      $$(".card", grid).forEach(function (card) {
        var show = id === "all" || card.getAttribute("data-cat") === id;
        card.hidden = !show;
        card.style.gridColumnStart = id === "all" ? (LAYOUT[$$(".card", grid).indexOf(card) % LAYOUT.length].start || "") : "";
        if (show) card.classList.add("is-in");
      });
    });
  }

  /* ---------- детальна картка ---------- */
  var sheet = $("[data-sheet]");
  var lastTrigger = null;
  var copyStatus = $("[data-copy-status]");
  function copyText(text, field) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) { try { field.select(); document.execCommand("copy") ? res() : rej(); } catch (err) { rej(err); } });
  }
  function openSheet(id) {
    var it = items.filter(function (x) { return x.id === id; })[0];
    if (!it || !sheet) return;
    $("[data-sheet-media]", sheet).innerHTML = it.images.map(function (im) { return imgTag(im, null, false); }).join("");
    $("[data-sheet-meta]", sheet).textContent = it.no + " · " + (it.status || "") + " · " + (it.posted || "");
    $("[data-sheet-title]", sheet).textContent = cap(it.title);
    $("[data-sheet-lead]", sheet).textContent = it.lead;
    var rows = it.bullets || (SHOW_PRICES ? it.prices : null) || [];
    $("[data-sheet-list]", sheet).innerHTML = rows.map(function (r) { return "<li>" + esc(cap(r)) + "</li>"; }).join("");
    var pr = $("[data-sheet-price]", sheet);
    if (!SHOW_PRICES) pr.innerHTML = "Вартість — у Direct<small>залежить від сезонних квітів і розміру</small>";
    else pr.innerHTML = (it.prices ? "" : esc(it.price || "Вартість — за запитом")) + (it.priceNote ? "<small>" + esc(it.priceNote) + ", актуальну уточнюйте в Direct</small>" : "");
    $("[data-sheet-msg]", sheet).value = it.message || "Привіт! Хочу замовити: " + it.title + ".";
    $("[data-sheet-cta]", sheet).firstChild.nodeValue = (it.cta || "Написати в Direct") + " ";
    copyStatus.textContent = "";
    if (typeof sheet.showModal === "function") sheet.showModal(); else sheet.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    sheet.scrollTop = 0;
  }
  function closeSheet() { if (sheet.open && sheet.close) sheet.close(); else sheet.removeAttribute("open"); }
  if (grid) grid.addEventListener("click", function (e) { var b = e.target.closest("[data-open]"); if (!b) return; lastTrigger = b; openSheet(b.getAttribute("data-open")); });
  if (sheet) {
    $("[data-sheet-close]", sheet).addEventListener("click", closeSheet);
    sheet.addEventListener("close", function () { document.body.style.overflow = ""; if (lastTrigger) lastTrigger.focus(); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) closeSheet(); });
    var sheetMsg = $("[data-sheet-msg]", sheet);
    var ok = function () { copyStatus.textContent = "Текст скопійовано — вставте його в Direct."; };
    $("[data-copy]", sheet).addEventListener("click", function () { copyText(sheetMsg.value, sheetMsg).then(ok, function () { copyStatus.textContent = "Не вдалося скопіювати — виділіть текст вручну."; }); });
    $("[data-sheet-cta]", sheet).addEventListener("click", function () { copyText(sheetMsg.value, sheetMsg).then(ok, function () {}); });
  }

  /* ---------- з життя студії ---------- */
  var rail = $("[data-stories]");
  var stories = D.stories || [];
  if (rail && stories.length) {
    rail.innerHTML = stories.map(function (s, i) {
      var url = "https://www.instagram.com/nectar.flostudio/reel/" + encodeURIComponent(s.id) + "/";
      return '<li class="story" style="--d:' + (i % 6) + '"><a class="story__link" href="' + url + '" target="_blank" rel="noopener">' +
        '<span class="story__img"><img src="' + esc(photo("reels/" + s.id + ".jpg")) + '" width="360" height="640" loading="lazy" alt="' + esc(s.alt) + '"><span class="story__play" aria-hidden="true"></span></span>' +
        '<span class="story__meta">' + String(i + 1).padStart(2, "0") + (s.date ? " — " + esc(s.date) : "") + " · Reels</span>" +
        '<span class="story__title">' + esc(cap(s.title)) + '</span><span class="story__text">' + esc(cap(s.text)) + "</span></a></li>";
    }).join("");
    var step = function (dir) { var c = $(".story", rail); rail.scrollBy({ left: dir * ((c ? c.getBoundingClientRect().width : 260) + 20) * 2, behavior: reduceMotion ? "auto" : "smooth" }); };
    $("[data-stories-prev]").addEventListener("click", function () { step(-1); });
    $("[data-stories-next]").addEventListener("click", function () { step(1); });
    if (finePointer) {
      var down = false, sx = 0, sl = 0, moved = false;
      rail.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add("is-drag"); });
      window.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; rail.scrollLeft = sl - dx; });
      window.addEventListener("pointerup", function () { down = false; rail.classList.remove("is-drag"); });
      rail.addEventListener("click", function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
      rail.addEventListener("dragstart", function (e) { e.preventDefault(); });
    }
  }

  /* ---------- підписка ---------- */
  var plans = $("[data-plans]");
  var SUB = D.subscription;
  var SIZE_NAME = { S: ["Компактний", "для столу чи полиці"], M: ["Середній", "для дому й ресепшн"], L: ["Великий", "для залу чи вітрини"] };
  function renderPlans(freq, animate) {
    if (!plans || !SUB) return;
    plans.innerHTML = SUB.sizes.map(function (p) {
      var nm = SIZE_NAME[p.size] || [p.size, ""];
      var right = SHOW_PRICES ? (freq === "4" ? p.per4 : p.per2) + " грн<small>на місяць</small>" : freq + " букети<small>на місяць</small>";
      return '<li class="plan"><span class="plan__size">' + esc(p.size) + '</span><span class="plan__name">' + esc(nm[0]) + "<small>" + esc(nm[1]) + '</small></span><span class="plan__price' + (animate ? " is-swap" : "") + '">' + right + "</span></li>";
    }).join("");
  }
  renderPlans("2", false);
  var subNote = $("[data-sub-note]");
  if (subNote) subNote.textContent = SHOW_PRICES && SUB ? "Ціни з допису від " + SUB.posted + ". Актуальні — у Direct." : "Вартість і склад букетів підписки — у Direct.";
  $$("[data-freq] input").forEach(function (r) { r.addEventListener("change", function () { renderPlans(r.value, !reduceMotion); }); });

  /* ---------- букет під привід ---------- */
  var CP = D.composer;
  var composer = $("[data-composer]");
  if (composer && CP) {
    var state = { occasion: null, mood: null, format: CP.formats[0], date: "" };
    var msg = $("[data-composer-msg]", composer), status = $("[data-composer-status]", composer), touched = false;
    var opt = function (name, value, label, checked, extra) {
      return '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(value) + '"' + (checked ? " checked" : "") + "><span>" + (extra || "") + esc(cap(label)) + "</span></label>";
    };
    $("[data-occasions]", composer).innerHTML = CP.occasions.map(function (o) { return opt("occasion", o, o, false); }).join("");
    $("[data-formats]", composer).innerHTML = CP.formats.map(function (f, i) { return opt("format", f, f, i === 0); }).join("");
    $("[data-moods]", composer).innerHTML = CP.moods.map(function (m) {
      var sw = '<span class="opt__sw" aria-hidden="true">' + m.colors.map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join("") + "</span>";
      return opt("mood", m.id, m.label, false, sw);
    }).join("");
    var build = function () {
      var mood = CP.moods.filter(function (m) { return m.id === state.mood; })[0];
      var first = "Привіт! Хочу замовити " + state.format + (state.occasion ? " — привід: " + state.occasion : "") + ".";
      var parts = [first];
      if (mood) parts.push(mood.id === "any" ? "Кольори — на ваш смак." : "Настрій і кольори: " + mood.label + ".");
      if (state.date) parts.push("Дата: " + new Date(state.date + "T12:00:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long" }) + ".");
      parts.push("Бюджет: … ");
      return parts.join("\n");
    };
    var update = function () { if (!touched) msg.value = build(); status.textContent = ""; };
    composer.addEventListener("change", function (e) {
      var t = e.target;
      if (t.name === "occasion") state.occasion = t.value;
      if (t.name === "mood") state.mood = t.value;
      if (t.name === "format") state.format = t.value;
      if (t.hasAttribute && t.hasAttribute("data-date")) state.date = t.value;
      if (t !== msg) { touched = false; update(); }
    });
    msg.addEventListener("input", function () { touched = true; });
    update();
    var cOk = function () { status.textContent = "Текст скопійовано — вставте його в Direct."; };
    $("[data-composer-copy]", composer).addEventListener("click", function () { copyText(msg.value, msg).then(cOk, function () { status.textContent = "Не вдалося скопіювати — виділіть текст вручну."; }); });
    $("[data-composer-go]", composer).addEventListener("click", function () { copyText(msg.value, msg).then(cOk, function () {}); });
  }

  /* ---------- меню ---------- */
  var menu = $("[data-menu]"), openBtn = $("[data-menu-open]");
  function openMenu() { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add("is-open"); }); openBtn.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; $("[data-menu-close]").focus(); }
  function closeMenu(ret) { menu.classList.remove("is-open"); menu.hidden = true; openBtn.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; if (ret) openBtn.focus(); }
  openBtn.addEventListener("click", openMenu);
  $("[data-menu-close]").addEventListener("click", function () { closeMenu(true); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { closeMenu(false); }); });
  menu.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu(true);
    if (e.key === "Tab") { var f = $$("a, button", menu), a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });

  /* ---------- активний пункт меню ---------- */
  var navLinks = $$(".nav__list a");
  if ("IntersectionObserver" in window && navLinks.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) navLinks.forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("href") === "#" + e.target.id ? "true" : "false"); }); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) { var t = document.getElementById(a.getAttribute("href").slice(1)); if (t) navIO.observe(t); });
  }

  /* ---------- поява при прокручуванні ---------- */
  var lnParents = [];
  $$(".ln").forEach(function (l) { var p = l.parentElement; if (lnParents.indexOf(p) < 0) lnParents.push(p); });
  var toReveal = lnParents.concat($$(".rv, .img-rv, .card, .story"));
  if (!("IntersectionObserver" in window) || reduceMotion) toReveal.forEach(function (n) { n.classList.add("is-in"); });
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = e.target;
        if (n.classList.contains("card")) n.style.transitionDelay = ($$(".card:not([hidden])", grid).indexOf(n) % 2) * 120 + "ms";
        n.classList.add("is-in");
        io.unobserve(n);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });
    toReveal.forEach(function (n) { io.observe(n); });
  }

  /* ---------- шапка, масштаб «nectar», паралакс, плаваюча кнопка ---------- */
  var header = $("[data-header]"), dock = $("[data-dock]"), mast = $("[data-mast]"), hero = $(".hero");
  var mastLetters = mast ? $$(":scope > span", mast) : [];
  // слово «nectar» займає рівно ширину сітки: міряємо при 100px і масштабуємо
  function fitMast() {
    if (!mast) return;
    var box = mast.parentElement.getBoundingClientRect().width;
    mast.style.setProperty("--mast", "100px");
    var w = mast.getBoundingClientRect().width;
    if (!w) return;
    var size = Math.min(900, (100 * box / w) * 0.995).toFixed(2) + "px";
    mast.style.setProperty("--mast", size);
    var ftw = document.querySelector(".ft__word"); // той самий розмір у підвалі
    if (ftw) ftw.style.fontSize = size;
  }
  fitMast();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMast);
  window.addEventListener("resize", fitMast);
  var K = [0.10, 0.17, 0.07, 0.21, 0.12, 0.16];
  var par = reduceMotion ? [] : $$("[data-speed]");
  if (mast && !reduceMotion) setTimeout(function () { mast.classList.add("is-ready"); }, 1900);
  else if (mast) mast.classList.add("is-ready");

  function frame() {
    var y = window.scrollY, vh = window.innerHeight;
    header.classList.toggle("is-solid", y > 10);
    if (mast) header.classList.toggle("is-compact", mast.getBoundingClientRect().bottom < 70);
    if (mast && !reduceMotion && mast.classList.contains("is-ready") && y < vh * 1.5) {
      mastLetters.forEach(function (s, i) { s.style.setProperty("--py", (-y * K[i]).toFixed(1) + "px"); });
    }
    par.forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var d = (r.top + r.height / 2 - vh / 2) * Number(n.getAttribute("data-speed"));
      n.style.transform = "translate3d(0," + d.toFixed(1) + "px,0)";
    });
    if (dock && hero) {
      var bk = document.getElementById("booking"), inBooking = false;
      if (bk) { var br = bk.getBoundingClientRect(); inBooking = br.top < vh * 0.7 && br.bottom > vh * 0.3; }
      var nearEnd = vh + y > document.body.scrollHeight - 500;
      dock.classList.toggle("is-on", y > hero.offsetHeight * 0.7 && !inBooking && !nearEnd);
    }
  }
  var ticking = false;
  window.addEventListener("scroll", function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { frame(); ticking = false; }); }, { passive: true });
  window.addEventListener("resize", frame);
  frame();

  /* ---------- хроніка: горизонтальна стрічка від вертикального скролу ---------- */
  var chron = $("[data-chron]");
  if (chron) {
    var ctrack = $("[data-chron-track]", chron), cbar = $("[data-chron-bar]", chron);
    var pinMQ = window.matchMedia("(min-width: 1024px)"), dist = 0;
    var chronTick = function () {
      if (!chron.classList.contains("is-pinned")) return;
      var p = Math.min(1, Math.max(0, -chron.getBoundingClientRect().top / (dist || 1)));
      ctrack.style.transform = "translate3d(" + (-p * dist).toFixed(1) + "px,0,0)";
      if (cbar) cbar.style.transform = "scaleX(" + p.toFixed(3) + ")";
    };
    var chronLayout = function () {
      var pinned = pinMQ.matches && !reduceMotion;
      chron.classList.toggle("is-pinned", pinned);
      if (!pinned) { chron.style.height = ""; ctrack.style.transform = ""; return; }
      dist = Math.max(0, ctrack.scrollWidth - window.innerWidth);
      chron.style.height = (window.innerHeight + dist) + "px";
      chronTick();
    };
    var cRaf = false;
    window.addEventListener("scroll", function () { if (cRaf) return; cRaf = true; requestAnimationFrame(function () { chronTick(); cRaf = false; }); }, { passive: true });
    window.addEventListener("resize", chronLayout);
    window.addEventListener("load", chronLayout);
    chronLayout();
    ctrack.addEventListener("scroll", function () {
      if (chron.classList.contains("is-pinned")) return;
      var max = ctrack.scrollWidth - ctrack.clientWidth;
      if (cbar) cbar.style.transform = "scaleX(" + (max ? ctrack.scrollLeft / max : 0).toFixed(3) + ")";
    }, { passive: true });
  }

  /* ---------- курсор «Дивитись» над роботами ---------- */
  var cursor = $("[data-cursor]");
  if (cursor && finePointer && !reduceMotion) {
    var cx = -200, cy = -200, raf = null;
    document.addEventListener("pointermove", function (e) {
      cx = e.clientX; cy = e.clientY;
      if (!raf) raf = requestAnimationFrame(function () { cursor.style.setProperty("--x", cx + "px"); cursor.style.setProperty("--y", cy + "px"); raf = null; });
      var over = e.target.closest && e.target.closest(".card__media");
      if (over && !cursor.classList.contains("is-on")) { cursor.classList.add("is-on"); setTimeout(function () { if (cursor.classList.contains("is-on")) cursor.classList.add("is-fast"); }, 400); }
      else if (!over && cursor.classList.contains("is-on")) cursor.classList.remove("is-on", "is-fast");
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { cursor.classList.remove("is-on", "is-fast"); });
  }
})();
