/**
 * ============================================================
 *  Приймач анкети · Dina Titanova
 *  Тільки пошта. Ніяких таблиць і Диска.
 * ============================================================
 *
 *  ЩО ЦЕ РОБИТЬ
 *  Після заповнення анкети надсилає лист із брифом у PDF:
 *    · дизайнеру — на адресу SEND_TO, разом із фото-референсами;
 *    · клієнту   — на пошту, яку він вказав в анкеті, лише бриф.
 *  Нічого нікуди не зберігається.
 *
 *  ЯК ЗАПУСТИТИ (3 хвилини, один раз)
 *  1. Відкрити script.google.com → «Новий проєкт».
 *  2. Стерти те, що там є, і вставити цей файл цілком.
 *  3. Назвати проєкт, напр. «Анкета Dina Titanova». Ctrl+S.
 *  4. Розгорнути → Новий розгорток → шестерня ⚙ → Веб-застосунок.
 *       Виконувати від імені: Я
 *       Хто має доступ: Усі
 *     → Розгорнути → дозволити доступ (потрібен лише Gmail) → скопіювати URL.
 *  5. Вставити URL у js/config.js квіза, у поле endpoint.
 *
 *  ЯК ОНОВИТИ ПОТІМ
 *  Вставити новий код → Ctrl+S → Розгорнути → Керувати розгортками →
 *  олівець ✏ → Версія: Нова → Розгорнути. Адреса при цьому не міняється.
 * ============================================================
 */

/* ---------- Налаштування ---------- */

/** Куди надсилати заповнені анкети. */
var SEND_TO = 'nz@intop.dp.ua';

/** Надсилати копію брифу клієнту на пошту, яку він вказав в анкеті. */
var SEND_COPY_TO_CLIENT = true;

/** Підпис у листах. */
var STUDIO_NAME  = 'Dina Titanova · Interior Design';
var STUDIO_PHONE = '';
var STUDIO_SITE  = 'https://sateding.github.io/quiz/';

/** Логотип у шапці PDF. Береться з опублікованого сайту.
    Якщо переїдете на інший хостинг — поміняйте адресу. */
var LOGO_URL = 'https://sateding.github.io/quiz/img/logo.png';

/** Gmail не пропускає листи важчі за 25 МБ. Тримаємо запас. */
var MAX_ATTACH_MB = 20;


/* ============================================================
   Точка входу
   ============================================================ */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.kind === 'submission') return json(handleSubmission(body));

    /* старий фронтенд надсилав відповіді й файли окремо */
    if (body.kind === 'answers') return json(handleSubmission({ payload: body.payload, files: [] }));
    if (body.kind === 'file')    return json({ ok: true, skipped: 'Файли приймаються разом із відповідями' });

    return json({ ok: false, error: 'Невідомий тип запиту' });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'dt-quiz', mode: 'mail-only', time: new Date().toISOString() });
}


/* ============================================================
   Головне: зібрати PDF і надіслати
   ============================================================ */

function handleSubmission(body) {
  var payload = body.payload || {};
  var files   = body.files || [];

  /* PDF збирається в памʼяті — нічого нікуди не пишеться */
  var pdf = makePdfBlob(payload);

  /* Вкладення: спершу бриф, далі фото, поки не впираємось у ліміт Gmail */
  var attachments = [pdf];
  var bytes = pdf.getBytes().length;
  var limit = MAX_ATTACH_MB * 1024 * 1024;
  var dropped = 0;

  files.forEach(function (f) {
    var blob = toBlob(f);
    if (!blob) { dropped++; return; }
    if (bytes + blob.getBytes().length > limit) { dropped++; return; }
    bytes += blob.getBytes().length;
    attachments.push(blob);
  });

  var sent = sendMails(payload, attachments, dropped);

  return {
    ok: true,
    submissionId: payload.submissionId || '',
    sentTo: sent,
    attached: attachments.length,
    droppedFiles: dropped
  };
}

/** data:...;base64,... → Blob */
function toBlob(f) {
  try {
    var parts = String(f.dataUrl).split(',');
    var mime = (String(parts[0]).match(/data:([^;]+)/) || [])[1] || f.type || 'application/octet-stream';
    return Utilities.newBlob(Utilities.base64Decode(parts[1]), mime, f.name || 'file');
  } catch (err) {
    Logger.log('Файл не розібрався: ' + err);
    return null;
  }
}


/* ============================================================
   Листи
   ============================================================ */

