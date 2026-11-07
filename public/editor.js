// 아바타 꾸미기 화면: 성별 + 탭(머리/얼굴/옷/꾸미기). 고르면 onChange(아바타) 로 알려 줌.
import { OPT, OUTFITS, HAIRS, SKINS, BOTTOMS, defaultAvatar, randomAvatar, cleanAvatar } from './world.js';
import { PRICE, lockFix } from './closet.js';

const TABS = [
  ['머리', [['chips', 'hs', '머리 모양', OPT.hs], ['sw', 'hc', '머리 색', HAIRS]]],
  ['얼굴', [['chips', 'ey', '눈 모양', OPT.ey], ['sw', 'sk', '피부색', SKINS]]],
  ['옷', [['chips', 'os', '옷 스타일', OPT.os], ['sw', 'oc', '옷 색', OUTFITS], ['sw', 'bc', '바지·치마 색', BOTTOMS]]],
  ['꾸미기', [['chips', 'ac', '악세서리', OPT.ac]]],
];

export function createEditor(root, onChange, { onLocked } = {}) {
  let sel = defaultAvatar('m'), tab = 0, owned = []; // owned: 산 유료 옷 목록 (옷 가게). 안 산 건 잠김
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const btn = (text, fn, cls) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };

  const gs = el('div', 'seg');
  for (const [g, t] of [['m', '👦 남자'], ['f', '👧 여자']]) { const b = btn(t, () => setGender(g)); b.dataset.g = g; gs.append(b); }
  const tabs = el('div', 'tabs'), body = el('div', 'optbody');
  TABS.forEach(([name], i) => { const b = btn(name, () => { tab = i; sync(); }); b.dataset.t = i; tabs.append(b); });
  const sections = TABS.map(([, secs]) => {
    const box = el('div', 'optbox');
    for (const [kind, key, title, list] of secs) {
      box.append(el('div', 'ot', title));
      const row = el('div', kind === 'sw' ? 'sw' : 'chips');
      list.forEach((v, i) => {
        const b = btn(kind === 'sw' ? '' : v, () => { if (PRICE[key + i] && !owned.includes(key + i)) return onLocked?.(key + i); sel[key] = i; sync(true); });
        if (PRICE[key + i]) { b.dataset.p = key + i; b.dataset.n = v; }
        if (kind === 'sw') { b.style.background = v; b.setAttribute('aria-label', `${title} ${i + 1}`); }
        b.dataset.k = key; b.dataset.i = i; row.append(b);
      });
      box.append(row);
    }
    body.append(box); return box;
  });
  root.replaceChildren(gs, tabs, body);

  function setGender(g) { // 성별을 바꾸면 기본 머리·옷도 그 성별 기본으로 (직접 고른 건 유지)
    const o = defaultAvatar(sel.g), n = defaultAvatar(g);
    for (const k of ['hs', 'os', 'oc']) if (sel[k] === o[k]) sel[k] = n[k];
    sel.g = g; sync(true);
  }
  function sync(changed) {
    gs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.g === sel.g));
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.t === tab));
    sections.forEach((s, i) => (s.hidden = i !== tab));
    body.querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-pressed', sel[b.dataset.k] === +b.dataset.i));
    body.querySelectorAll('[data-p]').forEach((b) => { const lock = !owned.includes(b.dataset.p); b.classList.toggle('lock', lock); b.textContent = lock ? `🔒 ${b.dataset.n}` : b.dataset.n; }); // 안 산 옷은 잠금 표시
    if (changed) onChange(sel);
  }
  sync();
  return {
    get: () => ({ ...sel }),
    set(a) { sel = cleanAvatar(a); sync(true); },
    random() { sel = lockFix(randomAvatar(sel.g), owned, defaultAvatar(sel.g)); sync(true); }, // 안 산 옷은 빼고 랜덤
    setOwned(list) { owned = list || []; sync(); },
  };
}
