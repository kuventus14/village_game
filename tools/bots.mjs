// 개발용 가짜 접속자: node tools/bots.mjs <tag|dodge> [봇 수] [서버주소]
// 지정한 게임의 참가 패드에 서 있다가 게임이 시작되면 돌아다니거나(술래잡기) 물풍선을 던짐(피구).
import { WebSocket } from 'ws';
import { GAMES, TAG, DODGE, resolve, randomAvatar, dodgeClamp } from '../public/world.js';

const [game = 'tag', n = '1', base = 'http://localhost:3300'] = process.argv.slice(2), G = GAMES[game];
const post = async (name, body) => (await fetch(`${base}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

for (let i = 1; i <= +n; i++) {
  const nick = `봇${game === 'tag' ? '술' : '피'}${i}`, pw = 'bot-secret-1';
  let r = await post('signup', { nick, pw });
  if (!r.ok) r = await post('login', { nick, pw });
  await post('avatar', { token: r.token, avatar: randomAvatar(i % 2 ? 'f' : 'm') });
  const ws = new WebSocket(base.replace(/^http/, 'ws'));
  let me = null, x = G.pad.x + i * 0.4, z = G.pad.z, ry = 0, role = null, team = 0, phase = '';
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  const at = () => send({ t: 'm', x, z, ry, w: 0 });
  ws.on('open', () => send({ t: 'join', token: r.token }));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'welcome') { me = m.id; at(); }
    if (m.t === 'tp') { x = m.x; z = m.z; ry = m.ry; }
    if (m.t === 'gstart' || m.t === 'gstate') for (const p of m.parts) if (p[0] === me) { role = p[1]; team = p[1]; phase = m.ph || 'ready'; }
    if (m.t === 'gend') { phase = ''; role = null; x = G.pad.x + i * 0.4; z = G.pad.z; at(); }
  });
  let a = Math.random() * 6;
  setInterval(() => { // 놀이 중 행동
    if (!me || !role || phase !== 'play') return;
    a += (Math.random() - 0.5) * 0.9;
    const sp = 0.4; // 약 4m/s
    [x, z] = resolve(x + Math.sin(a) * sp, z + Math.cos(a) * sp);
    if (game === 'dodge') [x, z] = dodgeClamp(team, x, z);
    ry = a; send({ t: 'm', x, z, ry, w: 1 });
  }, 100);
  if (game === 'dodge') setInterval(() => { if (role !== null && phase === 'play') send({ t: 'throw', dx: team === 0 ? 1 : -1, dz: (Math.random() - 0.5) * 0.4 }); }, 1600);
}
console.log(`${G.name} 봇 ${n}명이 패드에서 기다립니다 (끄려면 Ctrl-C)`);
