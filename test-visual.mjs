// 그래픽 시험: 품질 단계 고르기 규칙, three 애드온(후처리 등)을 서버가 내려주는지, 폴더 밖 주소는 막는지
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pickLevel, settings, LEVELS } from './public/quality.js';

assert.equal(pickLevel({ param: 'low', stored: 'high', coarse: false }), 'low', '?q= 가 제일 먼저');
assert.equal(pickLevel({ param: 'toString', stored: 'normal', coarse: false }), 'normal', '이상한 값은 무시');
assert.equal(pickLevel({ param: null, stored: null, coarse: false }), 'high', 'PC 기본은 높음');
assert.equal(pickLevel({ param: null, stored: null, coarse: true }), 'normal', '폰 기본은 보통');
assert.equal(pickLevel({ param: null, stored: null, coarse: true, memory: 2 }), 'low', '메모리 작은 폰은 낮음');
for (const l of Object.keys(LEVELS)) { const s = settings(l); assert.ok(s.shadow <= 2048 && s.grass > 0 && s.dpr >= 1, l); }
assert.ok(settings('low').grass < settings('normal').grass && settings('normal').grass < settings('high').grass, '낮을수록 풀이 적음');
assert.equal(settings('low').post, false, '낮음은 후처리 없음');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-vis-'));
const { listen } = await import('./server.js');
const PORT = 3397, srv = await listen(PORT);
for (const f of ['postprocessing/UnrealBloomPass.js', 'postprocessing/Pass.js', 'utils/BufferGeometryUtils.js']) {
  const r = await fetch(`http://localhost:${PORT}/vendor/three-addons/${f}`);
  assert.equal(r.status, 200, f);
}
const html = await (await fetch(`http://localhost:${PORT}/`)).text();
assert.ok(html.includes('"three/addons/":"/vendor/three-addons/"'), 'importmap 에 애드온 경로');
for (const m of ['quality', 'gfx', 'textures', 'daycycle', 'atmosphere', 'nature', 'water', 'town', 'life', 'post', 'buildings', 'casino', 'sacred', 'trail']) assert.equal((await fetch(`http://localhost:${PORT}/${m}.js`)).status, 200, m);
const bad = await new Promise((res) => { // 경로 정리 없이 날것으로 보내 폴더 밖 접근을 시도
  import('node:http').then(({ default: http }) => http.get({ host: 'localhost', port: PORT, path: '/vendor/three-addons/../../../package.json' }, (r) => { r.resume(); res(r.statusCode); }));
});
assert.equal(bad, 404, '애드온 폴더 밖은 막힘');
srv.close();
console.log('그래픽 품질 단계·애드온 내려주기 시험 통과');
process.exit(0);
