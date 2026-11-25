// 아이디/비번 암호화 저장.
// AES-GCM 키를 extractable:false 로 만들어 IndexedDB에 둔다. 키 값 자체는 JS로도 꺼낼 수 없고 암복호화에만 쓸 수 있다.
// 암호문은 localStorage에 둔다. 앱 데이터를 통째로 가져가도 키 없이 평문을 얻을 수 없다.
const vault = (() => {
  const CREDS_KEY = 'creds';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('phoenix-qr', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keys');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idb(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction('keys', mode).objectStore('keys'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getKey() {
    const existing = await idb('readonly', (s) => s.get('aes'));
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idb('readwrite', (s) => s.put(key, 'aes'));
    return key;
  }

  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function save(creds) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), new TextEncoder().encode(JSON.stringify(creds)));
    localStorage.setItem(CREDS_KEY, JSON.stringify({ iv: toB64(iv), data: toB64(data) }));
  }

  // 저장된 게 없거나 복호화에 실패하면(키 유실 등) null.
  async function load() {
    const saved = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null');
    if (!saved) return null;
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(saved.iv) }, await getKey(), fromB64(saved.data));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch {
      localStorage.removeItem(CREDS_KEY);
      return null;
    }
  }

  const clear = () => localStorage.removeItem(CREDS_KEY);

  return { save, load, clear };
})();
