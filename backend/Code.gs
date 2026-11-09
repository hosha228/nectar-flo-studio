/**
 * NECTAR FLO STUDIO — бронювання дат (Google Apps Script)
 * ---------------------------------------------------------------------------
 * Живе в Google-таблиці студії. Сайт питає вільні дати (GET) і надсилає заявки (POST).
 * Заявка → рядок у листі «Заявки» → подія в Google Календарі → лист / Telegram студії.
 * Нова заявка «тримає» дату N годин; якщо студія не підтвердила — дата звільняється.
 *
 * Встановлення: див. backend/README.md (≈15 хв). Після будь-яких змін коду —
 * «Розгорнути → Керувати розгортаннями → Редагувати → Нова версія».
 */

var SHEET = {
  settings: 'Налаштування',
  resources: 'Ресурси',
  services: 'Послуги',
  closed: 'Закриті дати',
  bookings: 'Заявки',
  help: 'Як користуватись',
};

var STATUS = {
  NEW: 'нова',
  CONFIRMED: 'підтверджена',
  PAID: 'передоплата',
  DONE: 'виконано',
  CANCELLED: 'скасована',
  EXPIRED: 'прострочена',
};
var STATUS_LIST = [STATUS.NEW, STATUS.CONFIRMED, STATUS.PAID, STATUS.DONE, STATUS.CANCELLED, STATUS.EXPIRED];

var COLS = ['Створено', 'Код', 'Статус', 'Дата', 'Час', 'Послуга', "Ім'я", 'Телефон', 'Telegram / Instagram',
  'Email', 'Заклад / назва', 'Адреса', 'Обсяг', 'Бюджет', 'Побажання', 'Референси', 'Згода на обробку даних',
  'ID події', 'Нотатки студії'];
var C = {}; COLS.forEach(function (h, i) { C[h] = i + 1; });

var TZ = 'Europe/Kyiv';

/* ============================== ВСТАНОВЛЕННЯ ============================== */

