/**
 * Web Push (RFC 8291) + VAPID implementation for Deno/Supabase Edge Functions.
 * Uses only the built-in Web Crypto API — no external dependencies.
 */

const enc = new TextEncoder();

function base64urlEncode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + "==".substring(0, (4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * HKDF-SHA-256: Extract then Expand (single block, L <= 32).
 * extract: PRK = HMAC-SHA-256(salt, ikm)
 * expand:  OKM = HMAC-SHA-256(PRK, info || 0x01)[0..L-1]
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prkKey = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, ikm));

  const okmKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const okm = new Uint8Array(
    await crypto.subtle.sign("HMAC", okmKey, concat(info, new Uint8Array([0x01]))),
  );
  return okm.slice(0, length);
}

/**
 * Encrypt a plaintext string using RFC 8291 Web Push Message Encryption (aes128gcm).
 * Returns the encrypted body ready to POST to the push service endpoint.
 */
export async function encryptWebPushPayload(
  plaintext: string,
  p256dhBase64: string,
  authBase64: string,
): Promise<{ body: Uint8Array; contentEncoding: string }> {
  const uaPublicKeyBytes = base64urlDecode(p256dhBase64);
  const authSecret = base64urlDecode(authBase64);

  // Generate ephemeral application-server (AS) ECDH key pair
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const asPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", asKeyPair.publicKey),
  );

  // Import UA (browser) public key for ECDH
  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info\0"||ua_pub||as_pub, L=32)
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublicKeyBytes,
    asPublicKeyBytes,
  );
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  // Random 16-byte salt for content encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);

  // Nonce = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Import CEK for AES-GCM
  const cekKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"],
  );

  // Padded plaintext: content + 0x02 (last-record delimiter)
  const plaintextBytes = enc.encode(plaintext);
  const padded = concat(plaintextBytes, new Uint8Array([0x02]));

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, cekKey, padded),
  );

  // RFC 8188 encrypted content body:
  // salt(16) || rs(4, BE=4096) || idlen(1=65) || as_public_key(65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const body = concat(
    salt,
    rs,
    new Uint8Array([asPublicKeyBytes.length]),
    asPublicKeyBytes,
    ciphertext,
  );

  return { body, contentEncoding: "aes128gcm" };
}

/**
 * Create VAPID Authorization header for a Web Push request.
 * Uses ES256 (ECDSA with P-256 and SHA-256).
 */
export async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKeyBase64: string,
  vapidPrivateKeyBase64: string,
  subject: string,
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = base64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64urlEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));

  const signingInput = `${header}.${payload}`;

  // Reconstruct JWK from raw public (65 bytes) + private (32 bytes) key bytes
  const pubKeyBytes = base64urlDecode(vapidPublicKeyBase64);
  const privKeyJwk = {
    kty: "EC",
    crv: "P-256",
    x: base64urlEncode(pubKeyBytes.slice(1, 33)),
    y: base64urlEncode(pubKeyBytes.slice(33, 65)),
    d: vapidPrivateKeyBase64,
  };

  const privateKey = await crypto.subtle.importKey(
    "jwk", privKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      enc.encode(signingInput),
    ),
  );

  const jwt = `${signingInput}.${base64urlEncode(signature)}`;
  return `vapid t=${jwt},k=${vapidPublicKeyBase64}`;
}

/**
 * Send a Web Push notification to a single subscription.
 * Returns the HTTP status code from the push service.
 */
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<number> {
  const { body, contentEncoding } = await encryptWebPushPayload(
    payload,
    subscription.p256dh,
    subscription.auth,
  );

  const authHeader = await createVapidAuthHeader(
    subscription.endpoint,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Encoding": contentEncoding,
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
    },
    body,
  });

  return response.status;
}