function sendMails(payload, attachments, dropped) {
  var c = (payload.answers || {}).contacts || {};
  var readable = (payload.readable || []).filter(function (r) { return r.answer; });
  var brief = briefTable(readable);
  var sent = [];

  var note = dropped > 0
    ? '<p style="margin:14px 0 0;font-size:13px;color:#A4442F">' +
      'Частина фото не помістилася в лист (' + dropped + ' шт.) — ' +
      'попросіть клієнта надіслати їх окремо.</p>'
    : '';

  /* --- дизайнеру --- */
  if (SEND_TO) {
    try {
      MailApp.sendEmail({
        to: SEND_TO,
        subject: 'Нова анкета: ' + (c.name || 'без імені'),
        attachments: attachments,
        htmlBody:
          '<div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;color:#17150F">' +
            '<h2 style="font-weight:400;font-size:22px;margin:0 0 6px">Нова заповнена анкета</h2>' +
            '<p style="margin:0;color:#6E675C;font-size:14px">' +
              [c.name, c.phone, c.email, c.prefer].filter(String).map(escapeHtml).join(' · ') +
            '</p>' +
            '<p style="margin:14px 0 0;font-size:13px;color:#6E675C">' +
              'Бриф у вкладенні' +
              (attachments.length > 1 ? ' разом із ' + (attachments.length - 1) + ' фото-референсами' : '') +
              '.</p>' +
            note +
            brief +
          '</div>'
      });
      sent.push(SEND_TO);
    } catch (err) { Logger.log('Лист дизайнеру не пішов: ' + err); }
  }

  /* --- копія клієнту --- */
  if (SEND_COPY_TO_CLIENT && c.email && /.+@.+\..+/.test(c.email)) {
    try {
      MailApp.sendEmail({
        to: c.email,
        name: STUDIO_NAME,
        subject: 'Ваш бриф на дизайн-проєкт',
        attachments: [attachments[0]],      /* клієнту — лише бриф, свої фото він має */
        htmlBody:
          '<div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;color:#17150F">' +
            '<h2 style="font-weight:400;font-size:23px;margin:0 0 14px">' +
              escapeHtml(c.name ? c.name + ', дякуємо!' : 'Дякуємо!') + '</h2>' +
            '<p style="font-size:15px;line-height:1.6;color:#4A443B;margin:0 0 8px">' +
              'Ваші відповіді отримано. У вкладенні — бриф у PDF, нижче те саме текстом: ' +
              'перечитайте на свіжу голову, і якщо щось захочеться доповнити чи виправити, ' +
              'просто відповідайте на цей лист.' +
            '</p>' +
            '<p style="font-size:15px;line-height:1.6;color:#4A443B;margin:0 0 4px">' +
              'Найближчим часом ми звʼяжемося з вами, щоб домовитися про заміри ' +
              'та першу зустріч на обʼєкті.' +
            '</p>' +
            brief +
            '<p style="margin-top:26px;padding-top:14px;border-top:1px solid #E7E0D5;' +
                      'font-size:13px;color:#6E675C">' +
              escapeHtml(STUDIO_NAME) +
              (STUDIO_PHONE ? '<br>' + escapeHtml(STUDIO_PHONE) : '') +
              (STUDIO_SITE ? '<br><a href="' + STUDIO_SITE + '" style="color:#856A2C">' +
                             escapeHtml(STUDIO_SITE) + '</a>' : '') +
            '</p>' +
          '</div>'
      });
      sent.push(c.email);
    } catch (err) { Logger.log('Лист клієнту не пішов: ' + err); }
  }

  return sent;
}

/** Бриф таблицею «питання — відповідь», згрупований по розділах. */
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


/* ============================================================
   PDF-бриф (у памʼяті)
   ============================================================ */

function makePdfBlob(payload) {
  var c = (payload.answers || {}).contacts || {};
  var readable = (payload.readable || []).filter(function (r) { return r.answer; });

  var stamp = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');
  var human = Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM.yyyy');

  var rows = '';
  var section = null;
  readable.forEach(function (r) {
    if (r.section && r.section !== section) {
      section = r.section;
      rows += '<tr><td colspan="2" class="sec">' + escapeHtml(section) + '</td></tr>';
    }
    rows += '<tr><td class="q">' + escapeHtml(r.question) + '</td>' +
            '<td class="a">' + escapeHtml(r.answer).replace(/\n/g, '<br>') + '</td></tr>';
  });

  var html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#17150F;font-size:10pt;margin:0}' +
    'h1{font-family:Georgia,serif;font-size:21pt;font-weight:normal;margin:0 0 5px}' +
    '.head{border-bottom:2px solid #C2A24B;padding-bottom:12px;margin-bottom:6px}' +
    '.logo{height:46px}' +
    '.meta{color:#666;font-size:9.5pt;margin:0}' +
    '.date{color:#999;font-size:9pt;margin:3px 0 0}' +
    'table.b{width:100%;border-collapse:collapse}' +
    'td{vertical-align:top}' +
    'td.sec{font-size:8.5pt;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;' +
      'color:#856A2C;padding:18px 0 5px;border-bottom:1px solid #DDD5C8}' +
    'td.q{width:38%;color:#666;font-size:9pt;padding:6px 14px 6px 0;' +
      'border-bottom:1px solid #F0EBE2;line-height:1.35}' +
    'td.a{font-size:9.5pt;padding:6px 0;border-bottom:1px solid #F0EBE2;line-height:1.4}' +
    '.foot{margin-top:26px;padding-top:9px;border-top:1px solid #DDD5C8;' +
      'color:#999;font-size:8pt;letter-spacing:1.2px;text-transform:uppercase}' +
    '</style></head><body>' +

      '<table class="head" width="100%"><tr>' +
        '<td width="150"><img class="logo" src="' + LOGO_URL + '" alt="' + escapeHtml(STUDIO_NAME) + '"></td>' +
        '<td>' +
          '<h1>Бриф на дизайн-проєкт</h1>' +
          '<p class="meta">' +
            escapeHtml([c.name, c.phone, c.email].filter(String).join(' · ') || 'Контакти не вказано') +
          '</p>' +
          '<p class="date">' + human + '</p>' +
        '</td>' +
      '</tr></table>' +

      '<table class="b">' + rows + '</table>' +
      '<div class="foot">' + escapeHtml(STUDIO_NAME) + '</div>' +
    '</body></html>';

  return Utilities.newBlob(html, 'text/html', 'brief.html')
                  .getAs('application/pdf')
                  .setName('Бриф · ' + (c.name || 'без імені') + ' · ' + stamp + '.pdf');
}


/* ============================================================
   Службове
   ============================================================ */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
