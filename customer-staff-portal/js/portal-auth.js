/**
 * Business Manager 360 — Shared Offline Auth & IndexedDB Engine for /customer-staff-portal/
 * Synchronizes cleanly with BusinessManager360_DB and bm360_portal_session.
 * Zero external network calls or plaintext password storage.
 */
(function (global) {
  'use strict';

  var DB_NAME = 'BusinessManager360_DB';
  var DB_VERSION = 3;
  var SESSION_KEY = 'bm360_portal_session';

  // Pure-JS SHA-256 fallback (matching src/utils/cryptoAuth.ts) for file:// or non-secure origins
  function sha256Hex(str) {
    var bytes = new TextEncoder().encode(str);
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bitLen = bytes.length * 8;
    var totalLen = Math.ceil((bytes.length + 9) / 64) * 64;
    var padded = new Uint8Array(totalLen);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    var view = new DataView(padded.buffer);
    view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
    view.setUint32(totalLen - 4, bitLen >>> 0, false);

    function rotr(x, n) {
      return (x >>> n) | (x << (32 - n));
    }

    var w = new Uint32Array(64);
    for (var offset = 0; offset < totalLen; offset += 64) {
      for (var i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
      for (var i2 = 16; i2 < 64; i2++) {
        var s0 = rotr(w[i2 - 15], 7) ^ rotr(w[i2 - 15], 18) ^ (w[i2 - 15] >>> 3);
        var s1 = rotr(w[i2 - 2], 17) ^ rotr(w[i2 - 2], 19) ^ (w[i2 - 2] >>> 10);
        w[i2] = (w[i2 - 16] + s0 + w[i2 - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var out = '';
    for (var k = 0; k < 8; k++) out += H[k].toString(16).padStart(8, '0');
    return out;
  }

  function stretchedSha256(password, saltHex, iterations) {
    var acc = saltHex + ':' + password;
    for (var i = 0; i < iterations; i++) {
      acc = sha256Hex(saltHex + ':' + acc + ':' + i);
    }
    return acc;
  }

  function randomSaltHex() {
    var arr = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function hashPassword(plainText) {
    var saltHex = randomSaltHex();
    if (global.crypto && global.crypto.subtle && global.isSecureContext) {
      try {
        var enc = new TextEncoder();
        var key = await global.crypto.subtle.importKey('raw', enc.encode(plainText), { name: 'PBKDF2' }, false, ['deriveBits']);
        var saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
        var bits = await global.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, key, 256);
        var hashHex = Array.from(new Uint8Array(bits), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        return 'pbkdf2$100000$' + saltHex + '$' + hashHex;
      } catch (_e) {
        // fallback below
      }
    }
    return 'sha256s$1500$' + saltHex + '$' + stretchedSha256(plainText, saltHex, 1500);
  }

  async function verifyPassword(plainText, storedHash) {
    if (!plainText || !storedHash) return false;
    var parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    var algo = parts[0];
    var iter = parseInt(parts[1], 10);
    var saltHex = parts[2];
    var expected = parts[3];
    if (algo === 'pbkdf2' && global.crypto && global.crypto.subtle && global.isSecureContext) {
      var enc = new TextEncoder();
      var key = await global.crypto.subtle.importKey('raw', enc.encode(plainText), { name: 'PBKDF2' }, false, ['deriveBits']);
      var saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
      var bits = await global.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: iter, hash: 'SHA-256' }, key, 256);
      var actual = Array.from(new Uint8Array(bits), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      return actual === expected;
    }
    if (algo === 'sha256s' || algo === 'sha256') {
      return stretchedSha256(plainText, saltHex, iter) === expected;
    }
    return false;
  }

  function hashSeedSync(plainText, saltHex) {
    return 'sha256s$1500$' + saltHex + '$' + stretchedSha256(plainText, saltHex, 1500);
  }

  var SEED_CUSTOMERS = [
    {
      id: 'cust-acc-001',
      customerId: 'CUST001',
      fullName: 'Rahul Sharma',
      email: 'rahul.customer@mystore.local',
      phone: '+91 98450 11223',
      passwordHash: hashSeedSync('customer@123', '626d3336305f637573745f3030315f73'),
      status: 'Active',
      authProvider: 'local',
      linkedPartyName: 'CGBVCXVHV',
      addresses: [
        { id: 'addr-1', label: 'Home', name: 'Rahul Sharma', phone: '+91 98450 11223', street: '42 Residency Road', area: 'Residency Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560025', isDefault: true }
      ],
      createdAt: '14/11/2026',
      lastLogin: 'Today',
    },
  ];

  var SEED_STAFF = [
    {
      id: 'user-staff-st001',
      employeeId: 'ST001',
      name: 'Neha Verma',
      email: 'neha.staff@mystore.local',
      phone: '+91 98450 44556',
      roleId: 'role-manager',
      roleName: 'Manager',
      status: 'Active',
      isApproved: true,
      accountType: 'STAFF',
      passwordHash: hashSeedSync('staff@password123', '626d3336305f73746166665f3030315f'),
      lastLogin: 'Today',
    },
    {
      id: 'user-owner',
      employeeId: 'OWNER-01',
      name: 'Krishna Murthy (Owner)',
      email: 'krishna.enterprises@gmail.com',
      phone: '+91 98450 12345',
      roleId: 'role-owner',
      roleName: 'Owner',
      status: 'Active',
      isApproved: true,
      accountType: 'ADMIN',
      passwordHash: hashSeedSync('owner@password123', '736565645f757365722d6f776e6572'),
      lastLogin: 'Today',
    },
  ];

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        var stores = [
          'transactions', 'parties', 'items', 'users', 'roles', 'employees',
          'attendanceRecords', 'loginHistory', 'activityLogs', 'customerAccounts',
          'staffTasks', 'portalNotifications', 'customerActivity', 'supportMessages', 'appKV'
        ];
        stores.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: name === 'appKV' ? 'key' : 'id' });
          }
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function readAll(storeName) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        if (!db.objectStoreNames.contains(storeName)) {
          resolve([]);
          return;
        }
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    }).catch(function () { return []; });
  }

  function putRecord(storeName, record) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(record);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function setSession(sessionObj) {
    if (!sessionObj) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionObj));
    }
  }

  async function ensureSeedData() {
    var custs = await readAll('customerAccounts');
    if (custs.length === 0) {
      for (var i = 0; i < SEED_CUSTOMERS.length; i++) {
        await putRecord('customerAccounts', SEED_CUSTOMERS[i]);
      }
      custs = SEED_CUSTOMERS.slice();
    }
    var staff = await readAll('users');
    if (staff.length === 0) {
      for (var j = 0; j < SEED_STAFF.length; j++) {
        await putRecord('users', SEED_STAFF[j]);
      }
      staff = SEED_STAFF.slice();
    }
    return { customers: custs, users: staff };
  }

  global.BM360PortalAuth = {
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    readAll: readAll,
    putRecord: putRecord,
    getSession: getSession,
    setSession: setSession,
    ensureSeedData: ensureSeedData,
  };
})(window);
