/* Deux sessions, dix repas
   Tout le contenu vient de contenu.json — rien n'est écrit en dur ici.
   Les identifiants de coche (s1, d4, m2, a17, r3, t7-soir…) sont ceux du fichier
   et ne doivent pas changer : ce sont les clés de l'état sauvegardé. */
(function () {
  'use strict';

  /* ==========================================================
     Aides
     ========================================================== */
  var NS = 'http://www.w3.org/2000/svg';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function add(parent, tag, cls, text) {
    var n = el(tag, cls, text);
    parent.appendChild(n);
    return n;
  }
  function icon(shapes) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    shapes.forEach(function (sh) {
      var e = document.createElementNS(NS, sh.t);
      Object.keys(sh).forEach(function (k) { if (k !== 't') e.setAttribute(k, sh[k]); });
      s.appendChild(e);
    });
    return s;
  }
  var clockIcon = function () { return icon([{ t: 'circle', cx: 12, cy: 12, r: 9 }, { t: 'path', d: 'M12 7v5l3 2' }]); };
  var crossIcon = function () { return icon([{ t: 'path', d: 'M6 6l12 12M18 6 6 18' }]); };

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* Les grammages, durées et températures passent en chiffres monospacés,
     comme dans la maquette de référence. */
  var QTY = /\d+(?:[.,]\d+)?\s*h(?:\s*\d+)?(?![\p{L}])|\d+\s*(?:grosses?\s+)?c\.\s*à\s*[sc]\.|\d+(?:[.,]\d+)?\s*(?:°C|kg|ml|cl|min|cm|g|L|s|%|€)(?![\p{L}])/gu;

  function quantified(text) {
    var frag = document.createDocumentFragment();
    var last = 0, m;
    QTY.lastIndex = 0;
    while ((m = QTY.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(el('span', 'q', m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  /* ==========================================================
     Persistance — localStorage, toujours sous try/catch :
     en navigation privée l'accès peut échouer, l'app doit continuer.
     ========================================================== */
  var KEY = 'batchcooking-app-v1';
  var TABKEY = 'batchcooking-tab-v1';
  var TIMERKEY = 'batchcooking-timers-v1';
  var TRACKKEY = 'batchcooking-track-start-v1';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* l'app marche sans */ }
  }

  var state = read(KEY, {});
  if (typeof state !== 'object' || Array.isArray(state)) state = {};

  function persist() { write(KEY, state); }

  /* ==========================================================
     Groupes de cases à cocher
     ========================================================== */
  var groups = {};
  function group(name) {
    if (!groups[name]) groups[name] = { boxes: [] };
    return groups[name];
  }

  function checkbox(key, name, label) {
    var cb = el('input');
    cb.type = 'checkbox';
    cb.dataset.k = key;
    cb.dataset.group = name;
    if (label) cb.setAttribute('aria-label', label);
    cb.addEventListener('change', function () {
      if (cb.checked) state[key] = true; else delete state[key];
      if (name === 'track') markTrackStart();
      render();
      persist();
    });
    group(name).boxes.push(cb);
    return cb;
  }

  function bar(parent, name, one, many, resetLabel) {
    var b = add(parent, 'div', 'bar');
    var counter = add(b, 'span', 'counter');
    var btn = add(b, 'button', 'btn', resetLabel);
    btn.type = 'button';

    var armedTimer = null;
    function disarm() {
      btn.dataset.armed = '';
      btn.classList.remove('btn-accent');
      btn.textContent = resetLabel;
    }
    btn.addEventListener('click', function () {
      if (btn.dataset.armed === '1') {
        clearTimeout(armedTimer);
        disarm();
        group(name).boxes.forEach(function (cb) { delete state[cb.dataset.k]; });
        render();
        persist();
        announce('Remis à zéro.');
        return;
      }
      btn.dataset.armed = '1';
      btn.classList.add('btn-accent');
      btn.textContent = 'Confirmer ?';
      armedTimer = setTimeout(disarm, 4000);
    });

    var g = group(name);
    g.counter = counter;
    g.words = [one, many];
    return b;
  }

  function render() {
    Object.keys(groups).forEach(function (name) {
      var g = groups[name], n = 0;
      g.boxes.forEach(function (cb) {
        var on = !!state[cb.dataset.k];
        cb.checked = on;
        if (on) n++;
        var li = cb.closest('li');
        if (li) li.classList.toggle('done', on);
      });
      if (g.counter) {
        var total = g.boxes.length;
        g.counter.textContent = '';
        g.counter.appendChild(el('b', null, String(n)));
        g.counter.appendChild(document.createTextNode(
          ' / ' + total + ' ' + (n > 1 ? g.words[1] : g.words[0]) + (g.extra || '')
        ));
      }
      if (g.gauge) g.gauge.style.width = (g.boxes.length ? (n / g.boxes.length) * 100 : 0) + '%';
    });

    var today = trackDayIndex();
    $$('.tracker .tr').forEach(function (tr) {
      var cbs = $$('input', tr);
      tr.classList.toggle('full', cbs.length > 0 && cbs.every(function (c) { return c.checked; }));
      tr.classList.toggle('is-today', Number(tr.dataset.day) === today);
    });
  }

  /* ==========================================================
     Suivi des 14 jours — J1 est le jour de la première coche
     ========================================================== */
  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function markTrackStart() {
    if (read(TRACKKEY, null)) return;
    var any = group('track').boxes.some(function (cb) { return !!state[cb.dataset.k]; });
    if (any) write(TRACKKEY, dateKey(new Date()));
  }
  function trackDayIndex() {
    var s = read(TRACKKEY, null);
    if (!s) return 0;
    var start = new Date(s + 'T00:00:00');
    if (isNaN(start)) return 0;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var n = Math.round((now - start) / 86400000) + 1;
    return n >= 1 && n <= 14 ? n : 0;
  }

  /* ==========================================================
     Minuteurs — plusieurs en parallèle, calculés sur l'horloge
     pour survivre à la mise en arrière-plan de l'iPhone.
     ========================================================== */
  var timers = read(TIMERKEY, []);
  if (!Array.isArray(timers)) timers = [];
  timers.forEach(function (t) { if (Date.now() >= t.endsAt) t.rung = true; });

  var tray = null, ticker = null, audioCtx = null;

  var DUR = /(\d+(?:[.,]\d+)?)\s*(min|s|h)(?![\p{L}])/gu;
  function durations(text) {
    var out = [], m;
    DUR.lastIndex = 0;
    while ((m = DUR.exec(text)) !== null) {
      var n = parseFloat(m[1].replace(',', '.'));
      var sec = m[2] === 'h' ? n * 3600 : m[2] === 'min' ? n * 60 : n;
      if (sec >= 30 && sec <= 7200 && out.indexOf(sec) === -1) out.push(sec);
    }
    return out;
  }
  function humanDur(sec) {
    if (sec % 3600 === 0 && sec >= 3600) return (sec / 3600) + ' h';
    if (sec % 60 === 0) return (sec / 60) + ' min';
    return sec + ' s';
  }
  function clock(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function unlockAudio() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && C) audioCtx = new C();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* pas de son, le visuel suffit */ }
  }
  function ring() {
    try {
      if (audioCtx) {
        var t0 = audioCtx.currentTime;
        for (var i = 0; i < 3; i++) {
          var o = audioCtx.createOscillator(), g = audioCtx.createGain(), at = t0 + i * 0.42;
          o.type = 'sine';
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
          o.connect(g); g.connect(audioCtx.destination);
          o.start(at); o.stop(at + 0.34);
        }
      }
    } catch (e) { /* ignore */ }
    try { if (navigator.vibrate) navigator.vibrate([200, 120, 200]); } catch (e) { /* ignore */ }
  }

  function startTimer(label, sec) {
    unlockAudio();
    timers.push({
      id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: label,
      sec: sec,
      endsAt: Date.now() + sec * 1000,
      rung: false
    });
    write(TIMERKEY, timers);
    drawTimers();
    tick();
    announce('Minuteur lancé : ' + label + ', ' + humanDur(sec) + '.');
  }
  function dropTimer(id) {
    timers = timers.filter(function (t) { return t.id !== id; });
    write(TIMERKEY, timers);
    drawTimers();
  }

  function drawTimers() {
    if (!tray) return;
    tray.textContent = '';
    tray.hidden = timers.length === 0;
    document.body.classList.toggle('has-timers', timers.length > 0);

    timers.slice().sort(function (a, b) { return a.endsAt - b.endsAt; }).forEach(function (t) {
      var left = t.endsAt - Date.now();
      var done = left <= 0;
      var row = add(tray, 'div', 'timer' + (done ? ' ring' : ''));
      add(row, 'span', 'tm', done ? '00:00' : clock(left));
      add(row, 'span', 'nm', done ? t.label + ' — terminé' : t.label);
      var x = add(row, 'button', 'x');
      x.type = 'button';
      x.setAttribute('aria-label', (done ? 'Effacer' : 'Arrêter') + ' le minuteur ' + t.label);
      x.appendChild(crossIcon());
      x.addEventListener('click', function () { dropTimer(t.id); });
    });

    var h = timers.length ? tray.offsetHeight : 0;
    document.documentElement.style.setProperty('--tray-h', h + 'px');
  }

  function tick() {
    if (ticker) return;
    ticker = setInterval(function () {
      var changed = false;
      timers.forEach(function (t) {
        if (!t.rung && Date.now() >= t.endsAt) {
          t.rung = true;
          changed = true;
          ring();
          announce(t.label + " : c'est prêt.");
        }
      });
      if (changed) write(TIMERKEY, timers);
      drawTimers();
      if (timers.length === 0) { clearInterval(ticker); ticker = null; }
    }, 1000);
  }

  /* ==========================================================
     Annonces pour les lecteurs d'écran
     ========================================================== */
  var live = null;
  function announce(msg) { if (live) live.textContent = msg; }

  /* ==========================================================
     Rendu
     ========================================================== */
  function head(parent, tag, title, intro) {
    var h = add(parent, 'div', 'block-head');
    if (title) add(h, tag, null, title);
    if (intro) add(h, 'p', null, intro);
    return h;
  }
  function block(parent) { return add(parent, 'div', 'block'); }

  var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  function formatDate(d) {
    try {
      return cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d));
    } catch (e) { return ''; }
  }

  /* ---------- Semaine ---------- */
  function renderSemaine(panel, d, go) {
    var T = d.textes;
    var now = new Date();
    var dow = now.getDay();
    var jour = JOURS[dow];
    var weekend = dow === 0 || dow === 6;

    /* Aujourd'hui — le bloc qui supprime la dernière décision */
    var card = add(panel, 'div', 'today');
    var top = add(card, 'div', 'today-top');
    add(top, 'span', 'lbl', T.aujourdhui.label);
    add(top, 'span', 'date', formatDate(now));
    var list = add(card, 'div', 'today-list');

    function item(when, what, note) {
      var row = add(list, 'div', 'today-item');
      add(row, 'span', 'when', when);
      add(row, 'span', 'what', what);
      if (note) add(row, 'span', 'note', note);
    }

    var pdj = d.petitsDejeuners.filter(function (p) { return p.jour === jour; })[0]
      || d.petitsDejeuners.filter(function (p) { return p.jour === 'Week-end'; })[0];
    if (pdj) item(T.aujourdhui.petitDejeuner, pdj.titre, pdj.duree + ' · ' + pdj.proteines + ' de protéines');

    var session = null;
    if (weekend) {
      session = d.sessions.filter(function (s) { return s.jour === jour; })[0];
      if (session) item('Session', session.jour + ' en cuisine, ' + session.duree, session.sousTitre);
    } else {
      var j = d.semaine.filter(function (x) { return x.jour === jour; })[0];
      if (j) {
        item(T.aujourdhui.midi, j.midi.plat, j.midi.note);
        item(T.aujourdhui.soir, j.soir.plat, j.soir.note);
      }
    }
    d.collations.forEach(function (c) { item(c.moment, c.quoi); });

    var cta = add(card, 'div', 'today-cta');
    if (session) {
      var b1 = add(cta, 'button', 'btn btn-accent', T.aujourdhui.sessionCta);
      b1.type = 'button';
      b1.addEventListener('click', function () { go('cuisiner'); });
    }
    var b2 = add(cta, 'button', 'btn', T.aujourdhui.secoursCta);
    b2.type = 'button';
    b2.addEventListener('click', function () { go('secours'); });

    /* Les dix repas */
    var b = block(panel);
    head(b, 'h2', T.semaine.titreRepas, T.semaine.introRepas);
    var stack = add(b, 'div', 'stack');

    function dayRow(name, meals, isToday) {
      var row = add(stack, 'div', 'day-row' + (isToday ? ' is-today' : ''));
      var n = add(row, 'div', 'name');
      add(n, 'span', null, name);
      if (isToday) add(n, 'span', 'flag', "aujourd'hui");
      var m = add(row, 'div', 'meals');
      meals.forEach(function (meal) {
        var c = add(m, 'div', 'meal');
        add(c, 'span', 'when', meal[0]);
        add(c, 'span', 'what', meal[1]);
        if (meal[2]) add(c, 'span', 'note', meal[2]);
      });
    }

    d.semaine.forEach(function (x) {
      dayRow(x.jour, [
        ['Midi', x.midi.plat, x.midi.note],
        ['Soir', x.soir.plat, x.soir.note]
      ], x.jour === jour);
    });
    dayRow(T.semaine.nomCollations, d.collations.map(function (c) { return [c.moment, c.quoi]; }), false);

    /* Les six petits-déjeuners */
    var b2b = block(panel);
    head(b2b, 'h2', T.semaine.titrePetitsDejeuners, T.semaine.introPetitsDejeuners);
    var stack2 = add(b2b, 'div', 'stack');
    d.petitsDejeuners.forEach(function (p) {
      var isToday = p.jour === jour || (weekend && p.jour === 'Week-end');
      var row = add(stack2, 'div', 'day-row' + (isToday ? ' is-today' : ''));
      var n = add(row, 'div', 'name');
      add(n, 'span', null, p.jour + ' · ' + p.tags.join(', ') + ' · ' + p.duree);
      if (isToday) add(n, 'span', 'flag', "aujourd'hui");
      var meals = add(row, 'div', 'meals');
      var c = add(meals, 'div', 'meal');
      add(c, 'span', 'when', p.titre);
      add(c, 'span', 'what', p.texte);
      add(c, 'span', 'note', p.proteines + ' de protéines' + (p.note ? ' — ' + p.note : ''));
    });

    /* Ajustements */
    var b3 = block(panel);
    head(b3, 'h2', T.semaine.titreAjustements);
    var rules = add(b3, 'div', 'rules');
    d.ajustements.forEach(function (a) {
      var r = add(rules, 'div');
      add(r, 'span', 'r-k', a.cle);
      add(r, 'span', 'r-v', a.texte);
    });
  }

  /* ---------- Cuisiner ---------- */
  function renderCuisiner(panel, d) {
    var T = d.textes;

    var b0 = block(panel);
    head(b0, 'h2', d.briques.titre, d.briques.intro);
    var bricks = add(b0, 'div', 'bricks');
    d.briques.familles.forEach(function (f) {
      var x = add(bricks, 'div', 'brick');
      add(x, 'span', 'k', f.cle);
      add(x, 'span', 'v', f.valeur);
    });

    var b1 = block(panel);
    head(b1, 'h2', T.cuisiner.titreSessions, T.cuisiner.introSessions);

    d.sessions.forEach(function (s) {
      var name = 'cuisine-' + s.id;
      bar(b1, name, 'étape faite', 'étapes faites', 'Réinitialiser');

      var card = add(b1, 'div', 'card');
      var top = add(card, 'div', 'card-top');
      add(top, 'span', 'title', s.jour);
      add(top, 'span', 'meta', s.duree);
      add(top, 'span', 'sub', s.sousTitre);
      add(top, 'span', 'sub', 'Matériel : ' + s.materiel);

      var ol = add(card, 'ol', 'run');
      s.etapes.forEach(function (st, i) {
        var li = add(ol, 'li');
        li.appendChild(checkbox(st.id, name, 'Étape ' + (i + 1) + ' de ' + s.jour));
        add(li, 'span', 't', st.t);

        var body = add(li, 'span', 's');
        if (st.titre) {
          var strong = el('strong');
          strong.appendChild(quantified(st.titre + '.'));
          body.appendChild(strong);
          body.appendChild(document.createTextNode(' '));
        }
        body.appendChild(quantified(st.texte));
        if (st.note) add(body, 'em', null, st.note);

        var durs = durations((st.titre ? st.titre + ' ' : '') + st.texte);
        if (durs.length) {
          var wrap = add(li, 'div', 'timers');
          durs.forEach(function (sec) {
            var btn = add(wrap, 'button', 't-start');
            btn.type = 'button';
            btn.appendChild(clockIcon());
            btn.appendChild(document.createTextNode(humanDur(sec)));
            var label = st.titre || (s.jour + ', étape ' + (i + 1));
            btn.setAttribute('aria-label', 'Lancer un minuteur de ' + humanDur(sec) + ' — ' + label);
            btn.addEventListener('click', function () { startTimer(label, sec); });
          });
        }
      });

      var y = add(card, 'div', 'yield');
      add(y, 'span', 'lbl', T.cuisiner.labelRendu);
      add(y, 'span', 'txt', s.rendu);
    });

    var b2 = block(panel);
    head(b2, 'h2', T.cuisiner.titreConservation, T.cuisiner.introConservation);
    var rules = add(b2, 'div', 'rules');
    d.conservation.forEach(function (c) {
      var r = add(rules, 'div');
      add(r, 'span', 'r-k', c.cle);
      add(r, 'span', 'r-v', c.regle);
    });
  }

  /* ---------- Courses ---------- */
  function renderCourses(panel, d) {
    var T = d.textes;
    head(panel, 'h2', T.courses.titre, T.courses.intro);

    ['materiel', 'placard', 'semaine'].forEach(function (key, i) {
      var sec = d.courses[key];
      var g = add(panel, 'div', 'shop-group');
      var label = add(g, 'div', 'group-label');
      add(label, 'h3', null, (i + 1) + ' · ' + sec.titre);
      add(label, 'span', null, sec.intro);

      bar(g, 'courses-' + key, 'coché', 'cochés', 'Tout décocher');

      var aisles = add(g, 'div', 'aisles');
      sec.rayons.forEach(function (rayon) {
        var a = add(aisles, 'div', 'aisle');
        add(a, 'h4', null, rayon.nom);
        var ul = add(a, 'ul');
        rayon.articles.forEach(function (art) {
          var li = add(ul, 'li');
          var cb = checkbox(art.id, 'courses-' + key);
          cb.id = 'art-' + art.id;
          li.appendChild(cb);
          var lb = add(li, 'label', null, art.texte);
          lb.setAttribute('for', 'art-' + art.id);
        });
      });
    });

    var b = block(panel);
    head(b, 'h3', T.courses.titrePoudre, T.courses.introPoudre);
    var where = add(b, 'div', 'where');
    d.ouAcheter.forEach(function (o) {
      var w = add(where, 'div', 'w');
      var h = add(w, 'div', 'w-h');
      add(h, 'h4', null, o.nom);
      if (o.prix) add(h, 'span', 'px', o.prix);
      add(w, 'p', null, o.texte);
      if (o.source) {
        var p = add(w, 'p');
        var a = add(p, 'a', null, o.source.replace(/^https?:\/\//, '').split('/')[0]);
        a.href = o.source;
        a.rel = 'noreferrer';
        a.target = '_blank';
      }
    });
  }

  /* ---------- Secours ---------- */
  function renderSecours(panel, d) {
    var T = d.textes;
    var b = block(panel);
    head(b, 'h2', T.secours.titre, d.secours.intro);
    var grid = add(b, 'div', 'rescue');
    d.secours.plats.forEach(function (p) {
      var c = add(grid, 'div', 'rq');
      var top = add(c, 'div', 'rq-top');
      add(top, 'span', 'rq-t', p.duree);
      add(top, 'span', 'rq-p', p.proteines);
      add(c, 'h4', null, p.titre);
      add(c, 'p', 'rq-d', p.texte);
    });

    var b2 = block(panel);
    head(b2, 'h3', T.secours.titrePlacard, T.secours.introPlacard);
    var bricks = add(b2, 'div', 'bricks');
    ['frigo', 'placard', 'congelateur'].forEach(function (k) {
      var x = add(bricks, 'div', 'brick');
      add(x, 'span', 'k', T.secours.labels[k]);
      add(x, 'span', 'v', cap(d.secours.placardMinimum[k].join(', ')));
    });
  }

  /* ---------- Objectif ---------- */
  function renderObjectif(panel, d) {
    var T = d.textes, O = d.objectif, S = O.suivi;

    var b0 = block(panel);
    head(b0, 'h2', O.titre, O.realite);
    var callout = add(b0, 'div', 'callout');
    add(callout, 'span', 'lbl', T.objectif.labelMesure);
    add(callout, 'p', null, O.mesure);

    var b1 = block(panel);
    head(b1, 'h3', T.objectif.titreLeviers, O.surplusVise);
    var lever = add(b1, 'div', 'lever');
    O.leviers.forEach(function (l) {
      var r = add(lever, 'div');
      add(r, 'span', 'l-t', l.texte);
      add(r, 'span', 'l-k', '+ ' + l.kcal + ' kcal');
    });
    add(b1, 'p', 'prose', O.leviersNote);

    var b2 = block(panel);
    head(b2, 'h3', T.objectif.titreSuivi, T.objectif.introSuivi);
    bar(b2, 'track', 'repas', 'repas', 'Réinitialiser');
    group('track').extra = ' · cible ' + S.cible;

    var gauge = add(b2, 'div', 'gauge');
    group('track').gauge = add(gauge, 'i');
    var mark = add(gauge, 'u');
    mark.style.left = (S.cible / S.total) * 100 + '%';
    mark.title = 'Cible : ' + S.cible;

    var tracker = add(b2, 'div', 'tracker');
    var th = add(tracker, 'div', 'th');
    add(th, 'span', null, T.objectif.colonneJour);
    S.colonnes.forEach(function (c) { add(th, 'span', null, c); });

    for (var day = 1; day <= S.jours; day++) {
      var tr = add(tracker, 'div', 'tr');
      tr.dataset.day = String(day);
      add(tr, 'span', 'd', 'J' + day);
      S.colonnes.forEach(function (col) {
        var cell = add(tr, 'span', 'c');
        cell.appendChild(checkbox('t' + tr.dataset.day + '-' + col, 'track', 'Jour ' + tr.dataset.day + ', ' + col));
      });
    }
    add(b2, 'p', 'prose', S.note);

    add(panel, 'div', 'foot', T.foot);
  }

  /* ==========================================================
     Onglets
     ========================================================== */
  function setupTabs() {
    var tabs = $$('.tabbar button');
    function go(name) {
      tabs.forEach(function (t) {
        var on = t.dataset.tab === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById('p-' + t.dataset.tab);
        if (p) p.hidden = !on;
      });
      write(TABKEY, name);
      window.scrollTo(0, 0);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { go(t.dataset.tab); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n;
        if (k === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (k === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length;
        else if (k === 'Home') n = 0;
        else if (k === 'End') n = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[n].focus();
        go(tabs[n].dataset.tab);
      });
    });
    return go;
  }

  /* ==========================================================
     Démarrage
     ========================================================== */
  function measureBar() {
    var bar = $('.tabbar');
    if (bar) document.documentElement.style.setProperty('--tabbar-h', bar.offsetHeight + 'px');
  }

  function build(d) {
    document.title = d.meta.titre;
    $('#masthead-eyebrow').textContent = d.meta.utilisatrice
      ? d.meta.utilisatrice + ' · ' + d.textes.eyebrow
      : d.textes.eyebrow;
    $('#masthead-title').textContent = d.meta.titre;
    $('#masthead-accroche').textContent = d.textes.accroche;

    var go = setupTabs();
    renderSemaine($('#p-semaine'), d, go);
    renderCuisiner($('#p-cuisiner'), d);
    renderCourses($('#p-courses'), d);
    renderSecours($('#p-secours'), d);
    renderObjectif($('#p-objectif'), d);

    $('#boot').hidden = true;
    $('.tabbar').hidden = false;
    $('#shell').hidden = false;

    render();

    var saved = read(TABKEY, null);
    if (saved && document.getElementById('p-' + saved)) go(saved);

    measureBar();
    drawTimers();
    if (timers.length) tick();

    window.addEventListener('resize', function () { measureBar(); drawTimers(); });
  }

  function fail() {
    var boot = $('#boot');
    boot.textContent = '';
    add(boot, 'p', null, "Impossible de lire contenu.json.");
    var p = add(boot, 'p');
    p.appendChild(document.createTextNode("L'application doit être servie par un serveur web, pas ouverte directement depuis le Finder. En local : "));
    p.appendChild(el('code', null, 'python3 -m http.server 8000'));
    p.appendChild(document.createTextNode(' puis http://localhost:8000.'));
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    live = $('#live');
    tray = $('#timer-tray');
    fetch('contenu.json')
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .catch(function () {
        /* Repli : contenu embarqué dans la page, pour les hébergements
           où la lecture d'un fichier voisin est refusée. */
        var n = document.getElementById('contenu-inline');
        if (!n) throw new Error('contenu.json illisible');
        return JSON.parse(n.textContent);
      })
      .then(build)
      .catch(fail);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Service worker — mise en cache complète pour le hors-ligne.
     Il exige HTTPS (ou localhost) : sans ça on s'abstient simplement. */
  window.addEventListener('load', function () {
    if (!('serviceWorker' in navigator)) return;
    var ok = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!ok) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* l'app marche sans */ });
  });
})();