/** Запустіть один раз із редактора (кнопка ▶). Створить листи, тригери й попросить доступи. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);

  ensureSheet_(ss, SHEET.settings, ['Параметр', 'Значення', 'Пояснення'], [
    ['Сезон з', '2026-11-20', 'Перша дата, яку можна забронювати (РРРР-ММ-ДД)'],
    ['Сезон до', '2027-01-10', 'Остання дата'],
    ['Мінімум днів до дати', 2, 'Не раніше ніж через стільки днів від сьогодні'],
    ['Тримати нову заявку, год', 48, 'Скільки годин дата зайнята, поки студія не підтвердить'],
    ['Email для сповіщень', Session.getEffectiveUser().getEmail(), 'Куди надсилати листи про нові заявки'],
    ['ID календаря', 'primary', '«primary» — основний календар цього акаунта'],
    ['Telegram bot token', '', 'Необов\'язково: токен бота від @BotFather'],
    ['Telegram chat id', '', 'Необов\'язково: чат, куди бот пише про заявки'],
    ['Лист-підтвердження клієнту', 'так', 'так / ні — якщо клієнт залишив email'],
    ['Текст про передоплату', 'Умови передоплати студія повідомить під час підтвердження.', 'Показується клієнту після заявки'],
  ]);

  ensureSheet_(ss, SHEET.resources, ['ID', 'Назва', 'Слоти (назва ГГ:ХХ-ГГ:ХХ, через кому)', 'Місць у кожному слоті'], [
    ['install', 'Монтажна команда', 'ранок 09:00-12:00, день 12:00-16:00, вечір 16:00-20:00', 1],
    ['workshop', 'Майстерня: вінки й композиції', 'отримання 10:00-19:00', 12],
  ]);

  ensureSheet_(ss, SHEET.services, ['ID', 'Назва на сайті', 'Ресурс', 'Опис для клієнта', 'Активна (так/ні)'], [
    ['facade', 'Фасад або вітрина', 'install', 'Вхідна група, двері, вітрини, гірлянди з хвої', 'так'],
    ['interior', 'Інтер\'єр закладу', 'install', 'Зал, бар, ресепшн, ялинка чи інсталяція всередині', 'так'],
    ['home', 'Дім чи офіс', 'install', 'Приватне оформлення: ялинка, вінки, стіл', 'так'],
    ['event', 'Подія чи корпоратив', 'install', 'Декор вечірки, вечері чи корпоративу', 'так'],
    ['wreath', 'Вінки та хвойні композиції', 'workshop', 'Готові вінки й композиції: отримання в студії', 'так'],
  ]);

  ensureSheet_(ss, SHEET.closed, ['Дата (РРРР-ММ-ДД)', 'Ресурс (порожньо = усі)', 'Причина'], [
    ['2026-12-31', '', 'приклад: студія зайнята власними подіями'],
  ]);

  var b = ensureSheet_(ss, SHEET.bookings, COLS, []);
  b.getRange(2, C['Дата'], b.getMaxRows() - 1, 1).setNumberFormat('@');
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_LIST, true).setAllowInvalid(false).build();
  b.getRange(2, C['Статус'], b.getMaxRows() - 1, 1).setDataValidation(rule);
  addStatusColors_(b);
  b.setColumnWidth(C['Побажання'], 280);

  ensureSheet_(ss, SHEET.help, ['Як користуватись'], HELP_.map(function (l) { return [l]; }));

  // тригери
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('expireHolds').timeBased().everyHours(1).create();

  // запит доступів (календар, пошта, мережа)
  getCalendar_();
  MailApp.getRemainingDailyQuota();
  return 'Готово';
}

var HELP_ = [
  '1. Нові заявки з сайту з\'являються в листі «Заявки» зі статусом «нова» і подією в календарі [нова].',
  '2. Нова заявка тримає дату стільки годин, скільки вказано в «Налаштуваннях». Зателефонуйте/напишіть клієнту.',
  '3. Змініть статус у колонці «Статус»: підтверджена → передоплата → виконано. Подія в календарі оновиться сама.',
  '4. «скасована» або «прострочена» звільняє дату на сайті й видаляє подію з календаря.',
  '5. Щоб закрити день (вихідний, власна подія) — додайте рядок у «Закриті дати».',
  '6. Скільки монтажів на день — у «Ресурси»: слоти й місця в слоті. Сайт оновлюється одразу.',
  '7. Не видаляйте й не переставляйте колонки в «Заявках». Нотатки пишіть у колонку «Нотатки студії».',
  '8. Персональні дані клієнтів зберігайте лише для виконання замовлення; видаляйте рядки через 12 місяців.',
];

/* ================================== API =================================== */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'availability';
  try {
    if (action === 'availability') return json_(availability_());
    if (action === 'ping') return json_({ ok: true });
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String(err) });
  }
}

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  if (data.website) return json_({ ok: true, code: 'NF-0000' }); // пастка для ботів: мовчки «приймаємо»

  var v = validate_(data);
  if (v) return json_({ ok: false, error: 'invalid', field: v });

  var cache = CacheService.getScriptCache();
  var key = 'rate_' + String(data.phone).replace(/\D/g, '');
  var n = Number(cache.get(key) || 0);
  if (n >= 3) return json_({ ok: false, error: 'too_many' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'busy' });
  try {
    var av = availability_();
    var svc = av.services.filter(function (s) { return s.id === data.service; })[0];
    if (!svc) return json_({ ok: false, error: 'invalid', field: 'service' });
    var day = av.days[data.date];
    var left = day && day[svc.resource] && day[svc.resource][data.slot];
    if (!(left > 0)) return json_({ ok: false, error: 'slot_taken' });

    var code = newCode_();
    var res = av.resources.filter(function (r) { return r.id === svc.resource; })[0];
    var slot = res.slots.filter(function (s) { return s.name === data.slot; })[0];

    var row = [];
    row[C['Створено'] - 1] = new Date();
    row[C['Код'] - 1] = code;
    row[C['Статус'] - 1] = STATUS.NEW;
    row[C['Дата'] - 1] = data.date;
    row[C['Час'] - 1] = slot.name + ' ' + slot.from + '–' + slot.to;
    row[C['Послуга'] - 1] = svc.name;
    row[C["Ім'я"] - 1] = clean_(data.name, 80);
    row[C['Телефон'] - 1] = clean_(data.phone, 30); // clean_ додає «'» перед «+», щоб таблиця не вважала номер формулою
    row[C['Telegram / Instagram'] - 1] = clean_(data.handle, 80);
    row[C['Email'] - 1] = clean_(data.email, 120);
    row[C['Заклад / назва'] - 1] = clean_(data.venue, 120);
    row[C['Адреса'] - 1] = clean_(data.address, 200);
    row[C['Обсяг'] - 1] = clean_(data.scope, 120);
    row[C['Бюджет'] - 1] = clean_(data.budget, 60);
    row[C['Побажання'] - 1] = clean_(data.details, 2000);
    row[C['Референси'] - 1] = clean_(data.refs, 500);
    row[C['Згода на обробку даних'] - 1] = 'так, ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    row[C['ID події'] - 1] = '';
    row[C['Нотатки студії'] - 1] = '';

    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.bookings);
    sh.appendRow(row);
    var rowIndex = sh.getLastRow();
    SpreadsheetApp.flush();

    var ev = createEvent_(row, slot);
    if (ev) sh.getRange(rowIndex, C['ID події']).setValue(ev.getId());

    cache.put(key, String(n + 1), 3600);
    notifyStudio_(row);
    confirmClient_(row);

    var st = settings_();
    return json_({ ok: true, code: code, holdHours: st.holdHours, prepayment: st.prepaymentText });
  } finally {
    lock.releaseLock();
  }
}

