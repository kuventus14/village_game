// 가입·로그인·아바타 저장. 비밀번호는 scrypt 로 암호화해서 저장하고, 로그인 토큰은 해시만 저장함.
import { ownedWith, wearable } from './public/closet.js';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cleanAvatar } from './public/world.js';

const scrypt = promisify(crypto.scrypt);
const NICK = /^[0-9A-Za-z가-힣_]{2,10}$/; // 닉네임(게임 안 표시, 중복 불가)
const LOGIN_ID = /^[0-9A-Za-z_]{4,16}$/; // 로그인 아이디(중복 불가)
const DAY = 86400000;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const E = { nick: '닉네임은 2~10자의 한글·영문·숫자·_ 만 쓸 수 있어요', id: '아이디는 4~16자의 영문·숫자·_ 만 쓸 수 있어요', pw: '비밀번호는 6자 이상 64자 이하로 해 주세요', dup: '이미 있는 아이디예요', dupNick: '이미 있는 닉네임이에요', bad: '아이디 또는 비밀번호가 맞지 않아요', many: '시도가 너무 많아요. 잠시 후 다시 해 주세요', login: '로그인이 필요해요' };

export function createAuth(store, { reserved = () => false } = {}) { // reserved(닉네임): 봇 닉네임처럼 가입에 못 쓰는 이름
  const tries = new Map(); // ip → { n, reset }  (가입·로그인 시도 횟수 제한)
  const limited = (ip) => {
    const now = Date.now(), t = tries.get(ip);
    if (!t || t.reset < now) { tries.set(ip, { n: 1, reset: now + 5 * 60000 }); return false; }
    return ++t.n > 15;
  };
  const hash = (pw, salt) => scrypt(pw, salt, 32).then((b) => b.toString('hex'));
  const userKey = (id) => 'user:' + String(id).toLowerCase();
  // 닉네임 중복: 새 계정은 'nick:' 표에 올라 있고, 옛 계정(id 필드 없음)은 닉네임이 곧 아이디
  const nickTaken = async (nick) => { const k = nick.toLowerCase(); if (await store.get('nick:' + k)) return true; const old = await store.get('user:' + k); return !!old && !old.id; };

  async function newSession(id) {
    const token = crypto.randomBytes(32).toString('hex');
    await store.set('sess:' + sha(token), { id: String(id).toLowerCase(), exp: Date.now() + 30 * DAY });
    return token;
  }
  async function me(token) { // 토큰 → { id(로그인 아이디), nick(표시 이름), user } (없거나 만료면 null)
    if (typeof token !== 'string' || token.length !== 64) return null;
    const s = await store.get('sess:' + sha(token));
    if (!s || s.exp < Date.now()) return null;
    const id = s.id ?? s.nick; // 옛 세션은 nick 만 저장(그땐 닉네임 = 아이디)
    const user = await store.get(userKey(id));
    return user ? { id: String(id).toLowerCase(), nick: user.nick, user } : null;
  }
  const info = (u) => ({ id: u.id ?? u.nick, nick: u.nick, avatar: u.avatar, closet: ownedWith(u.closet, u.avatar) }); // closet: 산 옷(+지금 입은 옷)

  const actions = {
    async signup({ id, nick, pw }) { // id 없이 보내면(옛 방식·스크립트) 닉네임이 아이디를 겸함
      const same = id == null;
      if (same) id = nick;
      if (!same && !LOGIN_ID.test(id ?? '')) return [400, E.id];
      if (!NICK.test(nick ?? '')) return [400, E.nick];
      if (typeof pw !== 'string' || pw.length < 6 || pw.length > 64) return [400, E.pw];
      if (await store.get(userKey(id))) return [409, E.dup];
      if (reserved(nick) || (await nickTaken(nick))) return [409, E.dupNick];
      const salt = crypto.randomBytes(16).toString('hex');
      const user = { id, nick, salt, hash: await hash(pw, salt), avatar: null, created: Date.now() };
      await store.set(userKey(id), user);
      await store.set('nick:' + nick.toLowerCase(), { id: String(id).toLowerCase() });
      return [200, { token: await newSession(id), ...info(user) }];
    },
    async login({ id, nick, pw }) { // nick 은 옛 클라이언트 호환
      const key = id ?? nick;
      const user = typeof key === 'string' && typeof pw === 'string' ? await store.get(userKey(key)) : null;
      const h = await hash(String(pw ?? ''), user?.salt ?? 'x'.repeat(32)); // 없는 아이디도 같은 시간이 걸리게
      if (!user || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(user.hash))) return [401, E.bad];
      return [200, { token: await newSession(user.id ?? user.nick), ...info(user) }];
    },
    async me({ token }) {
      const m = await me(token);
      return m ? [200, info(m.user)] : [401, E.login];
    },
    async avatar({ token, avatar }) {
      const m = await me(token);
      if (!m) return [401, E.login];
      const next = cleanAvatar(avatar), owned = ownedWith(m.user.closet, m.user.avatar); // 지금 입고 있던 유료 옷은 계속 입을 수 있음(예전 계정 보호)
      if (!wearable(next, owned)) return [400, '아직 안 산 옷이에요 · 마을 광장의 옷 가게에서 살 수 있어요'];
      m.user.closet = owned; m.user.avatar = next;
      await store.set(userKey(m.id), m.user);
      return [200, info(m.user)];
    },
    async logout({ token }) {
      if (typeof token === 'string') await store.del('sess:' + sha(token));
      return [200, {}];
    },
  };

  // POST /api/<action> (JSON). 처리했으면 true
  async function handle(req, res, ip) {
    const name = req.url.split('?')[0].slice(5);
    if (req.method !== 'POST' || !actions[name]) { res.writeHead(404); res.end(); return true; }
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 4096) { res.writeHead(413); res.end(); return true; } chunks.push(c); }
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = null; }
    let status, out;
    if (!body || typeof body !== 'object') [status, out] = [400, '잘못된 요청이에요'];
    else if ((name === 'login' || name === 'signup') && limited(ip)) [status, out] = [429, E.many];
    else try { [status, out] = await actions[name](body); } catch (e) { console.error(e); [status, out] = [500, '서버 오류예요. 잠시 후 다시 해 주세요']; }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(status === 200 ? { ok: true, ...out } : { ok: false, error: out }));
    return true;
  }
  async function saveChips(id, chips, refillAt) { // 지갑 칩 저장 (id = 로그인 아이디, refillAt: 파산 구제 받은 시각)
    const u = await store.get(userKey(id));
    if (!u) return;
    u.chips = chips; if (refillAt) u.refillAt = refillAt;
    await store.set(userKey(id), u);
  }
  async function saveFish(id, fish) { // 낚시 도감 저장: { 물고기키: { n: 잡은 수, best: 최대 cm } }
    const u = await store.get(userKey(id));
    if (!u) return;
    u.fish = fish;
    await store.set(userKey(id), u);
  }
  async function saveShop(id, shop) { // 물고기 가방·오늘 판 수 저장: { bag: { 물고기키: 마리 수 }, day: 한국 날짜 번호, sold: 그날 판 마리 수 }
    const u = await store.get(userKey(id));
    if (!u) return;
    u.shop = shop;
    await store.set(userKey(id), u);
  }
  async function saveCloset(id, closet) { // 산 옷·꾸미기 목록 저장: ['os3', 'ac2', …]
    const u = await store.get(userKey(id));
    if (!u) return;
    u.closet = closet;
    await store.set(userKey(id), u);
  }
  async function saveHouse(id, house) { // 내 집 저장: { plot: 집터 번호, roof: 지붕 색 번호, name: 문패 }
    const u = await store.get(userKey(id));
    if (!u) return;
    u.house = house;
    await store.set(userKey(id), u);
  }
  async function saveSacred(id, rec) { // 성당·사찰·교회 기록 저장: { bows, beads, candles, rosaries, sung, played, ritual, day, today }
    const u = await store.get(userKey(id));
    if (!u) return;
    u.sacred = rec;
    await store.set(userKey(id), u);
  }
  return { handle, me, saveChips, saveFish, saveShop, saveCloset, saveHouse, saveSacred, nickTaken };
}
