// 서버 주소 도우미: 화면과 서버가 같은 곳이든 다른 곳(Vercel + 별도 서버)이든 같은 코드로 동작
const BASE = (window.VILLAGE?.server || '').replace(/\/$/, '');
export const wsUrl = () => (BASE ? BASE.replace(/^http/, 'ws') : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
export async function api(name, body) {
  try {
    const r = await fetch(`${BASE}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return { ok: false, error: '서버에 연결할 수 없어요' }; }
}