/* ============================ ДОСТУПНІСТЬ ДАТ ============================= */

function availability_() {
  var st = settings_();
  var resources = readRows_(SHEET.resources).filter(function (r) { return r[0]; }).map(function (r) {
    return { id: String(r[0]).trim(), name: String(r[1]), slots: parseSlots_(r[2]), capacity: Math.max(0, Number(r[3]) || 0) };
  });
  var services = readRows_(SHEET.services).filter(function (r) { return r[0] && /^так/i.test(String(r[4])); }).map(function (r) {
    return { id: String(r[0]).trim(), name: String(r[1]), resource: String(r[2]).trim(), description: String(r[3] || '') };
  });
  var closed = {};
  readRows_(SHEET.closed).forEach(function (r) {
    var d = dateKey_(r[0]); if (!d) return;
    closed[d] = closed[d] || [];
    closed[d].push(String(r[1] || '').trim() || '*');
  });

  // зайняті місця
  var used = {};
  var now = new Date().getTime();
  readRows_(SHEET.bookings).forEach(function (r) {
    var status = String(r[C['Статус'] - 1]);
    var created = r[C['Створено'] - 1] instanceof Date ? r[C['Створено'] - 1].getTime() : 0;
    var holds = status === STATUS.CONFIRMED || status === STATUS.PAID || status === STATUS.DONE ||
      (status === STATUS.NEW && now - created < st.holdHours * 3600 * 1000);
    if (!holds) return;
    var svc = services.filter(function (s) { return s.name === r[C['Послуга'] - 1]; })[0];
    var resId = svc ? svc.resource : null;
    if (!resId) return;
    var slotName = String(r[C['Час'] - 1]).split(' ')[0];
    var k = dateKey_(r[C['Дата'] - 1]) + '|' + resId + '|' + slotName;
    used[k] = (used[k] || 0) + 1;
  });

  var days = {};
  var first = parseDate_(st.seasonFrom);
  var last = parseDate_(st.seasonTo);
  var minDate = new Date(); minDate.setHours(0, 0, 0, 0); minDate.setDate(minDate.getDate() + st.minDays);
  for (var d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    var key = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    var day = {};
    resources.forEach(function (res) {
      day[res.id] = {};
      var shut = d < minDate || (closed[key] && (closed[key].indexOf('*') >= 0 || closed[key].indexOf(res.id) >= 0));
      res.slots.forEach(function (s) {
        day[res.id][s.name] = shut ? 0 : Math.max(0, res.capacity - (used[key + '|' + res.id + '|' + s.name] || 0));
      });
    });
    days[key] = day;
  }

  return {
    ok: true,
    updated: new Date().toISOString(),
    season: { from: st.seasonFrom, to: st.seasonTo },
    holdHours: st.holdHours,
    resources: resources,
    services: services,
    days: days,
  };
}

/* ============================ СТАТУСИ Й ПОДІЇ ============================= */

/** Встановлюваний тригер: зміна статусу оновлює подію в календарі. */
function onStatusEdit(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET.bookings || e.range.getColumn() !== C['Статус'] || e.range.getRow() < 2) return;
  syncEvent_(sh, e.range.getRow());
}

