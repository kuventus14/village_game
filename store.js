// 계정·로그인 정보 저장소. 기본은 JSON 파일(내 컴퓨터/디스크가 있는 서버).
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 이 있으면 Upstash Redis(Vercel KV 와 같은 것)에 저장해서
// 서버를 새로 올려도 계정이 남음.
import fs from 'node:fs';
import path from 'node:path';

function fileStore(dir) {
  const file = path.join(dir, 'store.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = {};
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  let timer = null;
  const flush = () => { // 쓰다가 끊겨도 파일이 깨지지 않게 임시 파일에 쓰고 바꿔치기
    timer = null;
    fs.writeFileSync(file + '.tmp', JSON.stringify(db));
    fs.renameSync(file + '.tmp', file);
  };
  const dirty = () => { timer ??= setTimeout(flush, 150); };
  return {
    kind: 'file',
    get: async (k) => db[k] ?? null,
    set: async (k, v) => { db[k] = v; dirty(); },
    del: async (k) => { delete db[k]; dirty(); },
    flush: () => { clearTimeout(timer); flush(); },
  };
}

function upstashStore(url, token) {
  const cmd = async (...args) => {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  };
  return {
    kind: 'upstash',
    get: async (k) => { const v = await cmd('GET', k); return v ? JSON.parse(v) : null; },
    set: async (k, v) => { await cmd('SET', k, JSON.stringify(v)); },
    del: async (k) => { await cmd('DEL', k); },
    flush() {},
  };
}

export function createStore({ dir, upstashUrl, upstashToken } = {}) {
  return upstashUrl && upstashToken ? upstashStore(upstashUrl, upstashToken) : fileStore(dir || './data');
}
