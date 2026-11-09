/* Nectar Flo Studio — бронювання дат.
   Три режими:
   • live    — booking.endpoint заповнено: вільні дати й заявки йдуть у Google-таблицю студії;
   • direct  — endpoint порожній: календар без вигаданої зайнятості, заявка відкривається в Direct;
   • demo    — ?demo=1 в адресі: приклад зайнятості й імітація підтвердження для презентації. */
(function () {
  "use strict";
  var D = window.NECTAR || {};
  var B = D.booking;
  var root = document.querySelector("[data-booking]");
  if (!B || !root) return;

  var DEMO = /[?&]demo=1\b/.test(location.search);
  var MODE = B.endpoint ? "live" : DEMO ? "demo" : "direct";
  var DIRECT = (D.contacts && D.contacts.direct) || "https://ig.me/m/nectar.flostudio";
  var MONTHS = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
  var MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  var DOW = ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"];

  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function human(k) { var d = parse(k); return d.getDate() + " " + MONTHS_GEN[d.getMonth()] + ", " + DOW[d.getDay()]; }

  var state = { step: 1, service: null, date: null, slot: null, month: null, data: null };

  /* ---------------- дані про доступність ---------------- */
  function localData() {
    var days = {};
    var first = parse(B.season.from), last = parse(B.season.to);
    var min = new Date(); min.setHours(0, 0, 0, 0); min.setDate(min.getDate() + (B.minDays || 0));
    var seed = 7;
    for (var d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      var k = key(d), day = {};
      B.resources.forEach(function (r) {
        day[r.id] = {};
        r.slots.forEach(function (s) {
          var left = d < min ? 0 : r.capacity;
          if (DEMO && left) { // приклад зайнятості лише в демо
            seed = (seed * 9301 + 49297) % 233280;
            var x = seed / 233280, busy = d.getDay() === 5 || d.getDay() === 6 || (d.getMonth() === 11 && d.getDate() > 14 && d.getDate() < 25);
            if (x < (busy ? 0.7 : 0.3)) left = r.capacity > 1 ? Math.floor(r.capacity * x * 0.5) : 0;
          }
          day[r.id][s.name] = left;
        });
      });
      days[k] = day;
    }
    return { season: B.season, holdHours: B.holdHours, resources: B.resources, services: B.services, days: days, prepayment: B.prepaymentText };
  }

  function load() {
    if (MODE !== "live") return Promise.resolve(localData());
    return fetch(B.endpoint + "?action=availability", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error); return j; })
      .catch(function () { MODE = "direct"; showMode(true); return localData(); });
  }

  function showMode(failed) {
    var box = document.querySelector("[data-booking-mode]");
    if (MODE === "live") { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = MODE === "demo"
      ? "<strong>демо-режим</strong> · зайнятість дат — приклад, заявки нікуди не надсилаються"
      : (failed ? "календар студії тимчасово недоступний · " : "") + "оберіть дату й час — заявка відкриється в Instagram Direct з готовим текстом, а студія підтвердить дату";
    box.classList.toggle("is-demo", MODE === "demo");
  }

  /* ---------------- кроки ---------------- */
  function go(step, focus) {
    state.step = step;
    $$("[data-step]").forEach(function (el) { el.hidden = Number(el.getAttribute("data-step")) !== step; });
    $$("[data-step-ind]").forEach(function (li) {
      var n = Number(li.getAttribute("data-step-ind"));
      li.classList.toggle("is-done", n < step);
      if (n === step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    if (focus !== false) {
      var target = $('[data-step="' + step + '"]');
      var t = target.querySelector(".bstep__title") || target;
      if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
      var top = root.getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
    }
  }
  function updateSummary() {
    var svc = currentService();
    $('[data-sum="service"]', document).textContent = svc ? svc.name : "—";
    $('[data-sum="date"]', document).textContent = state.date ? human(state.date) : "—";
    var slot = currentSlot();
    $('[data-sum="slot"]', document).textContent = slot ? slot.name + " · " + slot.from + "–" + slot.to : "—";
    $('[data-step="1"] [data-next]').disabled = !state.service;
    $('[data-step="2"] [data-next]').disabled = !(state.date && state.slot);
  }
  function currentService() { return state.data && state.data.services.filter(function (s) { return s.id === state.service; })[0]; }
  function currentResource() { var s = currentService(); return s && state.data.resources.filter(function (r) { return r.id === s.resource; })[0]; }
  function currentSlot() { var r = currentResource(); return r && r.slots.filter(function (s) { return s.name === state.slot; })[0]; }

  /* ---------------- крок 1: послуги ---------------- */
  function renderServices() {
    var box = $("[data-services]");
    box.innerHTML = state.data.services.map(function (s, i) {
      return '<label class="svc__opt"><input type="radio" name="service" value="' + esc(s.id) + '"><span class="svc__card">' +
        '<span class="mono svc__no">' + pad(i + 1) + "</span>" +
        '<span class="svc__name">' + esc(s.name) + "</span>" +
        '<span class="svc__desc">' + esc(s.description || "") + "</span>" +
        '<svg class="svc__lily" aria-hidden="true"><use href="#lily"/></svg></span></label>';
    }).join("");
    box.addEventListener("change", function (e) {
      if (e.target.name !== "service") return;
      state.service = e.target.value; state.date = null; state.slot = null;
      updateSummary(); renderCalendar(); renderSlots();
    });
  }

  /* ---------------- крок 2: календар ---------------- */
  function dayInfo(k) {
    var r = currentResource();
    var day = state.data.days[k];
    if (!r || !day || !day[r.id]) return { state: "off", left: 0 };
    var left = 0, cap = 0;
    r.slots.forEach(function (s) { left += day[r.id][s.name] || 0; cap += r.capacity; });
    var inSeason = true;
    if (!left) {
      var d = parse(k), min = new Date(); min.setHours(0, 0, 0, 0); min.setDate(min.getDate() + (B.minDays || 0));
      inSeason = d >= min;
    }
    return { state: !inSeason ? "off" : left === 0 ? "full" : left <= Math.max(1, Math.floor(cap / 3)) ? "few" : "free", left: left };
  }

  function renderCalendar() {
    var grid = $("[data-cal-grid]");
    var first = parse(state.data.season.from), last = parse(state.data.season.to);
    if (!state.month) {
      var start = new Date(Math.max(first, new Date()));
      state.month = new Date(start.getFullYear(), start.getMonth(), 1);
    }
    var m = state.month;
    $("[data-cal-title]").textContent = MONTHS[m.getMonth()] + " " + m.getFullYear();
    $("[data-cal-prev]").disabled = new Date(m.getFullYear(), m.getMonth(), 0) < first;
    $("[data-cal-next]").disabled = new Date(m.getFullYear(), m.getMonth() + 1, 1) > last;

    var offset = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7;
    var daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var html = "", row = "", cell = 0;
    for (var i = 0; i < offset; i++) { row += '<span class="cal__empty" role="gridcell"></span>'; cell++; }
    for (var d = 1; d <= daysIn; d++) {
      var k = key(new Date(m.getFullYear(), m.getMonth(), d));
      var inRange = k >= state.data.season.from && k <= state.data.season.to;
      var info = inRange ? dayInfo(k) : { state: "off", left: 0 };
      var label = human(k) + ", " + ({ free: "вільно", few: "залишилось мало місць", full: "зайнято", off: "недоступно" })[info.state];
      var sel = state.date === k;
      row += '<span role="gridcell"><button type="button" class="cal__day is-' + info.state + (sel ? " is-sel" : "") + '" data-day="' + k + '"' +
        (info.state === "off" || info.state === "full" ? ' aria-disabled="true"' : "") + ' aria-pressed="' + sel + '" aria-label="' + esc(label) + '" tabindex="-1">' +
        '<span class="cal__num">' + d + '</span><i class="cal__dot" aria-hidden="true"></i></button></span>';
      cell++;
      if (cell % 7 === 0) { html += '<div class="cal__row" role="row">' + row + "</div>"; row = ""; }
    }
    if (row) html += '<div class="cal__row" role="row">' + row + "</div>";
    grid.innerHTML = html;
    // фокус «котиться» стрілками
    var focusable = $$(".cal__day", grid);
    var active = grid.querySelector(".is-sel") || grid.querySelector(".is-free, .is-few") || focusable[0];
    if (active) active.tabIndex = 0;
  }

  function moveFocus(btn, delta) {
    var all = $$(".cal__day", $("[data-cal-grid]"));
    var i = all.indexOf(btn) + delta;
    if (i < 0 || i >= all.length) {
      var dir = delta > 0 ? 1 : -1;
      var btnNav = $(dir > 0 ? "[data-cal-next]" : "[data-cal-prev]");
      if (btnNav.disabled) return;
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + dir, 1);
      renderCalendar();
      all = $$(".cal__day", $("[data-cal-grid]"));
      i = dir > 0 ? 0 : all.length - 1;
    }
    all.forEach(function (b) { b.tabIndex = -1; });
    all[i].tabIndex = 0; all[i].focus();
  }

  function pickDay(k) {
    var info = dayInfo(k);
    var status = $("[data-cal-status]");
    if (info.state === "full") { status.textContent = human(k) + " вже зайнято — оберіть інший день."; return; }
    if (info.state === "off") { status.textContent = "Ця дата недоступна для бронювання."; return; }
    state.date = k; state.slot = null;
    var r = currentResource();
    if (r && r.slots.length === 1 && state.data.days[k][r.id][r.slots[0].name] > 0) state.slot = r.slots[0].name;
    status.textContent = "Обрано: " + human(k) + ".";
    renderCalendar(); renderSlots(); updateSummary();
  }

  function renderSlots() {
    var wrap = $("[data-slots]"), list = $("[data-slots-list]");
    var r = currentResource();
    if (!state.date || !r) { wrap.hidden = true; return; }
    wrap.hidden = false;
    $("[data-slots-title]").textContent = r.slots.length > 1 ? "оберіть час монтажу — " + human(state.date) : "отримання — " + human(state.date);
    list.innerHTML = r.slots.map(function (s) {
      var left = state.data.days[state.date][r.id][s.name] || 0;
      var sel = state.slot === s.name;
      return '<button type="button" class="slot' + (sel ? " is-sel" : "") + '" data-slot="' + esc(s.name) + '"' + (left ? "" : " disabled") + ' aria-pressed="' + sel + '">' +
        '<span class="slot__name">' + esc(s.name) + '</span><span class="slot__time">' + esc(s.from) + "–" + esc(s.to) + "</span>" +
        '<span class="mono slot__left">' + (left ? (r.capacity > 1 ? "вільно " + left : "вільно") : "зайнято") + "</span></button>";
    }).join("");
  }

  /* ---------------- крок 3: форма ---------------- */
  function fillSelects() {
    var r = currentResource();
    var scopes = (B.scopes && r && B.scopes[r.id]) || [];
    $("[data-scope]").innerHTML = '<option value="">— оберіть —</option>' + scopes.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
    $("[data-budget]").innerHTML = '<option value="">— не обовʼязково —</option>' + (B.budgets || []).map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
    var pickup = r && r.id === "workshop";
    $("[data-address-field]").hidden = pickup;
    $("[data-venue-field] span").textContent = pickup ? "Для кого / назва компанії" : "Заклад або назва";
  }

  function formData() {
    var f = $("[data-form]");
    var get = function (n) { var el = f.elements[n]; return el ? String(el.value || "").trim() : ""; };
    var slot = currentSlot(), svc = currentService();
    return {
      service: state.service, serviceName: svc && svc.name, date: state.date, slot: state.slot,
      slotTime: slot ? slot.from + "–" + slot.to : "",
      name: get("name"), phone: get("phone"), handle: get("handle"), email: get("email"),
      venue: get("venue"), address: get("address"), scope: get("scope"), budget: get("budget"),
      details: get("details"), refs: get("refs"), website: get("website"),
      consent: f.elements.consent.checked,
    };
  }

  function validate(d) {
    var f = $("[data-form]");
    $$(".field.is-bad", f).forEach(function (x) { x.classList.remove("is-bad"); });
    var bad = null;
    if (d.name.length < 2) bad = ["name", "Вкажіть, будь ласка, імʼя."];
    else if (!/^[+\d][\d\s()\-]{8,}$/.test(d.phone)) bad = ["phone", "Перевірте номер телефону — напр. +380 67 123 45 67."];
    else if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) bad = ["email", "Перевірте email або залиште поле порожнім."];
    else if (!d.consent) bad = ["consent", "Потрібна згода на обробку даних, щоб студія могла звʼязатися з вами."];
    if (!bad) return true;
    var el = f.elements[bad[0]];
    (el.closest(".field") || el.closest(".check")).classList.add("is-bad");
    $("[data-form-error]").textContent = bad[1];
    el.focus();
    return false;
  }

  function message(d, code) {
    return [
      "Привіт! Хочу забронювати дату" + (code ? " (заявка " + code + ")" : "") + ".",
      "Оформлення: " + d.serviceName,
      "Дата: " + human(d.date) + ", " + d.slot + " " + d.slotTime,
      d.venue ? "Заклад: " + d.venue : "",
      d.address ? "Адреса: " + d.address : "",
      d.scope ? "Обсяг: " + d.scope : "",
      d.budget ? "Бюджет: " + d.budget : "",
      d.details ? "Побажання: " + d.details : "",
      d.refs ? "Референси: " + d.refs : "",
      "Імʼя: " + d.name + ", тел. " + d.phone + (d.handle ? ", " + d.handle : ""),
    ].filter(Boolean).join("\n");
  }

  function ics(d, code) {
    var slot = currentSlot();
    var dt = d.date.replace(/-/g, "");
    var t = function (hhmm) { return hhmm.replace(":", "") + "00"; };
    var body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nectar Flo Studio//UA", "BEGIN:VEVENT",
      "UID:" + (code || "nectar") + "-" + dt + "@nectar.flostudio",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""),
      "DTSTART;TZID=Europe/Kyiv:" + dt + "T" + t(slot.from),
      "DTEND;TZID=Europe/Kyiv:" + dt + "T" + t(slot.to),
      "SUMMARY:Nectar Flo Studio — " + d.serviceName + (code ? " (" + code + ")" : ""),
      "DESCRIPTION:Заявка на оформлення. Студія підтвердить деталі в робочий час (10–19).",
      d.address ? "LOCATION:" + d.address.replace(/[,;]/g, " ") : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    return URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return Promise.reject();
  }

  function done(d, res) {
    var code = res && res.code;
    $("[data-done-code]").textContent = code ? "заявка " + code : MODE === "direct" ? "залишився один крок" : "";
    var title = $("[data-done-title]"), text = $("[data-done-text]"), actions = $("[data-done-actions]");
    var msg = message(d, code);
    var directBtn = '<a class="btn btn--red" href="' + esc(DIRECT) + '" target="_blank" rel="noopener" data-done-direct>' +
      (MODE === "direct" ? "надіслати в direct" : "написати в direct") + ' <svg class="i" aria-hidden="true"><use href="#arrow-ne"/></svg></a>';
    var icsBtn = '<a class="btn btn--ghost" href="' + ics(d, code) + '" download="nectar-' + d.date + '.ics">додати в мій календар</a>';
    if (MODE === "direct") {
      title.textContent = "надішліть заявку в direct";
      text.textContent = "Ми скопіюємо текст заявки — вставте його в Direct студії. Студія перевірить, чи вільна дата, і підтвердить її в робочий час.";
      actions.innerHTML = directBtn + '<button class="btn btn--ghost" type="button" data-done-copy>скопіювати текст</button><pre class="bdone__msg">' + esc(msg) + "</pre>";
    } else {
      title.textContent = MODE === "demo" ? "дату заброньовано (демо)" : "дату заброньовано";
      var hold = (res && res.holdHours) || state.data.holdHours || B.holdHours;
      text.textContent = human(d.date) + ", " + d.slot + " " + d.slotTime + ". Ми тримаємо цю дату " + hold + " год і звʼяжемося з вами щодня з 10 до 19. " +
        ((res && res.prepayment) || state.data.prepayment || B.prepaymentText || "");
      actions.innerHTML = icsBtn + directBtn;
    }
    var st = $("[data-done-status]");
    var copyMsg = function () { copy(msg).then(function () { st.textContent = "текст заявки скопійовано — вставте його в direct"; }, function () { st.textContent = "виділіть текст вище й скопіюйте вручну"; }); };
    actions.addEventListener("click", function (e) {
      if (e.target.closest("[data-done-copy]") || e.target.closest("[data-done-direct]")) copyMsg();
    });
    go(4);
    $('[data-step="4"]').focus({ preventScroll: true });
  }

  function submit(e) {
    e.preventDefault();
    $("[data-form-error]").textContent = "";
    var d = formData();
    if (!validate(d)) return;
    var btn = $("[data-submit]");
    if (MODE !== "live") {
      if (MODE === "demo") {
        btn.disabled = true;
        setTimeout(function () { btn.disabled = false; done(d, { code: "NF-DEMO" }); }, 700);
      } else done(d, null);
      return;
    }
    btn.disabled = true; btn.classList.add("is-busy");
    fetch(B.endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(d) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) return done(d, res);
        var map = {
          slot_taken: "Поки ви заповнювали форму, цей час уже забронювали. Оберіть, будь ласка, інший.",
          too_many: "Забагато заявок з цього номера. Напишіть нам у Direct — допоможемо.",
          busy: "Сервер зайнятий — спробуйте ще раз за хвилину.",
          invalid: "Перевірте поля форми.",
        };
        $("[data-form-error]").textContent = map[res.error] || "Не вдалося надіслати заявку. Спробуйте ще раз або напишіть у Direct.";
        if (res.error === "slot_taken") { load().then(function (data) { state.data = data; state.slot = null; renderCalendar(); renderSlots(); updateSummary(); go(2); }); }
      })
      .catch(function () {
        $("[data-form-error]").innerHTML = 'Немає звʼязку з календарем студії. <a href="' + esc(DIRECT) + '" target="_blank" rel="noopener">Напишіть у Direct</a> — ми все одно забронюємо.';
      })
      .finally(function () { btn.disabled = false; btn.classList.remove("is-busy"); });
  }

  /* ---------------- події ---------------- */
  root.addEventListener("click", function (e) {
    var t = e.target;
    var day = t.closest("[data-day]");
    if (day) { pickDay(day.getAttribute("data-day")); return; }
    var slot = t.closest("[data-slot]");
    if (slot && !slot.disabled) { state.slot = slot.getAttribute("data-slot"); renderSlots(); updateSummary(); return; }
    if (t.closest("[data-cal-prev]")) { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); return; }
    if (t.closest("[data-cal-next]")) { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); return; }
    if (t.closest("[data-next]")) { if (state.step === 2) fillSelects(); go(state.step + 1); return; }
    if (t.closest("[data-back]")) { go(state.step - 1); return; }
  });
  root.addEventListener("keydown", function (e) {
    var btn = e.target.closest && e.target.closest(".cal__day");
    if (!btn) return;
    var map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[e.key]) { e.preventDefault(); moveFocus(btn, map[e.key]); }
  });
  $("[data-form]").addEventListener("submit", submit);
  $("[data-form]").addEventListener("input", function (e) {
    var f = e.target.closest(".field, .check"); if (f) f.classList.remove("is-bad");
    $("[data-form-error]").textContent = "";
  });

  /* ---------------- лічильник вільних днів грудня (лише реальні або демо-дані) ---------------- */
  function renderDecember(data) {
    var box = document.querySelector("[data-dec]");
    if (!box || MODE === "direct") return;
    var install = data.resources.filter(function (r) { return r.id === "install"; })[0];
    if (!install) return;
    var year = Number(data.season.from.slice(0, 4)), free = 0, total = 0;
    Object.keys(data.days).forEach(function (k) {
      var d = parse(k);
      if (d.getMonth() !== 11 || d.getFullYear() !== year) return;
      total++;
      var day = data.days[k][install.id] || {};
      if (Object.keys(day).some(function (s) { return day[s] > 0; })) free++;
    });
    if (!total) return;
    box.hidden = false;
    var n = box.querySelector("[data-dec-n]");
    box.querySelector("[data-dec-note]").textContent = MODE === "demo" ? "демо-дані" : "з календаря студії, оновлено щойно";
    var cur = total;
    var step = function () { cur = Math.max(free, cur - 1); n.textContent = cur; if (cur > free) setTimeout(step, 28); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) n.textContent = free; else step();
  }

  /* ---------------- старт ---------------- */
  showMode(false);
  load().then(function (data) {
    state.data = data;
    $$("[data-hold]", document).forEach(function (el) { el.textContent = data.holdHours || B.holdHours; });
    renderServices();
    renderCalendar();
    updateSummary();
    renderDecember(data);
    // глибоке посилання: #booking?service=facade
    var m = location.hash.match(/service=([a-z]+)/);
    if (m) { var inp = root.querySelector('input[name="service"][value="' + m[1] + '"]'); if (inp) { inp.checked = true; inp.dispatchEvent(new Event("change", { bubbles: true })); } }
  });
})();
