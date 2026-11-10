// ==========================================================
// AeroSwift – data layer (airports, flights, seat availability)
// Shared by index.html, flight.html, booking.html and history.html.
// Seat availability is stored in localStorage so that a seat that has
// been booked can never be booked again (FR-07, NFR-07).
// ==========================================================
(function () {
  "use strict";

  var MAX_PASSENGERS = 9;          // report Table 5.4 (boundary 1..9)
  var TAX_RATE = 0.10;             // taxes & fees = 10 % of base fare
  var SEAT_ROWS = 10;
  var SEAT_LETTERS = ["A", "B", "C", "D", "E", "F"];
  var CAPACITY = SEAT_ROWS * SEAT_LETTERS.length;
  var SEATS_KEY = "aeroswift_seats";

  var airports = {
    KNO: "Medan, Kualanamu (KNO)",
    CGK: "Jakarta, Soekarno-Hatta (CGK)",
    DPO: "Bali, Denpasar (DPO)",
    YIA: "Yogyakarta, Kulon Progo (YIA)",
    SUB: "Surabaya, Juanda (SUB)",
    BPN: "Balikpapan, Sepinggan (BPN)",
    SOQ: "Papua Barat, Sorong (SOQ)",
    TKG: "Lampung, Radin Inten II (TKG)"
  };

  // [airline, flightNo, departs, duration, stops, price(IDR), soldOut]
  var routeTemplates = [
    ["KNO", "DPO", [
      ["Batik Airlines",   "BTK-238", "08:00", "3h 30m", 0, 2600000, 0],
      ["LionAir Airlines", "JT-611",  "13:20", "3h 30m", 0, 2350000, 0],
      ["Garuda Airlines",  "GA-415",  "17:05", "3h 30m", 0, 3100000, 1]]],
    ["KNO", "CGK", [
      ["LionAir Airlines", "JT-892",  "10:15", "2h 50m", 0, 1700000, 0],
      ["Garuda Airlines",  "GA-181",  "06:30", "2h 40m", 0, 2250000, 0],
      ["Citilink Airlines","QG-761",  "15:40", "2h 45m", 0, 1550000, 0]]],
    ["CGK", "DPO", [
      ["Citilink Airlines","QG-560",  "12:30", "2h 30m", 0, 1900000, 0],
      ["Batik Airlines",   "BTK-512", "07:10", "2h 30m", 0, 2050000, 0],
      ["Garuda Airlines",  "GA-401",  "18:45", "2h 30m", 0, 2700000, 1]]],
    ["CGK", "YIA", [
      ["LionAir Airlines", "JT-345",  "14:45", "1h 15m", 0, 875000,  0],
      ["Citilink Airlines","QG-142",  "09:00", "1h 10m", 0, 820000,  0],
      ["Garuda Airlines",  "GA-212",  "19:20", "1h 10m", 0, 1150000, 0]]],
    ["CGK", "SUB", [
      ["Garuda Airlines",  "GA-314",  "06:00", "1h 30m", 0, 1250000, 0],
      ["LionAir Airlines", "JT-702",  "11:30", "1h 35m", 0, 980000,  0],
      ["Batik Airlines",   "BTK-620", "17:50", "1h 30m", 0, 1100000, 0]]],
    ["CGK", "BPN", [
      ["Garuda Airlines",  "GA-538",  "16:00", "1h 30m", 0, 1375000, 1],
      ["LionAir Airlines", "JT-771",  "08:20", "2h 05m", 0, 1450000, 0],
      ["Citilink Airlines","QG-433",  "13:10", "2h 10m", 0, 1520000, 0]]],
    ["CGK", "SOQ", [
      ["Garuda Airlines",  "GA-650",  "00:40", "4h 40m", 0, 3900000, 0],
      ["LionAir Airlines", "JT-960",  "09:15", "6h 05m", 1, 3400000, 0]]],
    ["BPN", "DPO", [
      ["Garuda Airlines",  "GA-588",  "18:15", "3h 30m", 0, 3750000, 1],
      ["Batik Airlines",   "BTK-701", "10:40", "3h 20m", 0, 3300000, 0]]],
    ["YIA", "TKG", [
      ["LionAir Airlines", "JT-345L", "14:45", "3h 45m", 1, 875000,  0],
      ["Citilink Airlines","QG-871",  "07:30", "2h 55m", 1, 910000,  0]]]
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function addMinutes(hhmm, durText) {
    var p = hhmm.split(":"), m = +p[0] * 60 + +p[1];
    var d = /(\d+)h\s*(\d+)m/.exec(durText);
    m += (+d[1]) * 60 + (+d[2]);
    m %= 1440;
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }

  var flights = [];
  routeTemplates.forEach(function (r) {
    r[2].forEach(function (t, i) {
      flights.push({ airline: t[0], flightNo: t[1], from: r[0], to: r[1],
        depart: t[2], arrive: addMinutes(t[2], t[3]), duration: t[3],
        stops: t[4], price: t[5], soldOut: !!t[6] });
      // Return direction of the same route (different flight number/time)
      var rt = (+t[2].slice(0, 2) + 3) % 24;
      var dep = pad(rt) + ":" + t[2].slice(3);
      flights.push({ airline: t[0], flightNo: t[1].replace(/(\d+)(L?)$/, function (m, n, l) { return (+n + 1) + l; }),
        from: r[1], to: r[0], depart: dep, arrive: addMinutes(dep, t[3]),
        duration: t[3], stops: t[4], price: Math.round(t[5] * 1.03 / 5000) * 5000,
        soldOut: !!t[6] && i === 0 });
    });
  });

  function getFlight(no) {
    for (var i = 0; i < flights.length; i++) if (flights[i].flightNo === no) return flights[i];
    return null;
  }
  function findFlights(from, to) {
    return flights.filter(function (f) { return f.from === from && f.to === to; });
  }

  // ---- seats -------------------------------------------------
  function allSeats() {
    var out = [];
    for (var r = 1; r <= SEAT_ROWS; r++) SEAT_LETTERS.forEach(function (l) { out.push(r + l); });
    return out;
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Seats that are already occupied before any user booked (deterministic)
  function presetTaken(flight, date) {
    var seats = allSeats();
    if (flight.soldOut) return seats;
    var seed = hash(flight.flightNo + "|" + date);
    var n = 6 + (seed % 25);
    var taken = [], pool = seats.slice();
    for (var i = 0; i < n; i++) {
      seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
      taken.push(pool.splice(seed % pool.length, 1)[0]);
    }
    return taken;
  }
  function readSeatStore() {
    try { return JSON.parse(localStorage.getItem(SEATS_KEY)) || {}; } catch (e) { return {}; }
  }
  function takenSeats(flightNo, date) {
    var f = getFlight(flightNo);
    if (!f) return [];
    var booked = readSeatStore()[flightNo + "|" + date] || [];
    var set = {};
    presetTaken(f, date).concat(booked).forEach(function (s) { set[s] = 1; });
    return Object.keys(set);
  }
  function seatsLeft(flightNo, date) {
    return CAPACITY - takenSeats(flightNo, date).length;
  }
  // Atomically reserve seats; returns the list of conflicting seats ([] = success)
  function reserveSeats(flightNo, date, seats) {
    var taken = takenSeats(flightNo, date);
    var conflicts = seats.filter(function (s) { return taken.indexOf(s) !== -1; });
    if (conflicts.length) return conflicts;
    var store = readSeatStore(), k = flightNo + "|" + date;
    store[k] = (store[k] || []).concat(seats);
    localStorage.setItem(SEATS_KEY, JSON.stringify(store));
    return [];
  }

  // ---- shared helpers ------------------------------------------
  function formatRupiah(n) { return "Rp " + Math.round(n).toLocaleString("id-ID"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function formatDate(iso) {      // "2026-07-19" -> "July 19, 2026"
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return p ? MONTHS[+p[2] - 1] + " " + (+p[3]) + ", " + p[1] : (iso || "");
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function isRealDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!p) return false;
    var d = new Date(+p[1], +p[2] - 1, +p[3]);
    return d.getFullYear() === +p[1] && d.getMonth() === +p[2] - 1 && d.getDate() === +p[3];
  }

  // Search validation = decision table R1–R5 (report Table 5.3) + BVA on passengers (Table 5.4)
  // Returns an object {field: message}; empty object means valid.
  function validateSearch(q) {
    var err = {};
    if (!q.from) err.from = "Please choose a departure city.";
    if (!q.to) err.to = "Please choose a destination city.";
    if (q.from && q.to && q.from === q.to) err.to = "Departure and destination must be different.";
    if (!q.departDate || !isRealDate(q.departDate)) err.departDate = "Please choose a departure date.";
    else if (q.departDate < todayISO()) err.departDate = "Departure date cannot be in the past.";
    if (q.returnDate) {
      if (!isRealDate(q.returnDate)) err.returnDate = "Return date is not valid.";
      else if (q.departDate && q.returnDate < q.departDate) err.returnDate = "Return date cannot be before the departure date.";
    }
    var p = Number(q.passengers);
    if (q.passengers === "" || q.passengers == null || !/^\d+$/.test(String(q.passengers).trim()))
      err.passengers = "Enter the number of passengers (1–" + MAX_PASSENGERS + ").";
    else if (p < 1) err.passengers = "At least 1 passenger is required.";
    else if (p > MAX_PASSENGERS) err.passengers = "Maximum " + MAX_PASSENGERS + " passengers per booking.";
    return err;
  }

  window.AS = {
    MAX_PASSENGERS: MAX_PASSENGERS, TAX_RATE: TAX_RATE, SEAT_ROWS: SEAT_ROWS,
    SEAT_LETTERS: SEAT_LETTERS, CAPACITY: CAPACITY,
    airports: airports, flights: flights, getFlight: getFlight, findFlights: findFlights,
    takenSeats: takenSeats, seatsLeft: seatsLeft, reserveSeats: reserveSeats,
    airportName: function (c) { return airports[c] || c; },
    formatRupiah: formatRupiah, esc: esc, formatDate: formatDate, todayISO: todayISO,
    isRealDate: isRealDate, validateSearch: validateSearch
  };
})();
