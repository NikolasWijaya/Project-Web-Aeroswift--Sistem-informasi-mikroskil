// ==========================================================
// AeroSwift – page logic
// Pages: index (search), account (FR-01/02), flight (FR-03..06),
//        booking (FR-07..09), history (FR-10).
// Requires data.js (AS) and auth.js (Auth) to be loaded first.
// ==========================================================
(function () {
  "use strict";

  var BOOKINGS_KEY = "aeroswift_bookings";
  var COUNTER_KEY = "aeroswift_booking_counter";
  var esc = AS.esc, fmt = AS.formatRupiah;

  // ---------------- tiny helpers ----------------
  function $(id) { return document.getElementById(id); }
  function qs() { return new URLSearchParams(location.search); }

  function setErr(id, msg) {
    var box = $(id + "Err"), input = $(id);
    if (box) box.textContent = msg || "";
    if (input) {
      input.classList.toggle("invalid", !!msg);
      if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    }
  }
  function clearErr(id) { setErr(id, ""); }
  function showAlert(el, msg) { if (!el) return; el.textContent = msg; el.hidden = !msg; }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------------- bookings storage ----------------
  function getSavedBookings() {
    try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || []; } catch (e) { return []; }
  }
  function saveBooking(b) {
    var all = getSavedBookings();
    all.push(b);
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all));
  }
  function nextBookingId() {
    var n = parseInt(localStorage.getItem(COUNTER_KEY) || "1001", 10);
    localStorage.setItem(COUNTER_KEY, String(n + 1));
    return "BK" + n;
  }
  function formatToday() { return AS.formatDate(AS.todayISO()); }

  // ==========================================================
  // SEARCH FORM (index.html + flight.html)  – FR-03
  // ==========================================================
  var searchForm = $("searchForm");
  var SEARCH_FIELDS = ["from", "to", "departDate", "returnDate", "passengers"];

  function readSearch() {
    var q = {};
    SEARCH_FIELDS.forEach(function (f) { q[f] = $(f).value.trim(); });
    return q;
  }
  function showSearchErrors(errs) {
    SEARCH_FIELDS.forEach(function (f) { setErr(f, errs[f] || ""); });
    var first = SEARCH_FIELDS.filter(function (f) { return errs[f]; })[0];
    if (first) $(first).focus();
  }

  if (searchForm) {
    var today = AS.todayISO();
    $("departDate").min = today;
    $("returnDate").min = today;

    $("departDate").addEventListener("change", function () {
      $("returnDate").min = this.value || today;
    });
    SEARCH_FIELDS.forEach(function (f) {
      $(f).addEventListener("input", function () { clearErr(f); });
      $(f).addEventListener("change", function () { clearErr(f); });
    });

    searchForm.addEventListener("submit", function (e) {
      var errs = AS.validateSearch(readSearch());
      if (Object.keys(errs).length) { e.preventDefault(); showSearchErrors(errs); }
      // otherwise the browser performs the GET to flight.html
    });

    // prefill from the query string (flight.html, or a destination card on index)
    var sp = qs();
    SEARCH_FIELDS.forEach(function (f) { if (sp.get(f) !== null) $(f).value = sp.get(f); });
    if ($("departDate").value) $("returnDate").min = $("departDate").value;
  }

  // ==========================================================
  // ACCOUNT PAGE (account.html) – FR-01 registration, FR-02 login
  // ==========================================================
  if ($("loginForm")) {
    (function () {
      var params = qs(), next = Auth.safeNext(params.get("next"));
      if (Auth.currentUser()) { location.replace(next); return; }

      var notice = $("authNotice");
      if (params.get("reason") === "login") {
        notice.textContent = "Please log in or register to continue.";
        notice.hidden = false;
      }

      function switchTab(which) {
        var login = which !== "register";
        $("loginForm").hidden = !login;
        $("registerForm").hidden = login;
        $("tabLogin").classList.toggle("active", login);
        $("tabRegister").classList.toggle("active", !login);
        $("tabLogin").setAttribute("aria-selected", String(login));
        $("tabRegister").setAttribute("aria-selected", String(!login));
      }
      $("tabLogin").addEventListener("click", function () { switchTab("login"); });
      $("tabRegister").addEventListener("click", function () { switchTab("register"); });
      Array.prototype.forEach.call(document.querySelectorAll("[data-switch]"), function (a) {
        a.addEventListener("click", function (e) { e.preventDefault(); switchTab(a.getAttribute("data-switch")); });
      });
      if (params.get("tab") === "register") switchTab("register");

      Array.prototype.forEach.call(document.querySelectorAll(".toggle-pw"), function (b) {
        b.addEventListener("click", function () {
          var input = $(b.getAttribute("data-target")), show = input.type === "password";
          input.type = show ? "text" : "password";
          b.textContent = show ? "Hide" : "Show";
          b.setAttribute("aria-label", show ? "Hide password" : "Show password");
        });
      });

      ["loginEmail", "loginPassword", "regName", "regEmail", "regPassword", "regConfirm"].forEach(function (id) {
        $(id).addEventListener("input", function () { clearErr(id); });
      });

      // ---- login ----
      $("loginForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var email = $("loginEmail").value, pw = $("loginPassword").value, ok = true;
        showAlert($("loginAlert"), "");
        var eMsg = Auth.validateEmail(email); setErr("loginEmail", eMsg); if (eMsg) ok = false;
        var pMsg = pw ? "" : "Password is required."; setErr("loginPassword", pMsg); if (pMsg) ok = false;
        if (!ok) { (eMsg ? $("loginEmail") : $("loginPassword")).focus(); return; }

        var btn = $("loginBtn"); btn.disabled = true; btn.textContent = "Logging in…";
        Auth.login(email, pw).then(function () {
          location.href = next;
        }).catch(function (err) {
          showAlert($("loginAlert"), err.message || "Login failed. Please try again.");
          $("loginPassword").value = "";
          btn.disabled = false; btn.textContent = "Login";
        });
      });

      // ---- password strength ----
      $("regPassword").addEventListener("input", function () {
        var s = Auth.passwordStrength(this.value), bar = $("strengthBar");
        var labels = ["Too weak", "Weak", "Fair", "Good", "Strong"], colors = ["#DC2626", "#DC2626", "#D97706", "#16A34A", "#16A34A"];
        bar.style.width = (this.value ? (s + 1) * 20 : 0) + "%";
        bar.style.background = colors[s];
        $("strengthText").textContent = this.value ? "Password strength: " + labels[s] : "Password strength";
      });

      // ---- register ----
      $("registerForm").addEventListener("submit", function (e) {
        e.preventDefault();
        showAlert($("registerAlert"), "");
        var name = $("regName").value, email = $("regEmail").value, pw = $("regPassword").value, cf = $("regConfirm").value;
        var errs = {
          regName: Auth.validateName(name), regEmail: Auth.validateEmail(email),
          regPassword: Auth.validatePassword(pw),
          regConfirm: !cf ? "Please repeat your password." : (cf !== pw ? "Passwords do not match." : "")
        };
        var first = null;
        Object.keys(errs).forEach(function (k) { setErr(k, errs[k]); if (errs[k] && !first) first = k; });
        if (first) { $(first).focus(); return; }

        var btn = $("registerBtn"); btn.disabled = true; btn.textContent = "Creating account…";
        Auth.register(name, email, pw).then(function () {
          $("registerForm").reset();
          $("strengthBar").style.width = "0"; $("strengthText").textContent = "Password strength";
          switchTab("login");
          $("loginEmail").value = email.trim();
          notice.textContent = "Account created successfully. Please log in.";
          notice.className = "alert alert-success"; notice.hidden = false;
          $("loginPassword").focus();
        }).catch(function (err) {
          showAlert($("registerAlert"), err.message || "Registration failed. Please try again.");
        }).then(function () { btn.disabled = false; btn.textContent = "Create Account"; });
      });
    })();
  }

  // ==========================================================
  // FLIGHT LIST PAGE (flight.html) – FR-03, FR-05, FR-06
  // ==========================================================
  if ($("flightsList")) {
    (function () {
      var p = qs();
      var q = {};
      SEARCH_FIELDS.forEach(function (f) { q[f] = (p.get(f) || "").trim(); });
      var complete = q.from && q.to && q.departDate;
      var empty = $("flightEmpty"), layout = $("resultsLayout");

      if (!complete) return;   // just show the search form + hint

      var errs = AS.validateSearch(q);
      if (Object.keys(errs).length) {
        showSearchErrors(errs);
        empty.querySelector("h2").textContent = "Please check your search";
        empty.querySelector("p").textContent = "Some search details are not valid. Fix the highlighted fields and search again.";
        return;
      }

      var pax = parseInt(q.passengers, 10);
      var routeFlights = AS.findFlights(q.from, q.to);
      $("flightSubtitle").textContent = AS.airportName(q.from) + " → " + AS.airportName(q.to) + "  ·  " +
        AS.formatDate(q.departDate) + "  ·  " + pax + (pax === 1 ? " Passenger" : " Passengers") +
        (q.returnDate ? "  ·  Return " + AS.formatDate(q.returnDate) : "");

      if (!routeFlights.length) {
        empty.querySelector(".empty-icon").textContent = "🔍";
        empty.querySelector("h2").textContent = "No flights on this route";
        empty.querySelector("p").textContent = "We don't operate flights from " + AS.airportName(q.from) + " to " + AS.airportName(q.to) + " yet. Try another route.";
        return;
      }

      empty.hidden = true; layout.hidden = false;

      // --- filter controls ---
      var prices = routeFlights.map(function (f) { return f.price; });
      var step = 50000;
      var pMin = Math.floor(Math.min.apply(null, prices) / step) * step;
      var pMax = Math.ceil(Math.max.apply(null, prices) / step) * step;
      var range = $("fPrice");
      range.min = pMin; range.max = pMax; range.step = step; range.value = pMax;
      $("fPriceMin").textContent = fmt(pMin); $("fPriceMax").textContent = fmt(pMax);

      var airlines = []; routeFlights.forEach(function (f) { if (airlines.indexOf(f.airline) === -1) airlines.push(f.airline); });
      airlines.forEach(function (a) { var o = document.createElement("option"); o.value = a; o.textContent = a; $("fAirline").appendChild(o); });

      function bucket(h) { return h < 6 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; }

      function render() {
        var maxPrice = +range.value, air = $("fAirline").value, tm = $("fTime").value, sort = $("fSort").value;
        $("fPriceLabel").textContent = fmt(maxPrice);

        var list = routeFlights.filter(function (f) {
          return f.price <= maxPrice &&
                 (air === "all" || f.airline === air) &&
                 (tm === "any" || bucket(+f.depart.slice(0, 2)) === tm);
        });
        list.sort(function (a, b) { return sort === "depart" ? a.depart.localeCompare(b.depart) : a.price - b.price; });

        $("resultsCount").textContent = "Showing " + list.length + " of " + routeFlights.length + " flights";

        if (!list.length) {
          $("flightsList").innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h2>No flights match your filters</h2><p>Try a higher price, another airline or any departure time.</p></div>';
          return;
        }

        $("flightsList").innerHTML = list.map(function (f) {
          var left = AS.seatsLeft(f.flightNo, q.departDate);
          var sold = left <= 0, tooFew = !sold && left < pax;
          var stops = f.stops ? f.stops + " Stop" : "Non-stop";
          var note = sold ? "" : (tooFew ? '<div class="seat-note warn">Only ' + left + ' seat' + (left === 1 ? "" : "s") + ' left – not enough for ' + pax + ' passengers</div>'
                                         : (left <= 5 ? '<div class="seat-note warn">Only ' + left + ' seats left</div>' : '<div class="seat-note">' + left + ' seats left</div>'));
          var link = "booking.html?flightNo=" + encodeURIComponent(f.flightNo) + "&date=" + encodeURIComponent(q.departDate) +
                     "&pax=" + pax + (q.returnDate ? "&returnDate=" + encodeURIComponent(q.returnDate) : "");
          var btn = (sold || tooFew)
            ? '<button type="button" class="btn btn-primary" disabled aria-disabled="true">' + (sold ? "Sold Out" : "Unavailable") + '</button>'
            : '<a href="' + link + '" class="btn btn-primary">Select Flight</a>';
          return '<div class="' + (sold ? "flight-card-sold" : "flight-card") + '"' + (sold ? ' aria-label="Sold out"' : "") + '>' +
            '<div class="flight-card-left"><div class="airline-logo">' + (f.stops ? "🛬" : "🛫") + '</div>' +
            '<div class="flight-info"><div class="airline-name">' + esc(f.airline) + ' <span class="flight-no">' + esc(f.flightNo) + '</span></div>' +
            '<div class="flight-times"><div class="time-block"><div class="time-big">' + f.depart + '</div><div class="time-sub">' + f.from + '</div></div>' +
            '<div class="flight-route-line"><div class="route-label">' + f.duration + '</div><div class="route-track"></div><div class="route-label">' + stops + '</div></div>' +
            '<div class="time-block"><div class="time-big">' + f.arrive + '</div><div class="time-sub">' + f.to + '</div></div></div></div></div>' +
            '<div class="flight-card-right"><div class="flight-price">' + fmt(f.price) + '<span class="per-pax">/pax</span></div>' + note + btn + '</div></div>';
        }).join("");
      }

      ["input", "change"].forEach(function (ev) {
        range.addEventListener(ev, render);
        $("fAirline").addEventListener(ev, render);
        $("fTime").addEventListener(ev, render);
        $("fSort").addEventListener(ev, render);
      });
      $("fReset").addEventListener("click", function () {
        range.value = pMax; $("fAirline").value = "all"; $("fTime").value = "any"; $("fSort").value = "price"; render();
      });
      render();
    })();
  }

  // ==========================================================
  // TICKET / BOARDING PASS MODAL (booking + history) – FR-09
  // ==========================================================
  var ticketModal = null, ticketState = { b: null, i: 0, opts: {} };

  function ensureTicketModal() {
    if (ticketModal) return ticketModal;
    ticketModal = document.createElement("div");
    ticketModal.id = "ticketModal"; ticketModal.className = "ticket-overlay";
    ticketModal.innerHTML =
      '<div class="ticket-card" role="dialog" aria-modal="true" aria-labelledby="ticketLabel">' +
        '<div class="ticket-header"><div class="ticket-header-brand"><span class="ticket-plane">✈</span> AeroSwift</div>' +
        '<div class="ticket-header-label" id="ticketLabel">Boarding Pass</div></div>' +
        '<div id="ticketDetail" class="ticket-body"></div>' +
        '<div class="ticket-perforation"></div>' +
        '<div id="ticketStub" class="ticket-stub"></div>' +
        '<div class="ticket-actions" id="ticketActions"></div>' +
      '</div>';
    document.body.appendChild(ticketModal);
    ticketModal.addEventListener("click", function (e) { if (e.target === ticketModal && !ticketState.opts.locked) closeTicket(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ticketModal.style.display === "flex" && !ticketState.opts.locked) closeTicket(); });
    return ticketModal;
  }
  function closeTicket() { ticketModal.style.display = "none"; }

  function drawTicket() {
    var b = ticketState.b, i = ticketState.i, opts = ticketState.opts, px = b.passengers[i];
    $("ticketLabel").textContent = "Boarding Pass" + (b.passengers.length > 1 ? " · " + (i + 1) + "/" + b.passengers.length : "");
    $("ticketDetail").innerHTML =
      (opts.confirmation ? '<div class="ticket-success">✔ Payment successful – booking confirmed</div>' : "") +
      '<div class="ticket-passenger-label">Passenger</div>' +
      '<div class="ticket-passenger-name">' + esc(px.name) + '</div>' +
      '<div class="ticket-route">' +
        '<div class="ticket-route-block"><div class="ticket-route-code">' + esc(b.from) + '</div><div class="ticket-route-time">' + esc(b.time) + '</div></div>' +
        '<div class="ticket-route-line"></div>' +
        '<div class="ticket-route-block"><div class="ticket-route-code">' + esc(b.to) + '</div><div class="ticket-route-time">' + esc(b.arriveTime) + '</div></div>' +
      '</div>' +
      '<div class="ticket-grid">' +
        '<div><div class="ticket-field-label">Flight</div><div class="ticket-field-value">' + esc(b.airline) + ' ' + esc(b.flightNumber) + '</div></div>' +
        '<div><div class="ticket-field-label">Date</div><div class="ticket-field-value">' + esc(b.date) + '</div></div>' +
        '<div><div class="ticket-field-label">Departs</div><div class="ticket-field-value">' + esc(b.time) + '</div></div>' +
        '<div><div class="ticket-field-label">Arrives</div><div class="ticket-field-value">' + esc(b.arriveTime) + '</div></div>' +
        '<div><div class="ticket-field-label">Seat</div><div class="ticket-field-value">' + esc(px.seat) + '</div></div>' +
        '<div><div class="ticket-field-label">Class</div><div class="ticket-field-value">' + esc(b.class) + '</div></div>' +
      '</div>' +
      '<div class="ticket-contact"><span>✉ ' + esc(b.email) + '</span><span>📞 ' + esc(b.phone) + '</span></div>';
    $("ticketStub").innerHTML =
      '<div class="ticket-barcode"></div>' +
      '<div class="ticket-stub-row"><div><div class="ticket-ref-label">Booking Ref</div><div class="ticket-ref-value">' + esc(b.id) + '</div></div>' +
      '<div style="text-align:right"><div class="ticket-total-label">Total</div><div class="ticket-total-value">' + esc(b.price) + '</div></div></div>' +
      '<div class="ticket-card-line">' + esc(b.paymentLabel) + '</div>';

    var acts = "";
    if (b.passengers.length > 1) {
      acts += '<button type="button" class="btn btn-outline" id="tkPrev"' + (i === 0 ? " disabled" : "") + '>‹ Prev</button>' +
              '<button type="button" class="btn btn-outline" id="tkNext"' + (i === b.passengers.length - 1 ? " disabled" : "") + '>Next ›</button>';
    }
    acts += '<button type="button" class="btn btn-outline" id="tkPrint">🖨 Print</button>';
    if (opts.confirmation) acts += '<a href="history.html" class="btn btn-primary">View History</a>';
    else acts += '<button type="button" class="btn btn-primary" id="tkClose">Close</button>';
    if (b.returnDate) acts += '<a class="btn btn-outline" id="tkReturn" href="flight.html?from=' + encodeURIComponent(b.to) + "&to=" + encodeURIComponent(b.from) +
      "&departDate=" + encodeURIComponent(b.returnDate) + "&passengers=" + b.passengers.length + '">Book return flight</a>';
    $("ticketActions").innerHTML = acts;

    if ($("tkPrev")) $("tkPrev").onclick = function () { ticketState.i--; drawTicket(); };
    if ($("tkNext")) $("tkNext").onclick = function () { ticketState.i++; drawTicket(); };
    $("tkPrint").onclick = function () { window.print(); };
    if ($("tkClose")) $("tkClose").onclick = closeTicket;
  }

  function openTicket(b, opts) {
    ensureTicketModal();
    ticketState = { b: b, i: 0, opts: opts || {} };
    drawTicket();
    ticketModal.style.display = "flex";
  }

  // ==========================================================
  // BOOKING PAGE (booking.html) – FR-07, FR-08, FR-09
  // ==========================================================
  if ($("bookingForm")) {
    (function () {
      var user = Auth.currentUser();
      if (!user) return;
      var p = qs();
      var flight = AS.getFlight(p.get("flightNo") || "");
      var date = p.get("date") || "";
      var paxRaw = p.get("pax") || "";
      var pax = /^\d+$/.test(paxRaw) ? parseInt(paxRaw, 10) : 0;
      var returnDate = AS.isRealDate(p.get("returnDate")) ? p.get("returnDate") : "";

      function fail(msg) {
        $("bookingLayout").hidden = true; $("bookingError").hidden = false; $("bookingErrorMsg").textContent = msg;
      }
      if (!flight) return fail("The selected flight could not be found. Please search again and choose a flight.");
      if (!AS.isRealDate(date) || date < AS.todayISO()) return fail("The travel date is not valid. Please search again.");
      if (pax < 1 || pax > AS.MAX_PASSENGERS) return fail("The number of passengers must be between 1 and " + AS.MAX_PASSENGERS + ".");
      if (AS.seatsLeft(flight.flightNo, date) <= 0) return fail("Sorry, this flight is sold out. Please choose another flight.");
      if (AS.seatsLeft(flight.flightNo, date) < pax) return fail("There are not enough seats left on this flight for " + pax + " passengers.");

      $("backLink").href = "flight.html?from=" + flight.from + "&to=" + flight.to + "&departDate=" + date + "&passengers=" + pax + (returnDate ? "&returnDate=" + returnDate : "");

      var formKey = Date.now().toString(36) + Math.random().toString(36).slice(2);   // idempotency key
      var seats = [];                 // chosen seat per passenger
      for (var i = 0; i < pax; i++) seats.push(null);
      var active = 0, processing = false, done = false;

      var base = flight.price * pax, taxes = Math.round(base * AS.TAX_RATE), total = base + taxes;

      // ---- summary ----
      $("summaryAirline").textContent = flight.airline + " " + flight.flightNo;
      $("summaryRoute").textContent = flight.from + " → " + flight.to;
      $("summaryDate").textContent = AS.formatDate(date);
      $("summaryDepart").textContent = flight.depart;
      $("summaryArrive").textContent = flight.arrive;
      $("summaryPax").textContent = pax;
      $("summaryBaseLabel").textContent = "Base Fare (" + pax + " × " + fmt(flight.price) + ")";
      $("summaryBaseFare").textContent = fmt(base);
      $("summaryTaxes").textContent = fmt(taxes);
      $("summaryTotal").textContent = fmt(total);
      function updateSeatSummary() {
        var chosen = seats.filter(Boolean);
        $("summarySeats").textContent = chosen.length ? chosen.join(", ") : "Not selected";
      }
      updateSeatSummary();

      // ---- passenger cards ----
      var html = "";
      for (var n = 0; n < pax; n++) {
        html += '<div class="pax-card"><h3 class="pax-title">Passenger ' + (n + 1) + '</h3><div class="form-grid">' +
          '<div class="form-group"><label class="form-label" for="paxName' + n + '">👤 Full Name (as on ID)</label>' +
          '<input type="text" id="paxName' + n + '" class="form-input" placeholder="Name" autocomplete="off" />' +
          '<div class="field-error" id="paxName' + n + 'Err" role="alert"></div></div>' +
          '<div class="form-group"><label class="form-label" for="paxId' + n + '">🪪 ID / Passport Number</label>' +
          '<input type="text" id="paxId' + n + '" class="form-input" placeholder="A12345678" maxlength="20" autocomplete="off" />' +
          '<div class="field-error" id="paxId' + n + 'Err" role="alert"></div></div></div></div>';
      }
      $("paxContainer").innerHTML = html;
      $("paxName0").value = user.name;
      $("email").value = user.email;

      // ---- seat map ----
      function drawSeatTabs() {
        $("seatTabs").innerHTML = seats.map(function (s, k) {
          return '<button type="button" role="tab" class="seat-tab' + (k === active ? " active" : "") + '" data-pax="' + k + '" aria-selected="' + (k === active) + '">' +
            'Passenger ' + (k + 1) + ' · ' + (s ? esc(s) : "no seat") + '</button>';
        }).join("");
      }
      function drawSeatMap() {
        var taken = AS.takenSeats(flight.flightNo, date), out = "";
        out += '<div class="seat-row seat-head"><span class="row-no"></span>' +
          AS.SEAT_LETTERS.map(function (l, k) { return (k === 3 ? '<span class="aisle"></span>' : "") + '<span class="seat-col">' + l + "</span>"; }).join("") + "</div>";
        for (var r = 1; r <= AS.SEAT_ROWS; r++) {
          out += '<div class="seat-row"><span class="row-no">' + r + "</span>";
          AS.SEAT_LETTERS.forEach(function (l, k) {
            var code = r + l, isTaken = taken.indexOf(code) !== -1, who = seats.indexOf(code);
            var cls = "seat" + (isTaken ? " taken" : "") + (who !== -1 ? (who === active ? " selected" : " mine") : "");
            out += (k === 3 ? '<span class="aisle"></span>' : "") +
              '<button type="button" class="' + cls + '" data-seat="' + code + '"' + (isTaken ? " disabled" : "") +
              ' aria-label="Seat ' + code + (isTaken ? ", occupied" : who !== -1 ? ", selected by passenger " + (who + 1) : ", available") + '">' +
              (who !== -1 ? (who + 1) : "") + "</button>";
          });
          out += "</div>";
        }
        $("seatMap").innerHTML = out;
      }
      function redrawSeats() { drawSeatTabs(); drawSeatMap(); updateSeatSummary(); }
      redrawSeats();

      $("seatTabs").addEventListener("click", function (e) {
        var b = e.target.closest("[data-pax]"); if (!b) return;
        active = +b.getAttribute("data-pax"); redrawSeats();
      });
      $("seatMap").addEventListener("click", function (e) {
        var b = e.target.closest("[data-seat]"); if (!b || b.disabled) return;
        var code = b.getAttribute("data-seat"), owner = seats.indexOf(code);
        $("seatsErr").textContent = "";
        if (owner === active) { seats[active] = null; }                       // click again = deselect
        else if (owner !== -1) {
          toast("Seat " + code + " is already chosen for Passenger " + (owner + 1) + ".");
          $("seatsErr").textContent = "Seat " + code + " is already chosen for Passenger " + (owner + 1) + ". Each passenger needs a different seat.";
          return;
        } else {
          seats[active] = code;
          var nextFree = seats.indexOf(null);                                  // move on to the next passenger without a seat
          if (nextFree !== -1) active = nextFree;
        }
        redrawSeats();
      });

      // ---- input formatting ----
      $("cardNumber").addEventListener("input", function () {
        var d = this.value.replace(/\D/g, "").slice(0, 16);
        this.value = d.replace(/(.{4})/g, "$1 ").trim();
      });
      $("expiry").addEventListener("input", function () {
        var d = this.value.replace(/\D/g, "").slice(0, 4);
        this.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
      });
      $("cvv").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 3); });
      ["email", "phone", "cardNumber", "expiry", "cvv"].forEach(function (id) { $(id).addEventListener("input", function () { clearErr(id); }); });
      for (var k = 0; k < pax; k++) (function (k) {
        $("paxName" + k).addEventListener("input", function () { clearErr("paxName" + k); });
        $("paxId" + k).addEventListener("input", function () { clearErr("paxId" + k); });
      })(k);

      // ---- validation (equivalence partitions, report Table 5.1) ----
      function validate() {
        var errs = [];
        function add(id, msg) { if (msg) { errs.push(id); setErr(id, msg); } else clearErr(id); }
        for (var n = 0; n < pax; n++) {
          var nm = $("paxName" + n).value.trim();
          add("paxName" + n, !nm ? "Passenger name is required." : nm.length < 2 ? "Name is too short." :
              !/^[A-Za-zÀ-ɏ' .,-]+$/.test(nm) ? "Name may only contain letters, spaces and . ' -" : "");
          var idn = $("paxId" + n).value.trim();
          add("paxId" + n, !idn ? "ID / passport number is required." : !/^[A-Za-z0-9]{6,20}$/.test(idn) ? "Use 6–20 letters or digits, no spaces or symbols." : "");
        }
        add("email", Auth.validateEmail($("email").value));
        var ph = $("phone").value.replace(/[\s-]/g, "");
        add("phone", !ph ? "Phone number is required." : !/^\+?\d{9,15}$/.test(ph) ? "Enter a valid phone number, e.g. +62 812 3456 7890." : "");

        var missing = seats.indexOf(null) !== -1;
        $("seatsErr").textContent = missing ? "Please choose a seat for every passenger." : "";
        if (missing) errs.push("seatTabs");

        var cn = $("cardNumber").value.replace(/\s/g, "");
        add("cardNumber", !cn ? "Card number is required." : /\D/.test(cn) ? "Card number may contain digits only." : cn.length !== 16 ? "Card number must be 16 digits." : "");
        var ex = $("expiry").value, m = /^(\d{2})\/(\d{2})$/.exec(ex), exMsg = "";
        if (!ex) exMsg = "Expiry date is required.";
        else if (!m) exMsg = "Use the format MM/YY.";
        else if (+m[1] < 1 || +m[1] > 12) exMsg = "Month must be between 01 and 12.";
        else {
          var now = new Date(), endOfMonth = new Date(2000 + +m[2], +m[1], 0, 23, 59, 59);
          if (endOfMonth < now) exMsg = "This card has expired.";
        }
        add("expiry", exMsg);
        var cv = $("cvv").value;
        add("cvv", !cv ? "CVV is required." : !/^\d{3}$/.test(cv) ? "CVV must be 3 digits." : "");
        return errs;
      }

      // ---- submit / pay ----
      $("bookingForm").addEventListener("submit", function (e) {
        e.preventDefault();
        if (processing || done) return;                 // blocks double-click
        showAlert($("formAlert"), "");
        var errs = validate();
        if (errs.length) {
          var el = $(errs[0]); if (el) el.focus();
          showAlert($("formAlert"), "Please correct the highlighted fields.");
          return;
        }
        processing = true;
        var btn = $("payBtn"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing payment…';

        var cardDigits = $("cardNumber").value.replace(/\s/g, "");
        var method = document.querySelector('input[name="paymentMethod"]:checked').value;

        setTimeout(function () {
          // re-check availability right before confirming (NFR-07: no double booking)
          var conflicts = AS.reserveSeats(flight.flightNo, date, seats.slice());
          if (conflicts.length) {
            seats = seats.map(function (s) { return conflicts.indexOf(s) !== -1 ? null : s; });
            active = Math.max(0, seats.indexOf(null));
            redrawSeats();
            showAlert($("formAlert"), "Seat " + conflicts.join(", ") + " was just taken by another booking. Please choose a different seat – you have not been charged.");
            processing = false; btn.disabled = false; btn.textContent = "Pay & Confirm Booking";
            return;
          }
          var passengers = [];
          for (var n = 0; n < pax; n++) {
            var idn = $("paxId" + n).value.trim();
            passengers.push({ name: $("paxName" + n).value.trim().replace(/\s+/g, " "), idNumber: "••••" + idn.slice(-4), seat: seats[n] });
          }
          var methodName = method === "debit" ? "Debit Card" : "Credit Card";
          var booking = {
            id: nextBookingId(), key: formKey, userEmail: user.email,
            airline: flight.airline, flightNumber: flight.flightNo,
            from: flight.from, to: flight.to,
            departure: AS.airportName(flight.from), destination: AS.airportName(flight.to),
            date: AS.formatDate(date), isoDate: date, returnDate: returnDate,
            time: flight.depart, arriveTime: flight.arrive,
            passengers: passengers, email: $("email").value.trim(), phone: $("phone").value.trim(),
            class: "Economy",
            baseFare: base, taxes: taxes, total: total, price: fmt(total),
            paymentMethod: methodName, cardLast4: cardDigits.slice(-4),
            paymentLabel: methodName + " •••• " + cardDigits.slice(-4),
            paymentStatus: "Paid", status: "Confirmed", bookedOn: formatToday()
          };
          saveBooking(booking);
          // card data must not linger in the page
          $("cardNumber").value = ""; $("cvv").value = ""; $("expiry").value = "";
          done = true; processing = false;
          btn.textContent = "Booking Confirmed ✔";
          openTicket(booking, { confirmation: true, locked: true });
        }, 1200);
      });
    })();
  }

  // ==========================================================
  // HISTORY PAGE (history.html) – FR-10
  // ==========================================================
  var historyList = $("historyList");
  if (historyList) {
    (function () {
      var user = Auth.currentUser();
      if (!user) return;

      var mine = getSavedBookings().filter(function (b) { return b.userEmail === user.email; }).reverse();   // newest first
      var byId = {}; mine.forEach(function (b) { byId[b.id] = b; });

      function meta(icon, label, value) {
        return '<div class="meta-item-history"><span class="icon">' + icon + '</span><div><div class="info-label">' + label + '</div><div class="info-value">' + value + '</div></div></div>';
      }
      function card(b) {
        var names = b.passengers.map(function (x) { return x.name; }).join(", ");
        return '<div class="history-card" style="margin-bottom:1.25rem">' +
          '<div class="history-card-header"><div>' +
            '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.3rem;flex-wrap:wrap"><span class="booking-airline">' + esc(b.airline) + '</span>' +
            '<span class="badge badge-success">✔ ' + esc(b.status) + '</span></div>' +
            '<div class="booking-id">Booking ID: ' + esc(b.id) + '</div></div>' +
          '<div class="booking-price">' + esc(b.price) + '</div></div>' +
          '<div class="history-card-meta">' +
            meta("📍", "Route", esc(b.departure) + " → " + esc(b.destination)) +
            meta("📅", "Flight Date", esc(b.date)) +
            meta("👤", b.passengers.length > 1 ? "Passengers" : "Passenger", esc(names)) +
            meta("🗓", "Booked On", esc(b.bookedOn)) +
          '</div>' +
          '<div class="history-card-actions">' +
            '<button type="button" class="btn btn-primary view-detail-btn" data-id="' + esc(b.id) + '">👁 View Details</button>' +
            '<button type="button" class="btn btn-outline view-pass-btn" data-id="' + esc(b.id) + '">🎫 Boarding Pass</button>' +
          '</div></div>';
      }

      // ---- dashboard summary ----
      var todayIso = AS.todayISO();
      var upcoming = mine.filter(function (b) { return b.isoDate >= todayIso; })
                         .sort(function (a, b) { return a.isoDate.localeCompare(b.isoDate); });
      if (mine.length) {
        var nx = upcoming[0];
        $("historySummary").innerHTML =
          '<div class="summary-tiles">' +
            '<div class="stat-tile"><div class="stat-label">Total Bookings</div><div class="stat-value">' + mine.length + '</div></div>' +
            '<div class="stat-tile"><div class="stat-label">Upcoming Trips</div><div class="stat-value">' + upcoming.length + '</div></div>' +
            '<div class="stat-tile"><div class="stat-label">Completed Trips</div><div class="stat-value">' + (mine.length - upcoming.length) + '</div></div>' +
          '</div>' +
          (nx ? '<div class="next-trip"><div><div class="info-label">Next trip</div>' +
                '<div class="next-trip-route">' + esc(nx.from) + ' → ' + esc(nx.to) + '</div>' +
                '<div class="muted-text">' + esc(nx.date) + ' · ' + esc(nx.time) + ' · ' + esc(nx.airline) + ' ' + esc(nx.flightNumber) + '</div></div>' +
                '<button type="button" class="btn btn-primary view-pass-btn" data-id="' + esc(nx.id) + '">🎫 Boarding Pass</button></div>' : "") +
          '<h2 class="section-heading" style="margin:1.5rem 0 1rem">Booking History</h2>';
      }

      if (!mine.length) {
        historyList.innerHTML = '<div class="empty-state"><div class="empty-icon">🧳</div><h2>No bookings yet</h2>' +
          '<p>Hi ' + esc(user.name.split(" ")[0]) + ', you have not booked any flight yet. Your confirmed bookings will appear here.</p>' +
          '<a href="flight.html" class="btn btn-primary" style="margin-top:1rem">Search Flights</a></div>';
      } else {
        historyList.innerHTML = mine.map(card).join("");
      }

      var detailModal = $("detailModal"), body = $("detailTableBody");
      function row(th, td, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : "") + '><th>' + th + '</th><td>' + td + '</td></tr>'; }

      document.querySelector("main").addEventListener("click", function (e) {
        var d = e.target.closest(".view-detail-btn"), t = e.target.closest(".view-pass-btn");
        if (t && byId[t.getAttribute("data-id")]) { openTicket(byId[t.getAttribute("data-id")], {}); return; }
        if (!d || !byId[d.getAttribute("data-id")]) return;
        var b = byId[d.getAttribute("data-id")];
        body.innerHTML =
          row("Booking ID", esc(b.id)) +
          b.passengers.map(function (x, i) { return row("Passenger " + (i + 1), esc(x.name) + '<br><small class="muted-text">Seat ' + esc(x.seat) + " · ID " + esc(x.idNumber) + "</small>"); }).join("") +
          row("Airline", esc(b.airline)) + row("Flight Number", esc(b.flightNumber)) +
          row("Departure", esc(b.departure)) + row("Destination", esc(b.destination)) +
          row("Date", esc(b.date)) + row("Time", esc(b.time) + " → " + esc(b.arriveTime)) +
          row("Class", esc(b.class)) +
          row("Base Fare", esc(fmt(b.baseFare))) + row("Taxes &amp; Fees", esc(fmt(b.taxes))) +
          row("Payment", esc(b.paymentLabel)) +
          row("Payment Status", '<span class="badge badge-success">✔ ' + esc(b.paymentStatus) + "</span>") +
          row("Total Price", esc(b.price), "detail-price") +
          row("Booking Status", '<span class="badge badge-success">✔ ' + esc(b.status) + "</span>");
        detailModal.style.display = "flex";
      });
      $("detailModalClose").addEventListener("click", function () { detailModal.style.display = "none"; });
      detailModal.addEventListener("click", function (e) { if (e.target === detailModal) detailModal.style.display = "none"; });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") detailModal.style.display = "none"; });
    })();
  }

  // ---------------- navbar (login state) ----------------
  Auth.renderNav();

  // Stops the hamburger menu animating while the window is resized
  var resizeTimer;
  window.addEventListener("resize", function () {
    document.body.classList.add("resize-animation-stopper");
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { document.body.classList.remove("resize-animation-stopper"); }, 400);
  });
})();
