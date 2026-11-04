// 화면만 따로 Vercel 같은 정적 호스팅에 올릴 때: public/ + three.js 를 dist/ 로 복사하고, 서버 주소를 config.js 에 적음.
// 사용: VILLAGE_SERVER=https://내서버.onrender.com node tools/build-static.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..'), dist = path.join(root, 'dist');
const server = (process.env.VILLAGE_SERVER || '').replace(/\/$/, '');
if (!server) console.warn('⚠ VILLAGE_SERVER 가 비어 있어요. 화면이 게임 서버를 못 찾습니다.');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
fs.cpSync(path.join(root, 'node_modules/three/build'), path.join(dist, 'vendor/three'), { recursive: true, filter: (f) => !/\.(cjs|webgpu|tsl)/.test(f) });
for (const d of ['postprocessing', 'shaders', 'utils']) fs.cpSync(path.join(root, 'node_modules/three/examples/jsm', d), path.join(dist, 'vendor/three-addons', d), { recursive: true }); // 쓰는 애드온(후처리 등)만
fs.writeFileSync(path.join(dist, 'config.js'), `window.VILLAGE = { server: ${JSON.stringify(server)} };\n`);
console.log(`dist/ 만들었어요 (서버: ${server || '없음'})`);
