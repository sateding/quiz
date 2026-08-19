/**
 * ============================================================
 *  Приймач анкети · Dina Titanova
 * ============================================================
 *
 *  ЩО ЦЕ РОБИТЬ
 *  1. Записує кожну відповідь новим рядком у таблицю.
 *  2. Складає фото-референси в окрему папку клієнта на Drive.
 *  3. Надсилає повний бриф дизайнеру.
 *  4. Надсилає копію брифу клієнту на вказану ним пошту.
 *
 *  ЯК ЗАПУСТИТИ (5 хвилин, один раз)
 *  1. Відкрити таблицю «Анкети клієнтів · Dina Titanova».
 *  2. Розширення → Apps Script.
 *  3. Стерти те, що там є, і вставити цей файл цілком.
 *  4. Угорі вписати свій email у NOTIFY_EMAIL.
 *  5. Зберегти (Ctrl+S).
 *  6. Розгорнути → Новий розгорток → шестерня → Веб-застосунок.
 *       Виконувати від імені: Я
 *       Хто має доступ: Усі
 *     → Розгорнути → дозволити доступ → скопіювати URL.
 *  7. Вставити цей URL у js/config.js квіза, у поле endpoint.
 *
 *  ВАЖЛИВО: після кожної зміни цього коду треба зробити
 *  Розгорнути → Керувати розгортками → олівець → Версія: Нова → Розгорнути.
 *  Інакше зміни не застосуються.
 * ============================================================
 */

/* ---------- Налаштування ---------- */

/** Куди складати фото-референси. Уже створена папка «Референси клієнтів». */
var FOLDER_ID = '12Qmtc9Oc3tNRRwMs9Fhwde3Wf0WGPohh';

/** Пошта дизайнера — сюди приходить повний бриф і посилання. Порожньо — не надсилати. */
var NOTIFY_EMAIL = '';

/** Надсилати копію брифу клієнту на пошту, яку він вказав в анкеті. */
var SEND_COPY_TO_CLIENT = true;

/** Підпис у листі клієнту. */
var STUDIO_NAME  = 'Dina Titanova · Interior Design';
var STUDIO_PHONE = '';
var STUDIO_SITE  = '';

/** Назва аркуша з відповідями. */
var SHEET_NAME = 'Анкети';


/* ============================================================
   Точка входу
   ============================================================ */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.kind === 'file') return json(saveFile(body));
    return json(saveAnswers(body.payload));

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'dt-quiz', time: new Date().toISOString() });
}


/* ============================================================
   Відповіді → рядок у таблиці
   ============================================================ */

function saveAnswers(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  var readable = payload.readable || [];

  /* Заголовки: службові колонки + по колонці на кожне питання.
     Якщо в анкету додали нові питання — колонки дописуються самі. */
  var head = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    : [];

  if (!head.length) {
    head = ['Дата', 'ID анкети', 'Ім’я', 'Телефон', 'Email', 'Папка з фото'];
    sheet.getRange(1, 1, 1, head.length).setValues([head]);
  }

  /* додаємо колонки для нових питань */
  var added = false;
  readable.forEach(function (r) {
    if (head.indexOf(r.question) === -1) { head.push(r.question); added = true; }
  });
  if (added) sheet.getRange(1, 1, 1, head.length).setValues([head]);

  var a = payload.answers || {};
  var c = a.contacts || {};
  var folderUrl = ensureFolder(payload.submissionId, c.name).getUrl();

  var byQuestion = {};
  readable.forEach(function (r) { byQuestion[r.question] = r.answer; });

  var row = head.map(function (col) {
    switch (col) {
      case 'Дата': return new Date(payload.submittedAt || Date.now());
      case 'ID анкети': return payload.submissionId || '';
      case 'Ім’я': return c.name || '';
      case 'Телефон': return c.phone || '';
      case 'Email': return c.email || '';
      case 'Папка з фото': return folderUrl;
      default: return byQuestion[col] || '';
    }
  });

  sheet.appendRow(row);

  /* трохи косметики, щоб таблицею можна було користуватися */
  var r1 = sheet.getRange(1, 1, 1, head.length);
  r1.setFontWeight('bold').setBackground('#F5F1EA').setVerticalAlignment('top').setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 64);

  notify(payload, folderUrl);

  return { ok: true, submissionId: payload.submissionId, folderUrl: folderUrl };
}


/* ============================================================
   Файл → папка клієнта на Drive
   ============================================================ */

function saveFile(body) {
  var folder = ensureFolder(body.submissionId, body.client);
  var f = body.file;
  var parts = String(f.dataUrl).split(',');
  var meta = parts[0] || '';
  var data = parts[1] || '';
  var mime = (meta.match(/data:([^;]+)/) || [])[1] || f.type || 'application/octet-stream';

  var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, f.name);
  var file = folder.createFile(blob);

  return { ok: true, url: file.getUrl(), folderUrl: folder.getUrl() };
}

