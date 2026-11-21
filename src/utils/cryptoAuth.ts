/**
 * Business Manager 360 — Offline Salted Password Hashing Utility
 * Uses Web Crypto PBKDF2-SHA256 (100,000 iterations) in secure contexts
 * with a deterministic pure-JS SHA-256 salted fallback so offline LAN origins also hash safely.
 * Plain-text passwords are NEVER persisted to IndexedDB or localStorage.
 */

const ITERATIONS = 100000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function generateSaltBytes(length = 16): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    return arr;
  }
  const fallback = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    fallback[i] = Math.floor((Date.now() * (i + 7) + Math.random() * 255) % 256);
  }
  return fallback;
}

// Pure JS SHA-256 fallback (100% offline, zero external libs) when subtle crypto is unavailable on plain HTTP LAN IPs
function sha256Fallback(message: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const ascii = unescape(encodeURIComponent(message));
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let padded = ascii + '\x80';
  while ((padded.length % 64) - 56) padded += '\x00';
  for (let i = 0; i < padded.length; i++) {
    const j = padded.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function stretchedSha256(password: string, saltHex: string, rounds = 1500): string {
  let acc = `${saltHex}:${password}`;
  for (let i = 0; i < rounds; i++) {
    acc = sha256Fallback(`${saltHex}:${acc}:${i}`);
  }
  return acc;
}

async function derivePbkdf2(password: string, saltBytes: Uint8Array, iterations: number): Promise<string> {
  const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : null;
  if (!subtle) {
    return stretchedSha256(password, toHex(saltBytes), 1500);
  }
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );
  return toHex(new Uint8Array(derivedBits));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = generateSaltBytes(16);
  const saltHex = toHex(salt);
  const subtleAvailable = Boolean(typeof window !== 'undefined' && window.crypto && window.crypto.subtle);

  if (subtleAvailable) {
    const hashHex = await derivePbkdf2(plainPassword, salt, ITERATIONS);
    return `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
  }
  const hashHex = stretchedSha256(plainPassword, saltHex, 1500);
  return `sha256s$1500$${saltHex}$${hashHex}`;
}

export async function verifyPassword(plainPassword: string, storedHash?: string): Promise<boolean> {
  if (!storedHash || !plainPassword) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;

  const [scheme, iterStr, saltHex, expectedHash] = parts;
  const rounds = parseInt(iterStr, 10) || 1000;

  if (scheme === 'pbkdf2') {
    const computed = await derivePbkdf2(plainPassword, fromHex(saltHex), rounds);
    return timingSafeEqual(computed, expectedHash);
  }
  if (scheme === 'sha256s') {
    const computed = stretchedSha256(plainPassword, saltHex, rounds);
    return timingSafeEqual(computed, expectedHash);
  }
  return false;
}

/**
 * Synchronous deterministic hash used ONLY to initialize factory default seed records
 * before IndexedDB async upgrade runs, using salted stretched SHA-256 (verified via verifyPassword).
 */
export function hashSeedPasswordSync(plainPassword: string, fixedSaltHex: string): string {
  const hashHex = stretchedSha256(plainPassword, fixedSaltHex, 1500);
  return `sha256s$1500$${fixedSaltHex}$${hashHex}`;
}

export function isPasswordHashed(value?: string): boolean {
  return Boolean(value && (value.startsWith('pbkdf2$') || value.startsWith('sha256s$')));
}