/** Щогодини: нові заявки без підтвердження після N годин стають «прострочена». */
function expireHolds() {
  var st = settings_();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.bookings);
  var values = sh.getDataRange().getValues();
  var now = new Date().getTime();
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (r[C['Статус'] - 1] === STATUS.NEW && r[C['Створено'] - 1] instanceof Date &&
        now - r[C['Створено'] - 1].getTime() > st.holdHours * 3600 * 1000) {
      sh.getRange(i + 1, C['Статус']).setValue(STATUS.EXPIRED);
      syncEvent_(sh, i + 1);
    }
  }
}

function syncEvent_(sh, row) {
  var r = sh.getRange(row, 1, 1, COLS.length).getValues()[0];
  var id = r[C['ID події'] - 1];
  if (!id) return;
  var cal = getCalendar_();
  var ev;
  try { ev = cal.getEventById(id); } catch (err) { ev = null; }
  if (!ev) return;
  var status = r[C['Статус'] - 1];
  if (status === STATUS.CANCELLED || status === STATUS.EXPIRED) {
    ev.deleteEvent();
    sh.getRange(row, C['ID події']).setValue('');
    return;
  }
  ev.setTitle(eventTitle_(r));
  var colors = {};
  colors[STATUS.NEW] = CalendarApp.EventColor.YELLOW;
  colors[STATUS.CONFIRMED] = CalendarApp.EventColor.PALE_GREEN;
  colors[STATUS.PAID] = CalendarApp.EventColor.GREEN;
  colors[STATUS.DONE] = CalendarApp.EventColor.GRAY;
  if (colors[status]) ev.setColor(colors[status]);
}

function createEvent_(r, slot) {
  try {
    var cal = getCalendar_();
    var date = r[C['Дата'] - 1];
    var start = toDateTime_(date, slot.from);
    var end = toDateTime_(date, slot.to);
    var ev = cal.createEvent(eventTitle_(r), start, end, {
      location: r[C['Адреса'] - 1] || '',
      description: describe_(r),
    });
    ev.setColor(CalendarApp.EventColor.YELLOW);
    return ev;
  } catch (err) {
    console.error('calendar', err);
    return null;
  }
}

function eventTitle_(r) {
  return '[' + r[C['Статус'] - 1] + '] ' + r[C['Послуга'] - 1] + (r[C['Заклад / назва'] - 1] ? ' — ' + r[C['Заклад / назва'] - 1] : '') + ' · ' + r[C['Код'] - 1];
}

function describe_(r) {
  return [
    'Код: ' + r[C['Код'] - 1],
    'Час: ' + r[C['Час'] - 1],
    "Ім'я: " + r[C["Ім'я"] - 1],
    'Телефон: ' + String(r[C['Телефон'] - 1]).replace(/^'/, ''),
    'Telegram / Instagram: ' + (r[C['Telegram / Instagram'] - 1] || '—'),
    'Email: ' + (r[C['Email'] - 1] || '—'),
    'Заклад: ' + (r[C['Заклад / назва'] - 1] || '—'),
    'Адреса: ' + (r[C['Адреса'] - 1] || '—'),
    'Обсяг: ' + (r[C['Обсяг'] - 1] || '—'),
    'Бюджет: ' + (r[C['Бюджет'] - 1] || '—'),
    'Побажання: ' + (r[C['Побажання'] - 1] || '—'),
    'Референси: ' + (r[C['Референси'] - 1] || '—'),
  ].join('\n');
}

/* ============================== СПОВІЩЕННЯ ================================ */

function notifyStudio_(r) {
  var st = settings_();
  var text = 'Нова заявка ' + r[C['Код'] - 1] + '\n' + r[C['Послуга'] - 1] + ' · ' + r[C['Дата'] - 1] + ' · ' + r[C['Час'] - 1] + '\n\n' + describe_(r) +
    '\n\nДату тримаємо ' + st.holdHours + ' год. Підтвердьте статус у таблиці: ' + SpreadsheetApp.getActive().getUrl();
  if (st.notifyEmail) {
    try { MailApp.sendEmail(st.notifyEmail, 'Nectar: нова заявка ' + r[C['Код'] - 1] + ' на ' + r[C['Дата'] - 1], text); } catch (err) { console.error('mail', err); }
  }
  if (st.tgToken && st.tgChat) {
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + st.tgToken + '/sendMessage', {
        method: 'post', payload: { chat_id: st.tgChat, text: text }, muteHttpExceptions: true,
      });
    } catch (err) { console.error('telegram', err); }
  }
}

