/* ==========================================================
   Calvin Airlines Inc. - Flight Ticketing System (front-end prototype)
   script.js

   Contents
   1.  Configuration and sample flight data
   2.  Small helpers (dates, money, text safety)
   3.  Storage (localStorage with safe loading)
   4.  Pricing and seat rules
   5.  UI helpers (toasts, dialogs, form errors)
   6.  Routing (hash based views)
   7.  Flights view
   8.  Booking form (seat map, summary, validation, submit)
   9.  Confirmation / ticket view
   10. Records view (search, view, edit, cancel, delete)
   11. Import / export / sample data
   12. Start-up
   ========================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. CONFIGURATION AND SAMPLE FLIGHT DATA (all fictional)
     ---------------------------------------------------------- */
  var STORAGE_KEY = 'calvinAirlines.bookings.v1';
  var MAX_PAX = 6;                 // maximum passengers per booking
  var MAX_ADVANCE_DAYS = 180;      // how far ahead a flight can be booked
  var VAT_RATE = 0.12;             // 12% VAT
  var BOOKING_FEE = 150;           // per ticket, in pesos
  var BUSINESS_MULTIPLIER = 2;     // business seats cost 2x the base fare
  var SEAT_ROWS = 12;
  var BUSINESS_ROWS = 3;           // rows 1-3 are business class
  var SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var STATUSES = ['Confirmed', 'Checked-In', 'Completed', 'Cancelled'];
  var PAYMENT_METHODS = [
    'Credit/Debit Card (simulated)',
    'E-wallet (simulated)',
    'Pay at airport counter (simulated)'
  ];

  var AIRPORTS = {
    MNL: 'Manila',
    CEB: 'Cebu',
    DVO: 'Davao',
    ILO: 'Iloilo',
    KLO: 'Kalibo',
    SIN: 'Singapore'
  };

  // JSON-style sample data describing the daily flight schedule
  var FLIGHTS = [
    { code: 'CA101', from: 'MNL', to: 'CEB', depart: '06:00', arrive: '07:25', price: 2850, aircraft: 'Airbus A320' },
    { code: 'CA102', from: 'CEB', to: 'MNL', depart: '08:15', arrive: '09:40', price: 2850, aircraft: 'Airbus A320' },
    { code: 'CA201', from: 'MNL', to: 'DVO', depart: '07:30', arrive: '09:35', price: 3650, aircraft: 'Airbus A321' },
    { code: 'CA202', from: 'DVO', to: 'MNL', depart: '10:30', arrive: '12:35', price: 3650, aircraft: 'Airbus A321' },
    { code: 'CA301', from: 'MNL', to: 'ILO', depart: '09:00', arrive: '10:15', price: 2450, aircraft: 'ATR 72-600' },
    { code: 'CA302', from: 'ILO', to: 'MNL', depart: '11:00', arrive: '12:15', price: 2450, aircraft: 'ATR 72-600' },
    { code: 'CA401', from: 'CEB', to: 'DVO', depart: '13:00', arrive: '14:10', price: 2200, aircraft: 'ATR 72-600' },
    { code: 'CA601', from: 'MNL', to: 'KLO', depart: '14:30', arrive: '15:50', price: 2990, aircraft: 'Airbus A320' },
    { code: 'CA801', from: 'MNL', to: 'SIN', depart: '08:00', arrive: '11:50', price: 9800, aircraft: 'Airbus A330' },
    { code: 'CA802', from: 'SIN', to: 'MNL', depart: '13:30', arrive: '17:15', price: 9800, aircraft: 'Airbus A330' }
  ];

  var ALL_SEATS = [];
  for (var r = 1; r <= SEAT_ROWS; r++) {
    for (var l = 0; l < SEAT_LETTERS.length; l++) { ALL_SEATS.push(r + SEAT_LETTERS[l]); }
  }

  /* ----------------------------------------------------------
     2. SMALL HELPERS
     ---------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toDateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return toDateStr(new Date()); }
  function addDays(dateStr, n) {
    var p = dateStr.split('-').map(Number);
    return toDateStr(new Date(p[0], p[1] - 1, p[2] + n));
  }
  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) { return false; }
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function formatDate(s) {
    var p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-PH', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }
  function nowTimeStr() { var n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()); }
  function hasDeparted(flight, dateStr) {
    var t = todayStr();
    return dateStr < t || (dateStr === t && flight.depart <= nowTimeStr());
  }

  var moneyFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
  function money(n) { return moneyFmt.format(n); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function getFlight(code) {
    for (var i = 0; i < FLIGHTS.length; i++) { if (FLIGHTS[i].code === code) { return FLIGHTS[i]; } }
    return null;
  }
  function duration(f) {
    var a = f.depart.split(':').map(Number);
    var b = f.arrive.split(':').map(Number);
    var mins = (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]);
    return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }
  function cityName(code) { return AIRPORTS[code] || code; }
  function routeText(f) { return f.from + ' → ' + f.to; }
  function statusClass(status) { return 'status--' + String(status).toLowerCase(); }
  function str(v, max) { return (typeof v === 'string' ? v : '').trim().slice(0, max || 80); }

  var PLANE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.500V19l-2 1.500V22l3.500-1 3.500 1v-1.500L13 19v-5.500z"/></svg>';

  /* ----------------------------------------------------------
     3. STORAGE
     ---------------------------------------------------------- */
  var bookings = [];

  // Validate and normalise one stored booking. Returns null if unusable.
  function sanitizeBooking(b) {
    if (!b || typeof b !== 'object') { return null; }
    var flight = getFlight(b.flightCode);
    if (!flight) { return null; }
    if (typeof b.ref !== 'string' || !/^[A-Z0-9-]{6,30}$/.test(b.ref)) { return null; }
    if (!isValidDateStr(b.date)) { return null; }
    if (!Array.isArray(b.passengers) || b.passengers.length < 1 || b.passengers.length > MAX_PAX) { return null; }

    var seen = {};
    var passengers = [];
    for (var i = 0; i < b.passengers.length; i++) {
      var p = b.passengers[i];
      if (!p || typeof p.name !== 'string' || ALL_SEATS.indexOf(p.seat) === -1 || seen[p.seat]) { return null; }
      seen[p.seat] = true;
      passengers.push({ name: str(p.name, 60), seat: p.seat });
    }

    var c = b.contact && typeof b.contact === 'object' ? b.contact : {};
    var totals = calcTotals(flight, passengers.map(function (x) { return x.seat; }));
    var created = typeof b.createdAt === 'string' && !isNaN(Date.parse(b.createdAt)) ? b.createdAt : new Date().toISOString();
    var updated = typeof b.updatedAt === 'string' && !isNaN(Date.parse(b.updatedAt)) ? b.updatedAt : created;

    return {
      ref: b.ref,
      flightCode: flight.code,
      date: b.date,
      passengers: passengers,
      contact: { name: str(c.name, 60), email: str(c.email, 80), phone: str(c.phone, 20) },
      payment: PAYMENT_METHODS.indexOf(b.payment) !== -1 ? b.payment : PAYMENT_METHODS[0],
      totals: totals,
      status: STATUSES.indexOf(b.status) !== -1 ? b.status : 'Confirmed',
      createdAt: created,
      updatedAt: updated
    };
  }

  function loadBookings() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); }
    catch (e) { toast('Browser storage is unavailable. Bookings will not be kept after you leave this page.', 'warning'); return []; }
    if (!raw) { return []; }

    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { throw new Error('Stored data is not a list'); }
      var seenRefs = {};
      var valid = [];
      parsed.forEach(function (item) {
        var clean = sanitizeBooking(item);
        if (clean && !seenRefs[clean.ref]) { seenRefs[clean.ref] = true; valid.push(clean); }
      });
      if (valid.length !== parsed.length) {
        toast((parsed.length - valid.length) + ' damaged saved record(s) were skipped.', 'warning');
      }
      return valid;
    } catch (err) {
      // Keep a backup of the unreadable data, then start clean so the interface still works.
      try {
        window.localStorage.setItem(STORAGE_KEY + '.backup', raw);
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e2) { /* ignore */ }
      toast('Saved data could not be read, so the booking list was reset. A backup copy was kept.', 'warning');
      return [];
    }
  }

  function saveBookings() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
      return true;
    } catch (e) {
      toast('Could not save to browser storage (it may be full or blocked).', 'error');
      return false;
    }
  }

  function findBooking(ref) {
    for (var i = 0; i < bookings.length; i++) { if (bookings[i].ref === ref) { return bookings[i]; } }
    return null;
  }

  function newReference() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var datePart = todayStr().replace(/-/g, '');
    var ref;
    do {
      var code = '';
      for (var i = 0; i < 4; i++) {
        var n = window.crypto && window.crypto.getRandomValues
          ? window.crypto.getRandomValues(new Uint32Array(1))[0]
          : Math.floor(Math.random() * 4294967296);
        code += chars.charAt(n % chars.length);
      }
      ref = 'CAL-' + datePart + '-' + code;
    } while (findBooking(ref));
    return ref;
  }

  /* ----------------------------------------------------------
     4. PRICING AND SEAT RULES
     ---------------------------------------------------------- */
  function seatRow(seat) { return parseInt(seat, 10); }
  function seatClass(seat) { return seatRow(seat) <= BUSINESS_ROWS ? 'Business' : 'Economy'; }
  function seatFare(flight, seat) { return flight.price * (seatClass(seat) === 'Business' ? BUSINESS_MULTIPLIER : 1); }
  function calcTotals(flight, seats) {
    var fare = seats.reduce(function (sum, s) { return sum + seatFare(flight, s); }, 0);
    var vat = round2(fare * VAT_RATE);
    var fee = BOOKING_FEE * seats.length;
    return { fare: fare, vat: vat, fee: fee, total: round2(fare + vat + fee) };
  }

  // Seats that are already taken for a flight on a date (cancelled bookings free their seats)
  function reservedSeats(flightCode, date, ignoreRef) {
    var set = {};
    bookings.forEach(function (b) {
      if (b.flightCode === flightCode && b.date === date && b.status !== 'Cancelled' && b.ref !== ignoreRef) {
        b.passengers.forEach(function (p) { set[p.seat] = true; });
      }
    });
    return set;
  }
  function countKeys(o) { return Object.keys(o).length; }

  /* ----------------------------------------------------------
     5. UI HELPERS
     ---------------------------------------------------------- */
  function toast(message, type) {
    var region = $('toastRegion');
    if (!region) { return; }
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    var text = document.createElement('span');
    text.textContent = message;
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss message');
    close.innerHTML = '&times;';
    close.addEventListener('click', function () { el.remove(); });
    el.appendChild(text);
    el.appendChild(close);
    region.appendChild(el);
    while (region.children.length > 4) { region.removeChild(region.firstChild); }
    setTimeout(function () { if (el.parentNode) { el.remove(); } }, type === 'error' || type === 'warning' ? 7000 : 4500);
  }

  function openDialog(dlg) {
    if (typeof dlg.showModal === 'function') { dlg.showModal(); } else { dlg.setAttribute('open', ''); }
  }
  function closeDialog(dlg, value) {
    if (typeof dlg.close === 'function') { dlg.close(value); } else { dlg.removeAttribute('open'); }
  }

  // Asks the user to confirm. Resolves true (confirmed) or false (cancelled).
  function confirmAction(opts) {
    return new Promise(function (resolve) {
      var dlg = $('confirmDialog');
      if (typeof dlg.showModal !== 'function') { resolve(window.confirm(opts.message)); return; }
      $('confirmTitle').textContent = opts.title;
      $('confirmMessage').textContent = opts.message;
      var ok = $('confirmOk');
      ok.textContent = opts.okLabel || 'Confirm';
      ok.className = 'btn ' + (opts.danger ? 'btn--danger' : 'btn--primary');
      $('confirmCancel').textContent = opts.cancelLabel || 'Keep it';
      dlg.returnValue = '';
      function cleanup() {
        dlg.removeEventListener('close', onClose);
        dlg.removeEventListener('click', onBackdrop);
        ok.removeEventListener('click', onOk);
        $('confirmCancel').removeEventListener('click', onCancel);
      }
      function onClose() { var accepted = dlg.returnValue === 'ok'; cleanup(); resolve(accepted); }
      function onOk() { dlg.close('ok'); }
      function onCancel() { dlg.close('cancel'); }
      function onBackdrop(e) { if (e.target === dlg) { dlg.close('cancel'); } }
      dlg.addEventListener('close', onClose);
      dlg.addEventListener('click', onBackdrop);
      ok.addEventListener('click', onOk);
      $('confirmCancel').addEventListener('click', onCancel);
      dlg.showModal();
      $('confirmCancel').focus();   // safest default for destructive actions
    });
  }

  // Form error helpers: each field has a sibling element with id "<fieldId>-error"
  function setError(input, message) {
    var out = $(input.id + '-error');
    if (out) { out.textContent = message || ''; }
    if (message) { input.setAttribute('aria-invalid', 'true'); } else { input.removeAttribute('aria-invalid'); }
  }
  function clearErrors(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('.field-error'), function (el) { el.textContent = ''; });
    Array.prototype.forEach.call(scope.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
  }

  // Field validators return an error message, or '' when the value is fine.
  var NAME_RE = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\s.'\-]{1,59}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^(\+63|0)9\d{9}$/;

  function vName(value, emptyMsg) {
    var v = value.trim();
    if (!v) { return emptyMsg; }
    if (!NAME_RE.test(v)) { return 'Use 2 to 60 letters only (spaces, periods, hyphens and apostrophes are allowed).'; }
    return '';
  }
  function vEmail(value) {
    var v = value.trim();
    if (!v) { return 'Enter an email address.'; }
    if (!EMAIL_RE.test(v)) { return 'Enter a valid email address, for example name@example.com.'; }
    return '';
  }
  function vPhone(value) {
    var v = value.trim();
    if (!v) { return 'Enter a mobile number.'; }
    if (!PHONE_RE.test(v.replace(/[\s()\-]/g, ''))) { return 'Enter a Philippine mobile number such as 0917 123 4567 or +63 917 123 4567.'; }
    return '';
  }

  // Runs a validator on an input, shows its message and records the first invalid field.
  function check(input, message, state) {
    setError(input, message);
    if (message) { state.count++; if (!state.first) { state.first = input; } }
  }

  /* ----------------------------------------------------------
     6. ROUTING (hash based views)
     ---------------------------------------------------------- */
  var VIEWS = ['home', 'flights', 'book', 'confirmation', 'records', 'about'];
  var TITLES = {
    home: 'Home', flights: 'Flights', book: 'Book a Ticket',
    confirmation: 'Booking Confirmation', records: 'My Bookings', about: 'About / Help'
  };
  var firstRoute = true;

  function route() {
    var hash = window.location.hash.replace(/^#/, '');
    var parts = hash.split('/');
    var view = VIEWS.indexOf(parts[0]) !== -1 ? parts[0] : 'home';
    var param = parts[1] ? decodeURIComponent(parts[1]) : '';

    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== view; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      var active = a.getAttribute('data-nav') === view || (view === 'confirmation' && a.getAttribute('data-nav') === 'records');
      if (active) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    document.title = TITLES[view] + ' | Calvin Airlines Inc.';
    $('siteNav').classList.remove('is-open');
    $('navToggle').setAttribute('aria-expanded', 'false');

    if (view === 'home') { renderStats(); }
    if (view === 'flights') { renderFlights(); }
    if (view === 'book') { prepareBookingView(param); }
    if (view === 'confirmation') { renderTicket(param); }
    if (view === 'records') { renderRecords(); }

    if (!firstRoute) {
      window.scrollTo(0, 0);
      var heading = document.querySelector('#view-' + view + ' h1');
      if (heading) { heading.focus({ preventScroll: true }); }
    }
    firstRoute = false;
  }

  function renderStats() {
    var today = todayStr();
    var active = bookings.filter(function (b) { return b.status !== 'Cancelled'; });
    var upcoming = active.filter(function (b) { return b.date >= today && b.status !== 'Completed'; });
    var value = active.reduce(function (s, b) { return s + b.totals.total; }, 0);
    $('statTotal').textContent = active.length;
    $('statUpcoming').textContent = upcoming.length;
    $('statRevenue').textContent = money(value);
    $('statCancelled').textContent = bookings.length - active.length;
  }

  /* ----------------------------------------------------------
     7. FLIGHTS VIEW
     ---------------------------------------------------------- */
  function populateAirportSelect(select) {
    Object.keys(AIRPORTS).forEach(function (code) {
      var o = document.createElement('option');
      o.value = code;
      o.textContent = AIRPORTS[code] + ' (' + code + ')';
      select.appendChild(o);
    });
  }

  function renderFlights() {
    var dateInput = $('filterDate');
    var date = dateInput.value;
    var from = $('filterFrom').value;
    var to = $('filterTo').value;
    var sort = $('filterSort').value;

    var dateError = '';
    if (!isValidDateStr(date)) { dateError = 'Choose a valid travel date.'; }
    else if (date < todayStr()) { dateError = 'Travel date cannot be in the past.'; }
    else if (date > addDays(todayStr(), MAX_ADVANCE_DAYS)) { dateError = 'Flights can be booked up to ' + MAX_ADVANCE_DAYS + ' days ahead.'; }
    setError(dateInput, dateError);
    var list = $('flightList');
    var count = $('flightsCount');
    var empty = $('flightsEmpty');

    if (dateError) {
      list.innerHTML = '';
      count.textContent = '';
      empty.hidden = true;
      return;
    }

    var results = FLIGHTS.filter(function (f) {
      return (!from || f.from === from) && (!to || f.to === to);
    });
    results.sort(function (a, b) {
      if (sort === 'price') { return a.price - b.price || a.depart.localeCompare(b.depart); }
      if (sort === 'code') { return a.code.localeCompare(b.code); }
      return a.depart.localeCompare(b.depart);
    });

    empty.hidden = results.length > 0;
    count.textContent = results.length
      ? 'Showing ' + results.length + ' of ' + FLIGHTS.length + ' flights for ' + formatDate(date)
      : '';

    list.innerHTML = results.map(function (f) {
      var left = ALL_SEATS.length - countKeys(reservedSeats(f.code, date));
      var departed = hasDeparted(f, date);
      var seatsClass = left === 0 ? 'is-none' : (left <= 10 ? 'is-low' : '');
      var seatsText = departed ? 'This flight has already departed' : (left === 0 ? 'Sold out' : left + ' seats left');
      var action = departed || left === 0
        ? '<button class="btn btn--outline" type="button" disabled>Unavailable</button>'
        : '<a class="btn btn--primary" href="#book/' + esc(f.code) + '" aria-label="Select flight ' + esc(f.code) + ', ' + esc(cityName(f.from)) + ' to ' + esc(cityName(f.to)) + '">Select flight</a>';
      return '<article class="flight-card' + (departed ? ' is-departed' : '') + '">' +
        '<div><p class="flight-code">' + esc(f.code) + ' &middot; ' + esc(f.aircraft) + '</p>' +
        '<div class="route">' +
        '<div><strong>' + esc(f.depart) + '</strong><span>' + esc(cityName(f.from)) + ' (' + esc(f.from) + ')</span></div>' +
        '<div class="route-mid"><div class="route-line">' + PLANE_SVG + '</div><small>' + esc(duration(f)) + '</small></div>' +
        '<div><strong>' + esc(f.arrive) + '</strong><span>' + esc(cityName(f.to)) + ' (' + esc(f.to) + ')</span></div>' +
        '</div></div>' +
        '<div class="flight-meta"><p class="price">' + money(f.price) + '<small>per passenger, Economy</small></p>' +
        '<p class="seats-left ' + seatsClass + '">' + esc(seatsText) + '</p>' + action + '</div>' +
        '</article>';
    }).join('');
  }

  /* ----------------------------------------------------------
     8. BOOKING FORM
     ---------------------------------------------------------- */
  var selectedSeats = [];   // seats chosen on the seat map, in the order selected
  var paxCount = 1;         // last valid passenger count

  function populateBookingSelects() {
    var fs = $('flightSelect');
    FLIGHTS.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f.code;
      o.textContent = f.code + ' · ' + cityName(f.from) + ' (' + f.from + ') to ' + cityName(f.to) + ' (' + f.to + ') · ' + f.depart;
      fs.appendChild(o);
    });
    var pm = $('paymentMethod');
    PAYMENT_METHODS.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      pm.appendChild(o);
    });
  }

  function prepareBookingView(flightCode) {
    if (flightCode && getFlight(flightCode)) {
      var changed = $('flightSelect').value !== flightCode;
      $('flightSelect').value = flightCode;
      var chosenDate = $('filterDate').value;
      if (isValidDateStr(chosenDate) && chosenDate >= todayStr()) { $('travelDate').value = chosenDate; }
      if (changed) { selectedSeats = []; }
      setError($('flightSelect'), '');
    }
    refreshBooking();
  }

  function paxFieldHtml(prefix, i, value, seat) {
    return '<div class="field">' +
      '<label for="' + prefix + '-' + i + '">Passenger ' + (i + 1) + ' full name <span class="req" aria-hidden="true">*</span>' +
      '<span class="seat-tag" data-seat-tag="' + i + '">' + (seat ? 'Seat ' + esc(seat) : 'Seat not chosen') + '</span></label>' +
      '<input type="text" id="' + prefix + '-' + i + '" maxlength="60" autocomplete="off" required value="' + esc(value) + '" aria-describedby="' + prefix + '-' + i + '-error">' +
      '<p class="field-error" id="' + prefix + '-' + i + '-error" aria-live="polite"></p></div>';
  }

  function currentPaxValues(prefix, n) {
    var values = [];
    for (var i = 0; i < n; i++) { var el = $(prefix + '-' + i); values.push(el ? el.value : ''); }
    return values;
  }

  function renderPaxInputs() {
    var container = $('paxFields');
    var old = currentPaxValues('pax', 6);
    var html = '';
    for (var i = 0; i < paxCount; i++) { html += paxFieldHtml('pax', i, old[i] || '', selectedSeats[i]); }
    container.innerHTML = html;
  }

  function syncSeatTags() {
    Array.prototype.forEach.call(document.querySelectorAll('#paxFields [data-seat-tag]'), function (tag) {
      var seat = selectedSeats[Number(tag.getAttribute('data-seat-tag'))];
      tag.textContent = seat ? 'Seat ' + seat : 'Seat not chosen';
    });
  }

  function renderSeatMap() {
    var flight = getFlight($('flightSelect').value);
    var date = $('travelDate').value;
    var map = $('seatMap');

    if (!flight || !isValidDateStr(date)) {
      selectedSeats = [];
      map.innerHTML = '';
      $('seatHint').textContent = 'Select a flight and travel date to see the seat map.';
      return;
    }

    var reserved = reservedSeats(flight.code, date);
    selectedSeats = selectedSeats.filter(function (s) { return !reserved[s]; });
    $('seatHint').textContent = 'Tap a seat to select it. Choose ' + paxCount + ' seat' + (paxCount > 1 ? 's' : '') +
      ' (one per passenger). ' + (ALL_SEATS.length - countKeys(reserved)) + ' of ' + ALL_SEATS.length + ' seats are available.';

    var html = '<div class="seat-row seat-row--head" aria-hidden="true"><span></span><span>A</span><span>B</span><span>C</span><span></span><span>D</span><span>E</span><span>F</span></div>';
    for (var row = 1; row <= SEAT_ROWS; row++) {
      if (row === 1) { html += '<p class="cabin-label">Business cabin (rows 1–3)</p>'; }
      if (row === BUSINESS_ROWS + 1) { html += '<p class="cabin-label">Economy cabin (rows 4–' + SEAT_ROWS + ')</p>'; }
      html += '<div class="seat-row" role="group" aria-label="Row ' + row + '"><span class="row-label" aria-hidden="true">' + row + '</span>';
      for (var i = 0; i < SEAT_LETTERS.length; i++) {
        if (i === 3) { html += '<span aria-hidden="true"></span>'; }
        var seat = row + SEAT_LETTERS[i];
        var cls = seatClass(seat);
        var taken = !!reserved[seat];
        var chosen = selectedSeats.indexOf(seat) !== -1;
        var state = taken ? 'reserved' : (chosen ? 'selected' : 'available');
        html += '<button type="button" class="seat seat--' + cls.toLowerCase() + (chosen ? ' is-selected' : '') + '" data-seat="' + seat + '"' +
          ' aria-pressed="' + chosen + '"' + (taken ? ' disabled' : '') +
          ' aria-label="Seat ' + seat + ', ' + cls + ', ' + money(seatFare(flight, seat)) + ', ' + state + '">' + seat + '</button>';
      }
      html += '</div>';
    }
    map.innerHTML = html;
  }

  // Update the look of seat buttons without rebuilding the map (keeps keyboard focus)
  function syncSeatButtons() {
    var flight = getFlight($('flightSelect').value);
    Array.prototype.forEach.call($('seatMap').querySelectorAll('.seat'), function (btn) {
      var seat = btn.getAttribute('data-seat');
      var chosen = selectedSeats.indexOf(seat) !== -1;
      btn.classList.toggle('is-selected', chosen);
      btn.setAttribute('aria-pressed', String(chosen));
      if (flight && !btn.disabled) {
        btn.setAttribute('aria-label', 'Seat ' + seat + ', ' + seatClass(seat) + ', ' + money(seatFare(flight, seat)) + ', ' + (chosen ? 'selected' : 'available'));
      }
    });
  }

  function toggleSeat(seat) {
    var idx = selectedSeats.indexOf(seat);
    if (idx !== -1) {
      selectedSeats.splice(idx, 1);
    } else {
      if (selectedSeats.length >= paxCount) {
        toast('You already selected ' + paxCount + ' seat' + (paxCount > 1 ? 's' : '') + '. Deselect a seat or increase the number of passengers.', 'warning');
        return;
      }
      selectedSeats.push(seat);
    }
    $('seatError').textContent = '';
    syncSeatButtons();
    syncSeatTags();
    updateSummary();
  }

  function updateSummary() {
    var flight = getFlight($('flightSelect').value);
    var date = $('travelDate').value;
    $('sumFlight').textContent = flight ? flight.code + ' · ' + routeText(flight) + ' · ' + flight.depart : 'Not selected';
    $('sumDate').textContent = isValidDateStr(date) ? formatDate(date) : 'Not selected';
    $('sumSeats').textContent = selectedSeats.length ? selectedSeats.join(', ') : 'None selected';
    $('seatCounter').textContent = 'Seats selected: ' + selectedSeats.length + ' of ' + paxCount;

    var lines = $('sumLines');
    if (flight && selectedSeats.length) {
      lines.innerHTML = selectedSeats.map(function (s) {
        return '<div><span>Seat ' + esc(s) + ' (' + seatClass(s) + ')</span><span>' + money(seatFare(flight, s)) + '</span></div>';
      }).join('');
    } else {
      lines.innerHTML = '';
    }
    var t = flight ? calcTotals(flight, selectedSeats) : { fare: 0, vat: 0, fee: 0, total: 0 };
    $('sumFare').textContent = money(t.fare);
    $('sumVat').textContent = money(t.vat);
    $('sumFee').textContent = money(t.fee);
    $('sumTotal').textContent = money(t.total);
  }

  function refreshBooking() {
    renderSeatMap();
    renderPaxInputs();
    updateSummary();
  }

  function setPaxCountFromInput() {
    var input = $('paxCount');
    var raw = input.value.trim();
    var n = Number(raw);
    if (raw === '' || !/^\d+$/.test(raw) || n < 1 || n > MAX_PAX) {
      setError(input, 'Passengers must be a whole number from 1 to ' + MAX_PAX + '.');
      return false;
    }
    setError(input, '');
    if (n !== paxCount) {
      var values = currentPaxValues('pax', 6);
      paxCount = n;
      if (selectedSeats.length > paxCount) {
        selectedSeats = selectedSeats.slice(0, paxCount);
        toast('Extra seats were deselected to match ' + paxCount + ' passenger' + (paxCount > 1 ? 's' : '') + '.', 'warning');
      }
      var html = '';
      for (var i = 0; i < paxCount; i++) { html += paxFieldHtml('pax', i, values[i] || '', selectedSeats[i]); }
      $('paxFields').innerHTML = html;
      syncSeatButtons();
      $('seatHint').textContent = $('seatHint').textContent.replace(/Choose \d+ seats?/, 'Choose ' + paxCount + ' seat' + (paxCount > 1 ? 's' : ''));
      updateSummary();
    }
    return true;
  }

  // Validate the whole booking form. Returns { ok, first, count }.
  function validateBooking() {
    var form = $('bookingForm');
    clearErrors(form);
    var state = { count: 0, first: null };

    var flightEl = $('flightSelect');
    var flight = getFlight(flightEl.value);
    check(flightEl, flight ? '' : 'Select a flight.', state);

    var dateEl = $('travelDate');
    var date = dateEl.value;
    var dateMsg = '';
    if (!date) { dateMsg = 'Select a travel date.'; }
    else if (!isValidDateStr(date)) { dateMsg = 'Enter a valid date.'; }
    else if (date < todayStr()) { dateMsg = 'Travel date cannot be in the past.'; }
    else if (date > addDays(todayStr(), MAX_ADVANCE_DAYS)) { dateMsg = 'Flights can be booked up to ' + MAX_ADVANCE_DAYS + ' days ahead.'; }
    else if (flight && hasDeparted(flight, date)) { dateMsg = 'This flight has already departed today. Choose a later date or another flight.'; }
    check(dateEl, dateMsg, state);

    var paxEl = $('paxCount');
    var paxRaw = paxEl.value.trim();
    var paxN = Number(paxRaw);
    var paxMsg = (!/^\d+$/.test(paxRaw) || paxN < 1 || paxN > MAX_PAX) ? 'Passengers must be a whole number from 1 to ' + MAX_PAX + '.' : '';
    check(paxEl, paxMsg, state);

    // Seats: right quantity and not already reserved (checked against fresh saved records)
    var seatMsg = '';
    if (flight && isValidDateStr(date) && !paxMsg) {
      var reserved = reservedSeats(flight.code, date);
      var conflicts = selectedSeats.filter(function (s) { return reserved[s]; });
      if (selectedSeats.length === 0) { seatMsg = 'Select ' + paxN + ' seat' + (paxN > 1 ? 's' : '') + ' on the seat map.'; }
      else if (selectedSeats.length !== paxN) { seatMsg = 'You selected ' + selectedSeats.length + ' seat(s) but entered ' + paxN + ' passenger(s). Please make them match.'; }
      else if (conflicts.length) { seatMsg = 'Seat ' + conflicts.join(', ') + ' is already reserved. Please choose different seats.'; }
    } else if (!flight || !isValidDateStr(date)) {
      seatMsg = 'Choose a flight and date first, then select your seats.';
    }
    $('seatError').textContent = seatMsg;
    if (seatMsg) { state.count++; if (!state.first) { state.first = $('seatFieldset'); } }

    check($('contactName'), vName($('contactName').value, 'Enter the contact person\'s full name.'), state);
    check($('contactEmail'), vEmail($('contactEmail').value), state);
    check($('contactPhone'), vPhone($('contactPhone').value), state);

    for (var i = 0; i < paxCount; i++) {
      var pEl = $('pax-' + i);
      if (pEl) { check(pEl, vName(pEl.value, 'Enter the full name of passenger ' + (i + 1) + '.'), state); }
    }

    check($('paymentMethod'), PAYMENT_METHODS.indexOf($('paymentMethod').value) === -1 ? 'Select a payment method.' : '', state);
    check($('agreeDemo'), $('agreeDemo').checked ? '' : 'Please tick this box to continue.', state);

    return { ok: state.count === 0, first: state.first, count: state.count };
  }

  function onSubmitBooking(e) {
    e.preventDefault();
    // Re-read saved records so conflicts from another tab are caught
    bookings = loadBookings();
    renderSeatMap();   // drops seats that were just taken elsewhere
    syncSeatTags();
    updateSummary();

    var result = validateBooking();
    if (!result.ok) {
      toast('Please fix ' + result.count + ' problem' + (result.count > 1 ? 's' : '') + ' in the form.', 'error');
      if (result.first) { result.first.focus(); }
      return;
    }

    var flight = getFlight($('flightSelect').value);
    var seats = selectedSeats.slice();
    var now = new Date().toISOString();
    var booking = {
      ref: newReference(),
      flightCode: flight.code,
      date: $('travelDate').value,
      passengers: seats.map(function (seat, i) { return { name: $('pax-' + i).value.trim(), seat: seat }; }),
      contact: {
        name: $('contactName').value.trim(),
        email: $('contactEmail').value.trim(),
        phone: $('contactPhone').value.trim()
      },
      payment: $('paymentMethod').value,
      totals: calcTotals(flight, seats),
      status: 'Confirmed',
      createdAt: now,
      updatedAt: now
    };

    bookings.push(booking);
    if (!saveBookings()) { bookings.pop(); return; }

    toast('Booking confirmed! Your reference number is ' + booking.ref + '.', 'success');
    resetBookingForm();
    window.location.hash = '#confirmation/' + encodeURIComponent(booking.ref);
  }

  function resetBookingForm() {
    $('bookingForm').reset();
    clearErrors($('bookingForm'));
    selectedSeats = [];
    paxCount = 1;
    $('paxCount').value = 1;
    refreshBooking();
  }

  /* ----------------------------------------------------------
     9. CONFIRMATION / TICKET VIEW
     ---------------------------------------------------------- */
  function barcodeSvg(text) {
    var x = 0;
    var bars = '';
    for (var i = 0; i < text.length * 3; i++) {
      var w = 1 + ((text.charCodeAt(i % text.length) + i) % 3);
      if (i % 2 === 0) { bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>'; }
      x += w + 1;
    }
    return '<svg class="barcode" viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + bars + '</svg>';
  }

  function renderTicket(ref) {
    var host = $('ticketView');
    var booking = null;
    if (ref) { booking = findBooking(ref); }
    else if (bookings.length) {
      booking = bookings.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })[0];
    }

    if (!booking) {
      host.innerHTML = '<div class="empty-state"><h2>' + (ref ? 'Booking not found' : 'No booking to show') + '</h2>' +
        '<p>' + (ref ? 'We could not find a saved booking with reference ' + esc(ref) + '. It may have been deleted.' : 'Make a booking to see your ticket confirmation here.') + '</p>' +
        '<div class="btn-row" style="justify-content:center"><a class="btn btn--primary" href="#book">Book a ticket</a><a class="btn btn--outline" href="#records">My bookings</a></div></div>';
      return;
    }

    var f = getFlight(booking.flightCode);
    var t = booking.totals;
    var rows = booking.passengers.map(function (p, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.seat) + '</td><td>' + seatClass(p.seat) +
        '</td><td class="num">' + money(seatFare(f, p.seat)) + '</td></tr>';
    }).join('');
    var cancelled = booking.status === 'Cancelled';

    host.innerHTML =
      '<div class="ticket-actions">' +
        '<button class="btn btn--primary" type="button" id="printTicket">Print / save as PDF</button>' +
        '<a class="btn btn--outline" href="#records">Back to my bookings</a>' +
        '<a class="btn btn--outline" href="#book">Book another ticket</a>' +
      '</div>' +
      '<article class="ticket" aria-labelledby="ticketTitle">' +
        '<header class="ticket-head"><div><p class="eyebrow">Calvin Airlines Inc.</p><h2 id="ticketTitle">E-ticket</h2></div>' +
        '<span class="status ' + statusClass(booking.status) + '">' + esc(booking.status) + '</span></header>' +
        '<div class="ticket-body">' +
          '<p class="demo-note">Demonstration ticket. It is not valid for travel, and no payment was taken.' + (cancelled ? ' This booking is cancelled and its seats have been released.' : '') + '</p>' +
          '<div class="ticket-ref"><span>Reference number</span><strong>' + esc(booking.ref) + '</strong></div>' +
          '<div class="route">' +
            '<div><strong>' + esc(f.depart) + '</strong><span>' + esc(cityName(f.from)) + ' (' + esc(f.from) + ')</span></div>' +
            '<div class="route-mid"><div class="route-line">' + PLANE_SVG + '</div><small>' + esc(duration(f)) + '</small></div>' +
            '<div><strong>' + esc(f.arrive) + '</strong><span>' + esc(cityName(f.to)) + ' (' + esc(f.to) + ')</span></div>' +
          '</div>' +
          '<dl class="detail-grid">' +
            '<div><dt>Flight</dt><dd>' + esc(f.code) + '</dd></div>' +
            '<div><dt>Travel date</dt><dd>' + esc(formatDate(booking.date)) + '</dd></div>' +
            '<div><dt>Aircraft</dt><dd>' + esc(f.aircraft) + '</dd></div>' +
            '<div><dt>Contact person</dt><dd>' + esc(booking.contact.name) + '</dd></div>' +
            '<div><dt>Email</dt><dd>' + esc(booking.contact.email) + '</dd></div>' +
            '<div><dt>Mobile</dt><dd>' + esc(booking.contact.phone) + '</dd></div>' +
            '<div><dt>Payment method</dt><dd>' + esc(booking.payment) + '</dd></div>' +
            '<div><dt>Booked on</dt><dd>' + esc(new Date(booking.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })) + '</dd></div>' +
            '<div><dt>Status</dt><dd>' + esc(booking.status) + '</dd></div>' +
          '</dl>' +
          '<h3>Passengers</h3>' +
          '<table><thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Seat</th><th scope="col">Cabin</th><th scope="col" class="num">Fare</th></tr></thead><tbody>' + rows + '</tbody></table>' +
          '<h3>Payment summary</h3>' +
          '<dl class="ticket-totals">' +
            '<div><dt>Fare subtotal</dt><dd>' + money(t.fare) + '</dd></div>' +
            '<div><dt>VAT (12%)</dt><dd>' + money(t.vat) + '</dd></div>' +
            '<div><dt>Booking fee</dt><dd>' + money(t.fee) + '</dd></div>' +
            '<div class="grand"><dt>Total</dt><dd>' + money(t.total) + '</dd></div>' +
          '</dl>' +
          barcodeSvg(booking.ref) +
        '</div>' +
      '</article>';

    $('printTicket').addEventListener('click', function () { window.print(); });
  }

  /* ----------------------------------------------------------
     10. RECORDS VIEW
     ---------------------------------------------------------- */
  function bookingMatches(b, q) {
    var f = getFlight(b.flightCode);
    var hay = [
      b.ref, b.flightCode, b.contact.name, b.contact.email, b.status,
      f.from, f.to, cityName(f.from), cityName(f.to),
      b.passengers.map(function (p) { return p.name + ' ' + p.seat; }).join(' ')
    ].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderRecords() {
    var q = $('recordsSearch').value.trim().toLowerCase();
    var status = $('recordsStatus').value;
    var date = $('recordsDate').value;
    var filtering = !!(q || status || date);

    var list = bookings.filter(function (b) {
      return (!q || bookingMatches(b, q)) && (!status || b.status === status) && (!date || b.date === date);
    }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });

    var body = $('recordsBody');
    var wrap = $('recordsTableWrap');
    var empty = $('recordsEmpty');

    $('recordsCount').textContent = bookings.length
      ? 'Showing ' + list.length + ' of ' + bookings.length + ' booking' + (bookings.length > 1 ? 's' : '')
      : '';
    $('btnExport').disabled = !bookings.length;
    $('btnClearAll').disabled = !bookings.length;

    if (!list.length) {
      wrap.hidden = true;
      empty.hidden = false;
      body.innerHTML = '';
      if (bookings.length && filtering) {
        $('recordsEmptyTitle').textContent = 'No matching bookings';
        $('recordsEmptyText').textContent = 'Nothing matches your search or filters. Try different words or reset the filters.';
        $('recordsEmptyLink').hidden = true;
      } else {
        $('recordsEmptyTitle').textContent = 'No bookings yet';
        $('recordsEmptyText').textContent = 'Book a ticket, or load sample data, to see bookings here.';
        $('recordsEmptyLink').hidden = false;
      }
      return;
    }

    wrap.hidden = false;
    empty.hidden = true;
    body.innerHTML = list.map(function (b) {
      var f = getFlight(b.flightCode);
      var cancelled = b.status === 'Cancelled';
      var canCancel = b.status === 'Confirmed' || b.status === 'Checked-In';
      var names = b.passengers.map(function (p) { return esc(p.name) + ' (' + esc(p.seat) + ')'; }).join(', ');
      return '<tr>' +
        '<td data-label="Reference"><span class="ref-code">' + esc(b.ref) + '</span></td>' +
        '<td data-label="Flight">' + esc(f.code) + '<br><small>' + esc(routeText(f)) + ' &middot; ' + esc(f.depart) + '</small></td>' +
        '<td data-label="Travel date">' + esc(formatDate(b.date)) + '</td>' +
        '<td data-label="Passengers">' + b.passengers.length + '<br><small>' + names + '</small></td>' +
        '<td data-label="Total">' + money(b.totals.total) + '</td>' +
        '<td data-label="Status"><span class="status ' + statusClass(b.status) + '">' + esc(b.status) + '</span></td>' +
        '<td data-label="Actions"><div class="row-actions">' +
          '<button class="btn btn--outline" type="button" data-action="view" data-ref="' + esc(b.ref) + '" aria-label="View ticket ' + esc(b.ref) + '">View</button>' +
          (cancelled ? '' : '<button class="btn btn--outline" type="button" data-action="edit" data-ref="' + esc(b.ref) + '" aria-label="Edit booking ' + esc(b.ref) + '">Edit</button>') +
          (canCancel ? '<button class="btn btn--danger-outline" type="button" data-action="cancel" data-ref="' + esc(b.ref) + '" aria-label="Cancel booking ' + esc(b.ref) + '">Cancel</button>' : '') +
          '<button class="btn btn--danger-outline" type="button" data-action="delete" data-ref="' + esc(b.ref) + '" aria-label="Delete booking ' + esc(b.ref) + '">Delete</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function onRecordsClick(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) { return; }
    var ref = btn.getAttribute('data-ref');
    var action = btn.getAttribute('data-action');
    var booking = findBooking(ref);
    if (!booking) { toast('That booking no longer exists.', 'error'); renderRecords(); return; }

    if (action === 'view') { window.location.hash = '#confirmation/' + encodeURIComponent(ref); }
    if (action === 'edit') { openEdit(booking); }
    if (action === 'cancel') { cancelBooking(booking); }
    if (action === 'delete') { deleteBooking(booking); }
  }

  function cancelBooking(booking) {
    confirmAction({
      title: 'Cancel this booking?',
      message: 'Booking ' + booking.ref + ' will be marked as Cancelled and its seats (' +
        booking.passengers.map(function (p) { return p.seat; }).join(', ') + ') will be released. This cannot be undone.',
      okLabel: 'Yes, cancel booking',
      cancelLabel: 'Keep booking',
      danger: true
    }).then(function (yes) {
      if (!yes) { return; }
      booking.status = 'Cancelled';
      booking.updatedAt = new Date().toISOString();
      if (saveBookings()) { toast('Booking ' + booking.ref + ' was cancelled and its seats were released.', 'success'); }
      renderRecords();
    });
  }

  function deleteBooking(booking) {
    confirmAction({
      title: 'Delete this record?',
      message: 'Booking ' + booking.ref + ' will be permanently removed from this browser. This cannot be undone.',
      okLabel: 'Yes, delete',
      cancelLabel: 'Keep record',
      danger: true
    }).then(function (yes) {
      if (!yes) { return; }
      bookings = bookings.filter(function (b) { return b.ref !== booking.ref; });
      if (saveBookings()) { toast('Booking ' + booking.ref + ' was deleted.', 'success'); }
      renderRecords();
    });
  }

  /* ----- Edit dialog ----- */
  var editingRef = null;

  function openEdit(booking) {
    var f = getFlight(booking.flightCode);
    editingRef = booking.ref;
    clearErrors($('editForm'));
    $('editTitle').textContent = 'Edit booking ' + booking.ref;
    $('editSummary').textContent = f.code + ' · ' + routeText(f) + ' · ' + formatDate(booking.date) + '. Flight, date and seats cannot be changed; cancel and rebook instead.';
    $('editName').value = booking.contact.name;
    $('editEmail').value = booking.contact.email;
    $('editPhone').value = booking.contact.phone;
    var statusSelect = $('editStatus');
    statusSelect.value = booking.status;
    $('editPaxFields').innerHTML = booking.passengers.map(function (p, i) { return paxFieldHtml('edit-pax', i, p.name, p.seat); }).join('');
    openDialog($('editDialog'));
    $('editName').focus();
  }

  function onSubmitEdit(e) {
    e.preventDefault();
    var booking = findBooking(editingRef);
    if (!booking) { closeDialog($('editDialog')); toast('That booking no longer exists.', 'error'); renderRecords(); return; }

    clearErrors($('editForm'));
    var state = { count: 0, first: null };
    check($('editName'), vName($('editName').value, 'Enter the contact person\'s full name.'), state);
    check($('editEmail'), vEmail($('editEmail').value), state);
    check($('editPhone'), vPhone($('editPhone').value), state);
    for (var i = 0; i < booking.passengers.length; i++) {
      var el = $('edit-pax-' + i);
      check(el, vName(el.value, 'Enter the full name of passenger ' + (i + 1) + '.'), state);
    }
    if (state.count) {
      toast('Please fix ' + state.count + ' problem' + (state.count > 1 ? 's' : '') + ' before saving.', 'error');
      state.first.focus();
      return;
    }

    booking.contact = { name: $('editName').value.trim(), email: $('editEmail').value.trim(), phone: $('editPhone').value.trim() };
    booking.passengers.forEach(function (p, idx) { p.name = $('edit-pax-' + idx).value.trim(); });
    booking.status = $('editStatus').value;
    booking.updatedAt = new Date().toISOString();
    if (saveBookings()) { toast('Booking ' + booking.ref + ' was updated.', 'success'); }
    closeDialog($('editDialog'));
    renderRecords();
  }

  /* ----------------------------------------------------------
     11. IMPORT / EXPORT / SAMPLE DATA
     ---------------------------------------------------------- */
  function exportJson() {
    if (!bookings.length) { toast('There are no bookings to export.', 'warning'); return; }
    var data = { app: 'Calvin Airlines Inc.', version: 1, exportedAt: new Date().toISOString(), bookings: bookings };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'calvin-airlines-bookings-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Exported ' + bookings.length + ' booking' + (bookings.length > 1 ? 's' : '') + ' to a JSON file.', 'success');
  }

  // Adds bookings if valid, unique and conflict-free. Returns { added, skipped }.
  function addBookings(list) {
    var added = 0;
    var skipped = 0;
    list.forEach(function (item) {
      var clean = sanitizeBooking(item);
      if (!clean || findBooking(clean.ref)) { skipped++; return; }
      if (clean.status !== 'Cancelled') {
        var taken = reservedSeats(clean.flightCode, clean.date);
        var clash = clean.passengers.some(function (p) { return taken[p.seat]; });
        if (clash) { skipped++; return; }
      }
      bookings.push(clean);
      added++;
    });
    return { added: added, skipped: skipped };
  }

  function importJson(file) {
    if (!file) { return; }
    if (file.size > 1024 * 1024) { toast('That file is too large (limit 1 MB).', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { toast('That file is not valid JSON.', 'error'); return; }
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.bookings) ? data.bookings : null);
      if (!list) { toast('No bookings were found in that file.', 'error'); return; }
      var res = addBookings(list);
      if (res.added) { saveBookings(); }
      renderRecords();
      toast('Imported ' + res.added + ' booking' + (res.added === 1 ? '' : 's') + (res.skipped ? '; skipped ' + res.skipped + ' (invalid, duplicate or seat conflict).' : '.'), res.added ? 'success' : 'warning');
    };
    reader.onerror = function () { toast('The file could not be read.', 'error'); };
    reader.readAsText(file);
  }

  function loadSampleData() {
    var t = todayStr();
    var sample = [
      { flightCode: 'CA101', date: addDays(t, 3), seats: ['1A', '1B'], names: ['Juan Dela Cruz', 'Maria Dela Cruz'],
        contact: { name: 'Juan Dela Cruz', email: 'juan.delacruz@example.com', phone: '0917 123 4567' }, status: 'Confirmed', payment: PAYMENT_METHODS[0] },
      { flightCode: 'CA201', date: addDays(t, 7), seats: ['5C', '5D', '5E'], names: ['Ana Reyes', 'Carlo Reyes', 'Lia Reyes'],
        contact: { name: 'Ana Reyes', email: 'ana.reyes@example.com', phone: '0928 555 0101' }, status: 'Checked-In', payment: PAYMENT_METHODS[1] },
      { flightCode: 'CA801', date: addDays(t, 14), seats: ['8F'], names: ['Mika Navarro'],
        contact: { name: 'Mika Navarro', email: 'mika.navarro@example.com', phone: '+63 935 555 0199' }, status: 'Confirmed', payment: PAYMENT_METHODS[2] }
    ];
    var items = sample.map(function (s, i) {
      var now = new Date(Date.now() - (sample.length - i) * 60000).toISOString();
      var flight = getFlight(s.flightCode);
      return {
        ref: newReference(), flightCode: s.flightCode, date: s.date,
        passengers: s.seats.map(function (seat, k) { return { name: s.names[k], seat: seat }; }),
        contact: s.contact, payment: s.payment, totals: calcTotals(flight, s.seats),
        status: s.status, createdAt: now, updatedAt: now
      };
    });
    // newReference() checks saved bookings only, so give each sample a distinct suffix check
    var used = {};
    items.forEach(function (it) { while (used[it.ref]) { it.ref = newReference(); } used[it.ref] = true; });
    var res = addBookings(items);
    if (res.added) { saveBookings(); }
    renderRecords();
    toast(res.added ? 'Added ' + res.added + ' fictional sample booking' + (res.added > 1 ? 's' : '') + '.' : 'The sample seats are already booked, so nothing was added.', res.added ? 'success' : 'warning');
  }

  function clearAll() {
    if (!bookings.length) { return; }
    confirmAction({
      title: 'Delete all bookings?',
      message: 'All ' + bookings.length + ' saved booking' + (bookings.length > 1 ? 's' : '') + ' will be permanently removed from this browser. Consider exporting a backup first.',
      okLabel: 'Yes, delete all',
      cancelLabel: 'Keep bookings',
      danger: true
    }).then(function (yes) {
      if (!yes) { return; }
      bookings = [];
      if (saveBookings()) { toast('All bookings were deleted.', 'success'); }
      renderRecords();
    });
  }

  /* ----------------------------------------------------------
     12. START-UP
     ---------------------------------------------------------- */
  function bindEvents() {
    // Navigation toggle (mobile)
    $('navToggle').addEventListener('click', function () {
      var open = $('siteNav').classList.toggle('is-open');
      this.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('siteNav').classList.contains('is-open')) {
        $('siteNav').classList.remove('is-open');
        $('navToggle').setAttribute('aria-expanded', 'false');
        $('navToggle').focus();
      }
    });
    window.addEventListener('hashchange', route);

    // Flights filters
    ['filterDate', 'filterFrom', 'filterTo', 'filterSort'].forEach(function (id) {
      $(id).addEventListener('change', renderFlights);
    });
    $('flightFilterForm').addEventListener('submit', function (e) { e.preventDefault(); });
    $('resetFlightFilters').addEventListener('click', function () {
      $('filterDate').value = addDays(todayStr(), 1);
      $('filterFrom').value = '';
      $('filterTo').value = '';
      $('filterSort').value = 'time';
      renderFlights();
    });

    // Booking form
    $('bookingForm').addEventListener('submit', onSubmitBooking);
    $('flightSelect').addEventListener('change', function () { setError(this, ''); selectedSeats = []; refreshBooking(); });
    $('travelDate').addEventListener('change', function () { setError(this, ''); renderSeatMap(); syncSeatTags(); updateSummary(); });
    $('paxCount').addEventListener('input', setPaxCountFromInput);
    $('seatMap').addEventListener('click', function (e) {
      var btn = e.target.closest('button.seat');
      if (btn && !btn.disabled) { toggleSeat(btn.getAttribute('data-seat')); }
    });
    $('resetBooking').addEventListener('click', function () {
      confirmAction({ title: 'Clear the form?', message: 'Everything you entered and the seats you selected will be removed.', okLabel: 'Clear form', cancelLabel: 'Keep editing' })
        .then(function (yes) { if (yes) { resetBookingForm(); toast('The booking form was cleared.', 'success'); } });
    });
    // Clear a field's error as soon as the user edits it
    $('bookingForm').addEventListener('input', function (e) {
      var t = e.target;
      if (t.id && t.id !== 'paxCount' && $(t.id + '-error') && t.getAttribute('aria-invalid')) { setError(t, ''); }
    });
    $('bookingForm').addEventListener('change', function (e) {
      var t = e.target;
      if (t.id && $(t.id + '-error') && t.getAttribute('aria-invalid') && t.id !== 'paxCount') { setError(t, ''); }
    });

    // Records
    ['recordsSearch', 'recordsStatus', 'recordsDate'].forEach(function (id) {
      $(id).addEventListener(id === 'recordsSearch' ? 'input' : 'change', renderRecords);
    });
    $('recordsReset').addEventListener('click', function () {
      $('recordsSearch').value = '';
      $('recordsStatus').value = '';
      $('recordsDate').value = '';
      renderRecords();
    });
    $('recordsBody').addEventListener('click', onRecordsClick);
    $('btnSample').addEventListener('click', loadSampleData);
    $('btnExport').addEventListener('click', exportJson);
    $('btnClearAll').addEventListener('click', clearAll);
    $('btnImport').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function () { importJson(this.files[0]); this.value = ''; });

    // Edit dialog
    $('editForm').addEventListener('submit', onSubmitEdit);
    $('editCancel').addEventListener('click', function () { closeDialog($('editDialog')); });
    $('editForm').addEventListener('input', function (e) {
      var t = e.target;
      if (t.id && t.getAttribute('aria-invalid')) { setError(t, ''); }
    });
    $('editDialog').addEventListener('click', function (e) { if (e.target === this) { closeDialog(this); } });

    // Keep tabs in sync when another tab changes the saved bookings
    window.addEventListener('storage', function (e) {
      if (e.key !== STORAGE_KEY) { return; }
      bookings = loadBookings();
      route();
    });
  }

  function init() {
    var today = todayStr();
    var maxDate = addDays(today, MAX_ADVANCE_DAYS);
    ['filterDate', 'travelDate'].forEach(function (id) { $(id).min = today; $(id).max = maxDate; });
    $('filterDate').value = addDays(today, 1);
    $('year').textContent = new Date().getFullYear();

    populateAirportSelect($('filterFrom'));
    populateAirportSelect($('filterTo'));
    populateBookingSelects();

    bookings = loadBookings();
    bindEvents();
    refreshBooking();
    route();
  }

  init();
})();
