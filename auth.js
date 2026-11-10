// ==========================================================
// AeroSwift – authentication & session (FR-01, FR-02, NFR-01)
//
// Demo note: AeroSwift is a static front-end prototype, so accounts live in
// the browser's localStorage. Passwords are NEVER stored or compared as plain
// text: each one is hashed with a random salt (PBKDF2-SHA-256 through the Web
// Crypto API, with an iterated SHA-256 fallback for very old browsers).
// In production the hashing must happen on the server over HTTPS.
// ==========================================================
(function () {
  "use strict";

  var USERS_KEY = "aeroswift_users";
  var SESSION_KEY = "aeroswift_session";
  var SESSION_MS = 2 * 60 * 60 * 1000;   // session expires after 2 hours of inactivity
  var PBKDF2_ITER = 150000;
  var FALLBACK_ITER = 20000;

  // ---------- helpers ----------
  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function toHex(bytes) {
    return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function randomHex(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return toHex(a);
  }
  function utf8(str) { return new TextEncoder().encode(str); }

  // compact synchronous SHA-256 (fallback only)
  function sha256(bytes) {
    var K = [], H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], i, j;
    (function () { var p = 2, c = 0; while (c < 64) { var ok = true; for (var d = 2; d * d <= p; d++) if (p % d === 0) { ok = false; break; }
      if (ok) { K[c++] = (Math.pow(p, 1 / 3) % 1) * 4294967296 | 0; } p++; } })();
    var len = bytes.length, words = [];
    for (i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    words[(((len + 8) >> 6) + 1) * 16 - 1] = len * 8;
    for (i = 0; i < words.length; i++) if (words[i] === undefined) words[i] = 0;
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var o = 0; o < words.length; o += 16) {
      var w = words.slice(o, o + 16), a = H.slice();
      for (j = 16; j < 64; j++) {
        var s0 = rotr(w[j-15],7) ^ rotr(w[j-15],18) ^ (w[j-15] >>> 3);
        var s1 = rotr(w[j-2],17) ^ rotr(w[j-2],19) ^ (w[j-2] >>> 10);
        w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
      }
      for (j = 0; j < 64; j++) {
        var S1 = rotr(a[4],6) ^ rotr(a[4],11) ^ rotr(a[4],25), ch = (a[4] & a[5]) ^ (~a[4] & a[6]);
        var t1 = (a[7] + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(a[0],2) ^ rotr(a[0],13) ^ rotr(a[0],22), mj = (a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]);
        var t2 = (S0 + mj) | 0;
        a = [(t1 + t2) | 0, a[0], a[1], a[2], (a[3] + t1) | 0, a[4], a[5], a[6]];
      }
      for (j = 0; j < 8; j++) H[j] = (H[j] + a[j]) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[i*4] = H[i] >>> 24; out[i*4+1] = (H[i] >>> 16) & 255; out[i*4+2] = (H[i] >>> 8) & 255; out[i*4+3] = H[i] & 255; }
    return out;
  }

  function hashPassword(password, salt, algo) {
    algo = algo || ((window.crypto && window.crypto.subtle) ? "pbkdf2-sha256" : "sha256-iter");
    if (algo === "pbkdf2-sha256") {
      return window.crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"])
        .then(function (key) {
          return window.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: utf8(salt), iterations: PBKDF2_ITER }, key, 256);
        })
        .then(function (bits) { return { algo: algo, hash: toHex(new Uint8Array(bits)) }; });
    }
    return new Promise(function (resolve) {
      var cur = utf8(salt + ":" + password);
      for (var i = 0; i < FALLBACK_ITER; i++) cur = sha256(cur);
      resolve({ algo: "sha256-iter", hash: toHex(cur) });
    });
  }

  // ---------- validation (equivalence partitions, report Table 5.1) ----------
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validateName(name) {
    name = (name || "").trim();
    if (!name) return "Full name is required.";
    if (name.length < 2) return "Full name is too short.";
    if (!/^[A-Za-zÀ-ɏ' .,-]+$/.test(name)) return "Name may only contain letters, spaces and . ' -";
    return "";
  }
  function validateEmail(email) {
    email = (email || "").trim();
    if (!email) return "Email is required.";
    if (!EMAIL_RE.test(email)) return "Enter a valid email address, e.g. name@example.com.";
    return "";
  }
  function validatePassword(pw) {
    if (!pw) return "Password is required.";
    if (pw.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain at least one letter and one number.";
    return "";
  }
  function passwordStrength(pw) {
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);   // 0..4
  }

  // ---------- users ----------
  function getUsers() { return readJSON(USERS_KEY, {}); }
  function normEmail(e) { return (e || "").trim().toLowerCase(); }

  function register(name, email, password) {
    var key = normEmail(email), users = getUsers();
    if (users[key]) return Promise.reject(new Error("This email is already registered. Please log in instead."));
    var salt = randomHex(16);
    return hashPassword(password, salt).then(function (h) {
      users = getUsers();
      if (users[key]) throw new Error("This email is already registered. Please log in instead.");
      users[key] = { name: name.trim(), email: key, salt: salt, algo: h.algo, hash: h.hash, createdAt: new Date().toISOString() };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return users[key];
    });
  }

  function login(email, password) {
    var u = getUsers()[normEmail(email)];
    var fail = new Error("Email or password is incorrect.");
    if (!u) {
      // do the same amount of work so timing does not reveal whether the email exists
      return hashPassword(password, "0000000000000000").then(function () { throw fail; });
    }
    return hashPassword(password, u.salt, u.algo).then(function (h) {
      if (h.hash !== u.hash) throw fail;
      startSession(u);
      return u;
    });
  }

  // ---------- session ----------
  function startSession(u) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: u.email, name: u.name, expires: Date.now() + SESSION_MS }));
  }
  function currentUser() {
    var s = readJSON(SESSION_KEY, null);
    if (!s) return null;
    if (!s.expires || s.expires < Date.now() || !getUsers()[s.email]) { localStorage.removeItem(SESSION_KEY); return null; }
    s.expires = Date.now() + SESSION_MS;                 // sliding expiry
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return { email: s.email, name: s.name };
  }
  function logout() { localStorage.removeItem(SESSION_KEY); }

  // Redirect to the account page when there is no valid session.
  function requireLogin() {
    var u = currentUser();
    if (!u) {
      var next = location.pathname.split("/").pop() + location.search;
      location.replace("account.html?next=" + encodeURIComponent(next) + "&reason=login");
      return null;
    }
    return u;
  }

  // Safe redirect target after login: only same-site page names are accepted.
  function safeNext(raw) {
    if (!raw) return "index.html";
    return /^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9_=&%.\-+:]*)?$/.test(raw) ? raw : "index.html";
  }

  // ---------- navbar ----------
  function renderNav() {
    var ul = document.querySelector(".navbar-links");
    if (!ul) return;
    var u = currentUser();
    var page = location.pathname.split("/").pop() || "index.html";
    var html = "";
    if (u) {
      var first = u.name.split(" ")[0];
      html += '<li class="nav-user"><span title="' + AS.esc(u.email) + '">👤 Hi, ' + AS.esc(first) + '</span></li>';
      html += '<li><a href="#" id="logoutLink">Logout</a></li>';
    } else {
      html += '<li><a href="account.html"' + (page === "account.html" ? ' class="active"' : "") + '>Login / Register</a></li>';
    }
    ul.insertAdjacentHTML("beforeend", html);
    var lo = document.getElementById("logoutLink");
    if (lo) lo.addEventListener("click", function (e) { e.preventDefault(); logout(); location.href = "index.html"; });
  }

  window.Auth = {
    validateName: validateName, validateEmail: validateEmail, validatePassword: validatePassword,
    passwordStrength: passwordStrength, register: register, login: login, logout: logout,
    currentUser: currentUser, requireLogin: requireLogin, safeNext: safeNext, renderNav: renderNav
  };
})();