function confirmClient_(r) {
  var st = settings_();
  var email = r[C['Email'] - 1];
  if (!email || !/^так/i.test(st.confirmClient)) return;
  var body = [
    'Вітаємо! Ми отримали вашу заявку ' + r[C['Код'] - 1] + '.',
    '',
    'Послуга: ' + r[C['Послуга'] - 1],
    'Дата: ' + r[C['Дата'] - 1] + ', ' + r[C['Час'] - 1],
    '',
    'Ми тримаємо цю дату ' + st.holdHours + ' год і зв\'яжемося з вами в робочий час (щодня з 10 до 19), щоб узгодити деталі.',
    st.prepaymentText,
    '',
    'З любов\'ю, Nectar Flo Studio',
    'instagram.com/nectar.flostudio',
  ].join('\n');
  try { MailApp.sendEmail(email, 'Nectar Flo Studio: заявка ' + r[C['Код'] - 1], body, { name: 'Nectar Flo Studio' }); } catch (err) { console.error('client mail', err); }
}

/* ================================ ДОПОМІЖНЕ =============================== */

function settings_() {
  var map = {};
  readRows_(SHEET.settings).forEach(function (r) { map[String(r[0]).trim()] = r[1]; });
  return {
    seasonFrom: dateKey_(map['Сезон з']) || '2026-11-20',
    seasonTo: dateKey_(map['Сезон до']) || '2027-01-10',
    minDays: Number(map['Мінімум днів до дати']) || 0,
    holdHours: Number(map['Тримати нову заявку, год']) || 48,
    notifyEmail: String(map['Email для сповіщень'] || ''),
    calendarId: String(map['ID календаря'] || 'primary'),
    tgToken: String(map['Telegram bot token'] || ''),
    tgChat: String(map['Telegram chat id'] || ''),
    confirmClient: String(map['Лист-підтвердження клієнту'] || 'так'),
    prepaymentText: String(map['Текст про передоплату'] || ''),
  };
}

function validate_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return 'date';
  if (!d.service) return 'service';
  if (!d.slot) return 'slot';
  if (!d.name || String(d.name).trim().length < 2) return 'name';
  if (!/^[+\d][\d\s()\-]{8,}$/.test(String(d.phone || '').trim())) return 'phone';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return 'email';
  if (d.consent !== true) return 'consent';
  return null;
}

function newCode_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.bookings);
  var existing = sh.getLastRow() > 1 ? sh.getRange(2, C['Код'], sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  var code;
  do { code = 'NF-' + Math.floor(1000 + Math.random() * 9000); } while (existing.indexOf(code) >= 0);
  return code;
}

function getCalendar_() {
  var id = settings_().calendarId;
  return (id && id !== 'primary' && CalendarApp.getCalendarById(id)) || CalendarApp.getDefaultCalendar();
}

function parseSlots_(text) {
  var out = [];
  String(text || '').split(',').forEach(function (part) {
    var m = part.trim().match(/^(.+?)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
    if (m) out.push({ name: m[1].trim(), from: m[2], to: m[3] });
  });
  return out.length ? out : [{ name: 'день', from: '10:00', to: '19:00' }];
}

function dateKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/^'/, '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function parseDate_(key) { var p = key.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }

function toDateTime_(key, hhmm) {
  var p = key.split('-'), t = hhmm.split(':');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(t[0]), Number(t[1]));
}

function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, max); }

function readRows_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function ensureSheet_(ss, name, header, rows) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#f4c7d4');
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
  return sh;
}

function addStatusColors_(sh) {
  var range = sh.getRange(2, C['Статус'], sh.getMaxRows() - 1, 1);
  var colors = [[STATUS.NEW, '#fff2b3'], [STATUS.CONFIRMED, '#d8ecc4'], [STATUS.PAID, '#a8d58a'], [STATUS.DONE, '#e3e3e3'],
    [STATUS.CANCELLED, '#f4c7c7'], [STATUS.EXPIRED, '#f4c7c7']];
  sh.setConditionalFormatRules(colors.map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(c[0]).setBackground(c[1]).setRanges([range]).build();
  }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
