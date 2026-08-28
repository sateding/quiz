/* =========================================================
   ТЕСТОВИЙ РЕЖИМ
   ---------------------------------------------------------
   Вмикається адресою ?test — напр.
     https://sateding.github.io/quiz/?test

   Клієнти цього ніколи не побачать: без ?test панель
   не малюється, а цей файл нічого не робить.

   Заповнює всю анкету правдоподібними відповідями,
   щоб не клікати 70 екранів руками.
   ========================================================= */

(function () {
  'use strict';

  var MARK = 'ТЕСТ';

  /* Значення для поля: беремо підказку з placeholder («напр. 96» → «96»),
     інакше — за змістом назви. */
  function fieldValue(f) {
    var ph = String(f.placeholder || '');
    var m = ph.match(/^напр\.\s*(.+)$/i);
    if (m) return m[1].split(';')[0].trim();

    var id = String(f.id || '').toLowerCase();
    var label = String(f.label || '').toLowerCase();

    if (id === 'name'  || label.indexOf('імʼя') === 0 || label.indexOf('ім’я') === 0) return MARK + ' Клієнт';
    if (id === 'phone' || label.indexOf('телефон') > -1) return '+380 67 000 00 00';
    if (id === 'email' || label.indexOf('пошта') > -1)   return '';   /* щоб копія нікуди не пішла */
    if (id === 'address') return 'Київ, вул. Тестова, 1';
    if (id === 'area')    return '96';
    if (id === 'year')    return '2019';
    if (id === 'floor')   return '7 з 24';
    if (id === 'size')    return '3,4 × 4,8';

    if (ph) return ph.length > 60 ? ph.slice(0, 60) : ph;
    return 'тестове значення';
  }

  var LONG = 'Тестова відповідь для перевірки — цей текст згенеровано автоматично, ' +
             'щоб побачити, як довгий абзац виглядає у брифі та в листі.';

  function answerFor(q) {
    var opts = q.options || [];

    switch (q.type) {
      case 'single':
      case 'photoSingle':
        return opts.length ? opts[0].id : undefined;

      case 'multi':
      case 'photoMulti':
      case 'colors': {
        var n = Math.min(q.max || 3, opts.length);
        return opts.slice(0, n).map(function (o) { return o.id; });
      }

      case 'chips':
        return opts.slice(0, Math.min(4, opts.length));

      case 'text':
      case 'number':
        return fieldValue(q);

      case 'longtext':
        return LONG;

      case 'scale':
        return 35;

      case 'fields': {
        var v = {};
        (q.fields || []).forEach(function (f) { v[f.id] = fieldValue(f); });
        return v;
      }

      case 'repeater': {
        var row = {};
        (q.fields || []).forEach(function (f) { row[f.id] = fieldValue(f); });
        return [row];
      }

      default:
        return undefined;   /* upload заповнюємо окремо */
    }
  }

  /** Усі відповіді на всю анкету, з урахуванням умовних блоків. */
  function generate(all) {
    var answers = {};

    /* два проходи: після вибору приміщень зʼявляються нові екрани */
    for (var pass = 0; pass < 2; pass++) {
      all.forEach(function (q) {
        if (q.type === 'cover' || q.type === 'review' || q.type === 'upload') return;
        if (q.showIf && !q.showIf(answers)) return;
        if (answers[q.id] !== undefined) return;
        var v = answerFor(q);
        if (v !== undefined) answers[q.id] = v;
      });
    }

    /* контакти робимо помітними, щоб тестові листи було видно в пошті */
    answers.contacts = Object.assign({}, answers.contacts, {
      name: MARK + ' · автозаповнення',
      phone: '+380 67 000 00 00',
      email: '',
      prefer: 'Це тестова анкета, відповідати не потрібно'
    });

    return answers;
  }

  /** Невелика картинка-заглушка, щоб перевірити вкладення в листі. */
  function sampleFile() {
    var c = document.createElement('canvas');
    c.width = 900; c.height = 700;
    var g = c.getContext('2d');
    g.fillStyle = '#C2A24B'; g.fillRect(0, 0, 900, 700);
    g.fillStyle = '#17150F'; g.fillRect(60, 60, 780, 580);
    g.fillStyle = '#FBF9F6';
    g.font = '600 46px Arial';
    g.fillText('ТЕСТОВЕ ФОТО', 150, 360);
    g.font = '28px Arial';
    g.fillText(new Date().toLocaleString('uk-UA'), 150, 420);
    var dataUrl = c.toDataURL('image/jpeg', 0.8);
    return {
      name: 'test-reference.jpg',
      type: 'image/jpeg',
      size: Math.round((dataUrl.length - 22) * 0.75),
      dataUrl: dataUrl
    };
  }

  window.TESTDATA = { generate: generate, sampleFile: sampleFile, MARK: MARK };
})();