/** Папка клієнта: «2026-08-18 · Олена Коваль (q1abc)». Створюється один раз. */
function ensureFolder(submissionId, clientName) {
  var root = DriveApp.getFolderById(FOLDER_ID);
  var tag = '(' + (submissionId || 'без-id') + ')';

  var it = root.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(tag) !== -1) return f;
  }
  var stamp = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');
  var name = stamp + ' · ' + (clientName || 'Без імені') + ' ' + tag;
  return root.createFolder(name);
}


/* ============================================================
   Лист дизайнеру
   ============================================================ */

function notify(payload, folderUrl) {
  var a = payload.answers || {};
  var c = a.contacts || {};
  var readable = (payload.readable || []).filter(function (r) { return r.answer; });
  var brief = briefTable(readable);

  /* --- лист дизайнеру --- */
  if (NOTIFY_EMAIL) {
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'Нова анкета: ' + (c.name || 'без імені'),
        htmlBody:
          '<div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;color:#17150F">' +
            '<h2 style="font-weight:400;font-size:22px;margin:0 0 6px">Нова заповнена анкета</h2>' +
            '<p style="margin:0;color:#6E675C;font-size:14px">' +
              [c.name, c.phone, c.email, c.prefer].filter(String).map(escapeHtml).join(' · ') +
            '</p>' +
            '<p style="margin:18px 0 6px;font-size:14px">' +
              '<a href="' + folderUrl + '">Папка з референсами</a> · ' +
              '<a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">Таблиця з усіма анкетами</a>' +
            '</p>' +
            brief +
          '</div>'
      });
    } catch (err) { Logger.log('Лист дизайнеру не пішов: ' + err); }
  }

  /* --- копія клієнту --- */
  if (SEND_COPY_TO_CLIENT && c.email && /.+@.+\..+/.test(c.email)) {
    try {
      MailApp.sendEmail({
        to: c.email,
        name: STUDIO_NAME,
        subject: 'Ваш бриф на дизайн-проєкт',
        htmlBody:
          '<div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;color:#17150F">' +
            '<h2 style="font-weight:400;font-size:23px;margin:0 0 14px">' +
              escapeHtml(c.name ? c.name + ', дякуємо!' : 'Дякуємо!') + '</h2>' +
            '<p style="font-size:15px;line-height:1.6;color:#4A443B;margin:0 0 8px">' +
              'Ваші відповіді отримано. Нижче — копія брифу: перечитайте на свіжу голову, ' +
              'і якщо щось захочеться доповнити чи виправити, просто відповідайте на цей лист.' +
            '</p>' +
            '<p style="font-size:15px;line-height:1.6;color:#4A443B;margin:0 0 4px">' +
              'Найближчим часом ми зв\'яжемося з вами, щоб домовитися про заміри ' +
              'та першу зустріч на об\'єкті.' +
            '</p>' +
            brief +
            '<p style="margin-top:26px;padding-top:14px;border-top:1px solid #E7E0D5;' +
                      'font-size:13px;color:#6E675C">' +
              escapeHtml(STUDIO_NAME) +
              (STUDIO_PHONE ? '<br>' + escapeHtml(STUDIO_PHONE) : '') +
              (STUDIO_SITE ? '<br>' + escapeHtml(STUDIO_SITE) : '') +
            '</p>' +
          '</div>'
      });
    } catch (err) { Logger.log('Лист клієнту не пішов: ' + err); }
  }
}

/** Бриф у вигляді таблиці «питання — відповідь», згрупованої по розділах. */
function briefTable(readable) {
  var html = '<table style="border-collapse:collapse;width:100%;margin-top:20px">';
  var section = null;

  readable.forEach(function (r) {
    if (r.section && r.section !== section) {
      section = r.section;
      html += '<tr><td colspan="2" style="padding:20px 0 7px">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:.16em;' +
                          'text-transform:uppercase;color:#856A2C;' +
                          'border-bottom:1px solid #E7E0D5;padding-bottom:6px">' +
                escapeHtml(section) + '</div></td></tr>';
    }
    html += '<tr>' +
      '<td style="padding:7px 16px 7px 0;color:#6E675C;font-size:13px;' +
                 'vertical-align:top;width:38%;line-height:1.4">' + escapeHtml(r.question) + '</td>' +
      '<td style="padding:7px 0;font-size:14px;vertical-align:top;line-height:1.45">' +
        escapeHtml(r.answer).replace(/\n/g, '<br>') + '</td></tr>';
  });

  return html + '</table>';
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/* ============================================================
   Службове
   ============================================================ */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
