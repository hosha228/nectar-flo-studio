/* Nectar Flo Studio — інтерактивність. Без залежностей і без збору даних. */
(function () {
  "use strict";

  var D = window.NECTAR || {};
  var C = D.contacts || {};
  var SET = D.settings || {};
  var SHOW_PRICES = !!SET.showPrices;
  var PHOTO = "assets/photos/";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function photo(src) { return (window.NF_IMG && window.NF_IMG[src]) || PHOTO + src; }

  if (SHOW_PRICES) document.documentElement.classList.remove("no-prices");

  /* ---------- інтро: раз за сесію ---------- */
  var intro = $("[data-intro]");
  var introDelay = 0;
  var seen = false;
  try { seen = sessionStorage.getItem("nf-intro") === "1"; sessionStorage.setItem("nf-intro", "1"); } catch (e) {}
  function dropIntro() { if (intro && intro.parentNode) intro.parentNode.removeChild(intro); }
  if (intro) {
    if (reduceMotion || seen) dropIntro();
    else {
      introDelay = 1500;
      intro.classList.add("is-on");
      document.documentElement.style.overflow = "hidden";
      var finishIntro = function () {
        if (!intro.parentNode || intro.classList.contains("is-out")) return;
        intro.classList.add("is-out");
        document.documentElement.style.overflow = "";
        setTimeout(dropIntro, 1050);
      };
      setTimeout(finishIntro, 1500);
      intro.addEventListener("click", finishIntro);
      document.addEventListener("keydown", finishIntro, { once: true });
    }
  }

  /* ---------- контакти, адреса, реквізити ---------- */
  $$("[data-contact]").forEach(function (a) { var k = a.getAttribute("data-contact"); if (C[k]) a.href = C[k]; });
  if (C.address) {
    var addr = $("[data-address]"); if (addr) addr.textContent = "Студія знаходиться за адресою: " + C.address + ".";
    var fa = $("[data-address-footer]"); if (fa) { fa.textContent = C.address; fa.hidden = false; }
  }
  var links = $("[data-footer-links]");
  if (links) {
    if (C.telegram) links.appendChild(el("li", null, '<a href="' + esc(C.telegram) + '" target="_blank" rel="noopener">telegram</a>'));
    if (C.phone) links.appendChild(el("li", null, '<a href="tel:' + esc(C.phone.replace(/\s/g, "")) + '">' + esc(C.phone) + "</a>"));
  }
  var S = D.seller || {};
  var sellerBox = $("[data-seller]");
  if (sellerBox && S.name) {
    var rows = [S.name, S.code ? "РНОКПП / ЄДРПОУ: " + S.code : null, S.address ? "Адреса: " + S.address : null, S.email ? "E-mail: " + S.email : null].filter(Boolean);
    sellerBox.innerHTML = '<p class="mono footer__label">інформація про продавця</p><p>' + rows.map(esc).join("<br>") + "</p>";
    sellerBox.hidden = false;
  }
  var yr = $("[data-year]"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- шапка та плаваюча кнопка ---------- */
  var header = $("[data-header]");
  var dock = $("[data-dock]");
  var hero = $(".hero");
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle("is-solid", y > 24);
    if (dock && hero) {
      var nearEnd = window.innerHeight + y > document.body.scrollHeight - 520;
      var bk = document.getElementById("booking"), inBooking = false;
      if (bk) { var br = bk.getBoundingClientRect(); inBooking = br.top < window.innerHeight * 0.6 && br.bottom > window.innerHeight * 0.4; }
      dock.classList.toggle("is-on", y > hero.offsetTop + hero.offsetHeight * 0.6 && !nearEnd && !inBooking);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var navLinks = $$(".nav__list a");
  if ("IntersectionObserver" in window && navLinks.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("href") === "#" + e.target.id ? "true" : "false"); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) { var t = document.getElementById(a.getAttribute("href").slice(1)); if (t) navIO.observe(t); });
  }

  /* ---------- мобільне меню ---------- */
  var menu = $("[data-menu]");
  var openBtn = $("[data-menu-open]");
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(function () { menu.classList.add("is-open"); });
    openBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    $("[data-menu-close]").focus();
  }
  function closeMenu(returnFocus) {
    menu.classList.remove("is-open"); menu.hidden = true;
    openBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (returnFocus) openBtn.focus();
  }
  openBtn.addEventListener("click", openMenu);
  $("[data-menu-close]").addEventListener("click", function () { closeMenu(true); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { closeMenu(false); }); });
  menu.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu(true);
    if (e.key === "Tab") {
      var f = $$("a, button", menu), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- біжучий рядок ---------- */
  var track = $(".ticker__track");
  if (track && !reduceMotion) $$(":scope > *", track).forEach(function (n) { track.appendChild(n.cloneNode(true)); });

  /* ---------- буфер обміну ---------- */
  function copyText(text, fallbackField) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      try { fallbackField.select(); document.execCommand("copy") ? res() : rej(); } catch (err) { rej(err); }
    });
  }

  /* ---------- каталог ---------- */
  var grid = $("[data-grid]");
  var items = D.items || [];
  function tagText(it) { return SHOW_PRICES ? (it.price || "за запитом") : (it.month || ""); }

  function imgTag(im, cls, lazy) {
    return '<img' + (cls ? ' class="' + cls + '"' : "") + ' src="' + esc(photo(im.src)) + '" width="' + im.w + '" height="' + im.h + '"' +
      (lazy ? ' loading="lazy"' : "") + ' alt="' + (cls ? "" : esc(im.alt)) + '"' + (im.pos ? ' style="object-position:' + esc(im.pos) + '"' : "") + ">";
  }

  function cardHTML(it) {
    var imgs = it.layout === "feature" ? it.images.slice(0, 2) : it.images.slice(0, 1);
    var media = imgs.map(function (im) { return imgTag(im, null, true); }).join("");
    if (it.layout !== "feature" && it.images.length > 1) media += imgTag(it.images[1], "card__alt", true);
    var live = it.statusTone === "live";
    return '<button class="card__btn" type="button" data-open="' + esc(it.id) + '" aria-haspopup="dialog">' +
      '<span class="card__media">' + media +
        '<span class="tag' + (live ? " tag--live" : "") + '" aria-hidden="true"><span class="tag__string"></span>' +
        '<span class="tag__body"><span class="tag__no">№ ' + esc(it.no) + '</span><span class="tag__price">' + esc(tagText(it)) + "</span></span></span>" +
      "</span>" +
      '<span class="card__info">' +
        '<span class="card__row"><span class="card__title">' + esc(it.title) + '</span><span class="mono card__status' + (live ? " card__status--live" : "") + '">' + esc(it.status || "") + "</span></span>" +
        '<span class="card__lead">' + esc(it.lead) + "</span>" +
        (SHOW_PRICES ? '<span class="sr-only">Ціна: ' + esc(it.price || "за запитом") + ".</span>" : "") +
        '<span class="card__more">детальніше та замовлення <svg class="i" aria-hidden="true"><use href="#arrow-ne"/></svg></span>' +
      "</span></button>";
  }

  if (grid && items.length) {
    grid.innerHTML = "";
    items.forEach(function (it) {
      grid.appendChild(el("article", { class: "card card--" + (it.layout || "std"), "data-cat": it.category, "aria-label": it.title }, cardHTML(it)));
    });
  }

  var filtersBox = $("[data-filters]");
  if (filtersBox && D.filters) {
    D.filters.forEach(function (f, i) {
      filtersBox.appendChild(el("button", { class: "chip", type: "button", "aria-pressed": i === 0 ? "true" : "false", "data-filter": f.id }, esc(f.label)));
    });
    filtersBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]"); if (!b) return;
      var id = b.getAttribute("data-filter");
      $$(".chip", filtersBox).forEach(function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
      $$(".card", grid).forEach(function (card) {
        var show = id === "all" || card.getAttribute("data-cat") === id;
        card.hidden = !show; if (show) card.classList.add("is-in");
      });
    });
  }

  /* ---------- детальна картка ---------- */
  var sheet = $("[data-sheet]");
  var lastTrigger = null;
  var copyStatus = $("[data-copy-status]");
  function openSheet(id) {
    var it = items.filter(function (x) { return x.id === id; })[0];
    if (!it || !sheet) return;
    var media = $("[data-sheet-media]", sheet);
    media.innerHTML = it.images.map(function (im) { return imgTag(im, null, false); }).join("");
    media.classList.toggle("is-single", it.images.length < 2);
    $("[data-sheet-meta]", sheet).textContent = "№ " + it.no + " · " + (it.status || "") + " · " + (it.posted || "");
    $("[data-sheet-title]", sheet).textContent = it.title;
    $("[data-sheet-lead]", sheet).textContent = it.lead;
    var list = $("[data-sheet-list]", sheet);
    var rows = it.bullets || (SHOW_PRICES ? it.prices : null) || [];
    list.innerHTML = rows.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    var pr = $("[data-sheet-price]", sheet);
    if (!SHOW_PRICES) pr.innerHTML = "вартість — у direct<small>залежить від сезонних квітів і розміру</small>";
    else if (it.prices) pr.innerHTML = it.priceNote ? "<small>" + esc(it.priceNote) + " · актуальну вартість уточнюйте в direct</small>" : "";
    else pr.innerHTML = esc(it.price || "вартість — за запитом") + (it.priceNote ? "<small>" + esc(it.priceNote) + " · актуальну вартість уточнюйте в direct</small>" : "");
    $("[data-sheet-msg]", sheet).value = it.message || "Привіт! Хочу замовити: " + it.title + ".";
    $("[data-sheet-cta]", sheet).firstChild.nodeValue = (it.cta || "написати в direct").toLowerCase() + " ";
    copyStatus.textContent = "";
    if (typeof sheet.showModal === "function") sheet.showModal(); else sheet.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    sheet.scrollTop = 0;
  }
  function closeSheet() { if (sheet.open && sheet.close) sheet.close(); else sheet.removeAttribute("open"); }
  if (grid) grid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]"); if (!b) return;
    lastTrigger = b; openSheet(b.getAttribute("data-open"));
  });
  if (sheet) {
    $("[data-sheet-close]", sheet).addEventListener("click", closeSheet);
    sheet.addEventListener("close", function () { document.body.style.overflow = ""; if (lastTrigger) lastTrigger.focus(); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) closeSheet(); });
    var sheetMsg = $("[data-sheet-msg]", sheet);
    var ok = function () { copyStatus.textContent = "текст скопійовано — вставте його в direct"; };
    $("[data-copy]", sheet).addEventListener("click", function () {
      copyText(sheetMsg.value, sheetMsg).then(ok, function () { copyStatus.textContent = "не вдалося скопіювати — виділіть текст вручну"; });
    });
    $("[data-sheet-cta]", sheet).addEventListener("click", function () { copyText(sheetMsg.value, sheetMsg).then(ok, function () {}); });
  }

  /* ---------- з життя студії (Reels) ---------- */
  var rail = $("[data-stories]");
  var stories = D.stories || [];
  if (rail && stories.length) {
    rail.innerHTML = stories.map(function (s, i) {
      var url = "https://www.instagram.com/nectar.flostudio/reel/" + encodeURIComponent(s.id) + "/";
      return '<li class="story" style="--d:' + (i % 6) + '"><a class="story__link" href="' + url + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(photo("reels/" + s.id + ".jpg")) + '" width="360" height="640" loading="lazy" alt="' + esc(s.alt) + '">' +
        '<span class="story__top mono">№ ' + String(i + 1).padStart(2, "0") + (s.date ? " · " + esc(s.date) : "") + "</span>" +
        '<span class="story__play" aria-hidden="true"><svg><use href="#lily"/></svg></span>' +
        '<span class="story__bottom"><span class="story__title">' + esc(s.title) + '</span><span class="story__text">' + esc(s.text) + "</span>" +
        '<span class="story__go mono">дивитись в instagram ↗</span></span></a></li>';
    }).join("");
    var step = function (dir) {
      var card = $(".story", rail);
      var w = card ? card.getBoundingClientRect().width + 14 : 300;
      rail.scrollBy({ left: dir * w * 2, behavior: reduceMotion ? "auto" : "smooth" });
    };
    $("[data-stories-prev]").addEventListener("click", function () { step(-1); });
    $("[data-stories-next]").addEventListener("click", function () { step(1); });
    // перетягування мишею на десктопі
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
  function renderPlans(freq, animate) {
    if (!plans || !SUB) return;
    plans.innerHTML = SUB.sizes.map(function (p) {
      var main, alt;
      if (SHOW_PRICES) {
        main = (freq === "4" ? p.per4 : p.per2) + " грн<small>на місяць · " + freq + " букети</small>";
        alt = freq === "4" ? "2 рази — " + p.per2 + " грн" : "4 рази — " + p.per4 + " грн";
      } else {
        main = freq + " букети<small>на місяць</small>";
        alt = { S: "компактні букети", M: "середній розмір", L: "великі букети" }[p.size] || "";
      }
      return '<li class="plan"><span class="plan__size">' + esc(p.size) + '</span><span class="plan__price' + (animate ? " is-swap" : "") + '">' + main + '</span><span class="plan__alt">' + esc(alt) + "</span></li>";
    }).join("");
  }
  renderPlans("2", false);
  var note = $("[data-sub-note]");
  if (note) note.textContent = SHOW_PRICES && SUB ? "ціни з нашого допису від " + SUB.posted + ". актуальну вартість і склад уточнюйте в direct." : "вартість підписки та склад букетів — у direct.";
  $$("[data-freq] input").forEach(function (r) { r.addEventListener("change", function () { renderPlans(r.value, !reduceMotion); }); });

  /* ---------- конструктор повідомлення ---------- */
  var CP = D.composer;
  var composer = $("[data-composer]");
  if (composer && CP) {
    var state = { occasion: null, mood: null, format: CP.formats[0], date: "" };
    var msg = $("[data-composer-msg]", composer);
    var status = $("[data-composer-status]", composer);
    var touched = false;
    var chip = function (name, value, label, checked) {
      return '<label class="chip-opt"><input type="radio" name="' + name + '" value="' + esc(value) + '"' + (checked ? " checked" : "") + '><span>' + esc(label) + "</span></label>";
    };
    $("[data-occasions]", composer).innerHTML = CP.occasions.map(function (o) { return chip("occasion", o, o, false); }).join("");
    $("[data-formats]", composer).innerHTML = CP.formats.map(function (f, i) { return chip("format", f, f, i === 0); }).join("");
    $("[data-moods]", composer).innerHTML = CP.moods.map(function (m) {
      var dots = m.colors.map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join("");
      return '<label class="mood-opt"><input type="radio" name="mood" value="' + esc(m.id) + '"><span><span class="mood-opt__dots" aria-hidden="true">' + dots + "</span>" + esc(m.label) + "</span></label>";
    }).join("");

    var build = function () {
      var mood = CP.moods.filter(function (m) { return m.id === state.mood; })[0];
      var parts = ["Привіт! Хочу замовити " + state.format];
      if (state.occasion) parts[0] += " — привід: " + state.occasion;
      parts[0] += ".";
      if (mood) parts.push(mood.id === "any" ? "Кольори — на ваш смак." : "Настрій і кольори: " + mood.label + ".");
      if (state.date) {
        var d = new Date(state.date + "T12:00:00");
        parts.push("Дата: " + d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" }) + ".");
      }
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
    var cOk = function () { status.textContent = "текст скопійовано — вставте його в direct"; };
    $("[data-composer-copy]", composer).addEventListener("click", function () {
      copyText(msg.value, msg).then(cOk, function () { status.textContent = "не вдалося скопіювати — виділіть текст вручну"; });
    });
    $("[data-composer-go]", composer).addEventListener("click", function () { copyText(msg.value, msg).then(cOk, function () {}); });
  }

  /* ---------- курсор «дивитись» ---------- */
  var cursor = $("[data-cursor]");
  if (cursor && finePointer) {
    var cx = -200, cy = -200, raf = null;
    document.addEventListener("pointermove", function (e) {
      cx = e.clientX; cy = e.clientY;
      if (!raf) raf = requestAnimationFrame(function () { cursor.style.setProperty("--x", cx + "px"); cursor.style.setProperty("--y", cy + "px"); raf = null; });
      var over = e.target.closest && e.target.closest(".card__media");
      if (over && !cursor.classList.contains("is-on")) {
        cursor.classList.add("is-on");
        setTimeout(function () { if (cursor.classList.contains("is-on")) cursor.classList.add("is-fast"); }, 350);
      } else if (!over && cursor.classList.contains("is-on")) cursor.classList.remove("is-on", "is-fast");
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { cursor.classList.remove("is-on", "is-fast"); });
  }

  /* ---------- поява при прокручуванні ---------- */
  // заголовки сховані маскою (clip-path) — їх «бачить» батьківський блок
  var masked = $$(".section__title.reveal, .cta__title");
  var toReveal = $$(".reveal, .unveil, .card, .draw, .story").filter(function (n) { return masked.indexOf(n) < 0; });
  if (!("IntersectionObserver" in window) || reduceMotion) {
    toReveal.concat(masked).forEach(function (n) { n.classList.add("is-in"); });
  } else {
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        masked.forEach(function (t) { if (t.parentElement === e.target) t.classList.add("is-in"); });
        tio.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    setTimeout(function () { masked.forEach(function (t) { tio.observe(t.parentElement); }); }, introDelay);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = e.target;
        if (n.classList.contains("card")) n.style.transitionDelay = ($$(".card:not([hidden])", grid).indexOf(n) % 3) * 90 + "ms";
        n.classList.add("is-in");
        io.unobserve(n);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    setTimeout(function () { toReveal.forEach(function (n) { io.observe(n); }); }, introDelay);
  }

  /* ---------- побуквена поява заголовка першого екрана ---------- */
  var h1 = $(".hero__title");
  if (h1 && !reduceMotion) {
    h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim());
    var ci = 0;
    $$(".line", h1).forEach(function (line) {
      line.setAttribute("aria-hidden", "true");
      Array.prototype.slice.call(line.childNodes).forEach(function (node) {
        if (node.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        node.textContent.split("").forEach(function (ch) {
          var sp = document.createElement("span");
          sp.className = "ch"; sp.textContent = ch; sp.style.setProperty("--i", ci++);
          frag.appendChild(sp);
        });
        line.replaceChild(frag, node);
      });
    });
    h1.classList.add("is-split");
  }

  /* ---------- нахил головного фото за курсором ---------- */
  var heroMedia = $(".hero__media");
  if (heroMedia && finePointer && !reduceMotion) {
    var heroMain = $(".hero__main", heroMedia), heroAside = $(".hero__aside", heroMedia);
    heroMedia.addEventListener("pointermove", function (e) {
      var r = heroMedia.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      heroMain.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
      heroMain.style.setProperty("--ry", (x * 6).toFixed(2) + "deg");
      heroAside.style.setProperty("--tx", (x * -14).toFixed(1) + "px");
      heroAside.style.setProperty("--ty", (y * -10).toFixed(1) + "px");
    });
    heroMedia.addEventListener("pointerleave", function () {
      heroMain.style.setProperty("--rx", "0deg"); heroMain.style.setProperty("--ry", "0deg");
      heroAside.style.setProperty("--tx", "0px"); heroAside.style.setProperty("--ty", "0px");
    });
  }

  /* ---------- хроніка: горизонтальна стрічка від вертикального скролу ---------- */
  var chron = $("[data-chron]");
  if (chron) {
    var ctrack = $("[data-chron-track]", chron), cbar = $("[data-chron-bar]", chron);
    var pinMQ = window.matchMedia("(min-width: 960px)");
    var dist = 0;
    var chronTick = function () {
      if (!chron.classList.contains("is-pinned")) return;
      var top = chron.getBoundingClientRect().top;
      var p = Math.min(1, Math.max(0, -top / (dist || 1)));
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

  /* ---------- легкий паралакс штампа ---------- */
  var stamp = $(".stamp");
  if (stamp && !reduceMotion && window.matchMedia("(min-width: 960px)").matches) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { stamp.style.transform = "translateY(" + (Math.min(window.scrollY, 900) * 0.12).toFixed(1) + "px)"; ticking = false; });
    }, { passive: true });
  }
})();
