// 하늘·빛·안개·구름·먼 산과 먼 숲 + 한국 시간 낮·밤(해·달·별·노을). 시간 계산은 daycycle.js
import * as THREE from 'three';
import { soft, lumpy, paint, rng, groundH, Batch, instanced, U, GLOWS } from './gfx.js';
import { trailNear, TEMPLE_YARD, inTown, campDist, parkDist, PARK, PARK_CENTER } from './world.js';
import { KST, kstHours, kstParts, sunTimes, sunVec, keyTimes, newState, skyState, moonPhase, makeClock } from './daycycle.js';

const SRGB = THREE.SRGBColorSpace, DEG = Math.PI / 180;
const IN_DAY = { sky: new THREE.Color('#d6ebff'), ground: new THREE.Color('#e9dcc6'), sun: new THREE.Color('#ffe9c7'), dir: new THREE.Vector3(0.62, 0.58, 0.5).normalize(), sunI: 2.2, hemiI: 2.1, fillI: 0.45, fillC: new THREE.Color('#b8c6ff'), exp: 1, bloom: 0.28 }; // 카페·회사·카지노: 늘 맑은 낮 조명
// 성당·교회·사찰 안: 시간과 무관하게 고정된 '따뜻한 노을 실내' 톤 (분홍·살구 반사광 + 주황 해빛 + 분홍 보조광, 블룸 강하게 → 랜턴·창이 번짐)
const IN_WARM = { sky: new THREE.Color('#ffe2cc'), ground: new THREE.Color('#ffc8b8'), sun: new THREE.Color('#ffd8b0'), dir: new THREE.Vector3(0.62, 0.58, 0.5).normalize(), sunI: 1.55, hemiI: 1.8, fillI: 0.45, fillC: new THREE.Color('#ffb0cc'), exp: 1.0, bloom: 0.42 }; // 그림과 비교해 덜 주황, 크림·분홍 대비가 살게
// 밤의 실내: 같은 조명이 문 밖 땅·나무에도 비치므로(빛은 장면 전체에 하나) 낮 조명을 그대로 쓰면 문 밖이 아침처럼 보임 → 밤엔 해빛을 달빛 정도로 줄이고 방향은 진짜 달·해 방향을 그대로 두며, 실내는 따뜻한 반사광(hemi)·발광 램프로 아늑하게
const NIGHT_IN = { sky: new THREE.Color('#b9bff0'), ground: new THREE.Color('#7c789e'), sun: new THREE.Color('#bcc8ff'), sunI: 0.75, hemiI: 1.5, fillI: 0.3, fillC: new THREE.Color('#ffd2b0'), exp: 1.08, bloom: 0.6 }; // 밖의 밤 색(푸른 hemi 0.49·0.58·0.88)에 가깝게 맞추되 실내가 읽힐 만큼만 밝게 — 색이 따뜻하고 밝으면 문 밖이 낮처럼 보임
const SACRED_KEYS = new Set(['cathedral', 'church', 'temple']);
let IN = IN_DAY;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createAtmosphere(scene, camera, Q, renderer, post) {
  camera.far = 1500; camera.updateProjectionMatrix();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog('#f4ead9', 95, 640);

  // 빛: 해(밤엔 달) + 하늘·땅 반사광 + 반대편의 차가운 보조광
  const hemi = new THREE.HemisphereLight('#d6ebff', '#b4d39a', 1.55);
  const sun = new THREE.DirectionalLight('#ffe9c7', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
  sun.shadow.radius = Q.level === 'low' ? 1 : 3; // 부드러운 그림자 가장자리
  sun.shadow.intensity = 0.82; // 그림자도 너무 새까맣지 않게
  const fill = new THREE.DirectionalLight('#b8c6ff', 0.45);
  fill.position.set(-0.6, 0.35, -0.5);
  scene.add(hemi, sun, sun.target, fill);
  const L = U.light.value; // 지금 빛이 오는 방향 (물 반짝임도 같이 씀)
  const follow = (x, y, z) => { sun.position.set(x + L.x * 70, y + L.y * 70, z + L.z * 70); sun.target.position.set(x, y, z); };

  // 하늘 돔: 지평선(=안개색) → 하늘색 그라데이션 + 노을 띠 + 해·달 원반과 빛무리 + 은하수. 카메라를 따라다니며 항상 맨 뒤에 그려짐
  const SU = { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uHalo: { value: 0 }, uStar: { value: 0 }, uPhase: { value: new THREE.Vector2(1, -1) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: SU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 uTop, uMid, uHor, uSun, uGlow, uSunDir, uMoonDir; uniform float uHalo, uStar; uniform vec2 uPhase; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float y = d.y, up = smoothstep(-0.03, 0.03, y);
        vec3 c = mix(uHor, uMid, smoothstep(0.02, 0.28, y));
        c = mix(c, uTop, smoothstep(0.25, 0.95, y));
        float az = max(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.0);
        c = mix(c, uGlow, pow(az, 3.0) * (1.0 - smoothstep(-0.05, 0.45, y)) * uHalo * 0.6 * smoothstep(-0.3, 0.0, uSunDir.y)); // 해 쪽 지평선이 노을빛으로
        float s = max(dot(d, uSunDir), 0.0);
        c += uGlow * (pow(s, 5.0) * 0.22 + pow(s, 48.0) * 0.45) * up * (0.5 + uHalo);
        c = mix(c, uSun * 3.2, smoothstep(0.99955, 0.99975, s) * up);
        float mw = dot(d, vec3(0.48, 0.36, -0.8)); // 은하수: 기울어진 큰 띠
        c += vec3(0.5, 0.56, 0.95) * exp(-mw * mw * 30.0) * (0.65 + 0.35 * sin(d.x * 23.0 + sin(d.z * 17.0) * 2.0) * sin(d.y * 19.0 + d.z * 13.0)) * 0.07 * uStar * up;
        float m = dot(d, uMoonDir); // 달: 커다란 원반 + 위상 + 푸른 달무리
        vec3 mr = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0))), mu = cross(mr, uMoonDir);
        vec2 q = vec2(dot(d, mr), dot(d, mu)) / 0.032;
        float disc = (1.0 - smoothstep(0.8, 1.0, dot(q, q))) * step(0.0, m) * up;
        float lit = smoothstep(-0.1, 0.1, uPhase.y * q.x - uPhase.x * sqrt(max(1.0 - q.y * q.y, 0.0)));
        float mv = mix(0.35, 1.0, uStar);
        c += vec3(0.55, 0.66, 1.0) * pow(max(m, 0.0), 260.0) * 0.4 * mv * up;
        vec3 mc = mix(c * 0.7 + vec3(0.03, 0.04, 0.08), vec3(1.0, 0.95, 0.82) * 2.2 * (0.92 - 0.12 * smoothstep(0.2, 0.5, sin(q.x * 6.0 + 1.0) * sin(q.y * 5.0 - 0.5))), lit); // 어두운 쪽은 하늘보다 살짝 어둡게
        c = mix(c, mc, disc * mv);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  // 별: Points 하나. 맨 뒤(먼 평면)에 그려서 언덕·건물에 자연스럽게 가림. 일부는 은하수 띠에 몰림
  const SR = rng(77), NS = { high: 1200, normal: 800, low: 450 }[Q.level], sp = new Float32Array(NS * 3), ss = new Float32Array(NS);
  const band = new THREE.Vector3(0.48, 0.36, -0.8).normalize(), v3 = new THREE.Vector3();
  for (let i = 0; i < NS; i++) {
    do v3.set(SR() * 2 - 1, SR() * 2 - 1, SR() * 2 - 1); while (v3.lengthSq() > 1 || v3.lengthSq() < 0.01);
    v3.normalize();
    if (i % 3 === 0) v3.addScaledVector(band, -v3.dot(band) * 0.85).normalize();
    if (v3.y < -0.05) v3.y = -v3.y;
    v3.multiplyScalar(90).toArray(sp, i * 3); ss[i] = SR();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
  const starU = { uStar: { value: 0 }, uTime: U.time, uPx: { value: renderer.getPixelRatio() } };
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    defines: Q.level === 'low' ? {} : { TWINKLE: 1 },
    vertexShader: `attribute float aSeed; uniform float uTime, uStar, uPx; varying float vA; varying vec3 vC;
      void main(){
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); p.z = p.w; gl_Position = p;
        float tw = 1.0;
        #ifdef TWINKLE
          tw = 0.6 + 0.4 * sin(uTime * (1.3 + aSeed * 3.0) + aSeed * 50.0);
        #endif
        vA = uStar * tw * smoothstep(-0.02, 0.15, position.y / 90.0);
        vC = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), fract(aSeed * 7.0));
        gl_PointSize = (1.3 + aSeed * aSeed * 2.8) * uPx;
      }`,
    fragmentShader: `varying float vA; varying vec3 vC;
      void main(){ float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5)) * vA; gl_FragColor = vec4(vC * 1.5, a); }`,
  }));
  stars.renderOrder = -9; stars.frustumCulled = false;
  sky.add(stars);

  // 몽글몽글 구름: 모양 3가지 × 여러 개, 천천히 흘러감
  const R = rng(31), cloudMat = soft('#ffffff', { vertexColors: true, fog: false, emissive: new THREE.Color('#5d6a8a'), emissiveIntensity: 0.28 });
  const clouds = [];
  for (let k = 0; k < 3; k++) {
    const b = new Batch(), n = 5 + k * 2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5, r = 0.9 + Math.cos(t * Math.PI) * 0.8 + R() * 0.3;
      b.add('c', lumpy(new THREE.SphereGeometry(1, 11, 8), 0.08, 1.3, i * 7 + k), { pos: [t * (5 + k * 1.5), r * 0.25 + R() * 0.3, (R() - 0.5) * 1.4], s: [r, r * 0.8, r] });
    }
    const cg = b.geometry('c');
    cg.computeBoundingBox();
    const yb = cg.boundingBox.min.y, yt = cg.boundingBox.max.y;
    paint(cg, (x, y) => { const u = (y - yb) / (yt - yb); return [0.86 + u * 0.16, 0.86 + u * 0.15, 0.95 + u * 0.06]; }); // 아래는 살짝 보랏빛 그늘
    const list = [];
    for (let i = 0; i < 5; i++) { const a = R() * Math.PI * 2, d = 140 + R() * 300; list.push({ x: Math.sin(a) * d, y: 75 + R() * 55, z: Math.cos(a) * d, s: 7 + R() * 7, ry: R() * 3 }); }
    const im = instanced(scene, cg, cloudMat, list, { recv: false });
    im.frustumCulled = false;
    clouds.push({ im, list });
  }

  // 먼 산: 둥글둥글한 파스텔 산 띠 (안개에 묻혀 푸르스름하게)
  const mb = new Batch();
  for (let i = 0; i < 18; i++) {
    let a = (i / 18) * Math.PI * 2 + R() * 0.25, d = 380 + R() * 140, w = 70 + R() * 70, h = 35 + R() * 55;
    while (Math.hypot(Math.sin(a) * d - TEMPLE_YARD.cx, Math.cos(a) * d - TEMPLE_YARD.cz) < w * 0.9 + 70 + TEMPLE_YARD.w * 0.7 || Math.hypot(Math.sin(a) * d - PARK_CENTER.x, Math.cos(a) * d - PARK_CENTER.z) < w * 0.9 + 40 + (PARK.x1 - PARK.x0) * 0.62) d += 10; // 사찰·놀이공원 뒤로 물러남
    const g = lumpy(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0.07, 2.2, i * 13);
    paint(g, (x, y) => { const u = y; return [0.55 + u * 0.35, 0.72 + u * 0.22, 0.68 + u * 0.3]; });
    mb.add('m', g, { pos: [Math.sin(a) * d, -6, Math.cos(a) * d], s: [w, h, w * (0.7 + R() * 0.4)], rot: [0, R() * 3, 0] });
  }
  mb.build(scene, { m: soft('#b4d6b8', { vertexColors: true }) }, { cast: false, recv: false });

  // 먼 숲: 울타리 밖 언덕 위의 단순한 나무 띠 (인스턴싱 2종)
  const blob = paint(lumpy(new THREE.SphereGeometry(1, 8, 6), 0.1, 2), (x, y) => [0.78 + y * 0.25, 0.8 + y * 0.22, 0.8 + y * 0.12]);
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5).translate(0, -0.9, 0);
  const pine = paint(new THREE.ConeGeometry(0.8, 2.4, 7).translate(0, 0.9, 0), (x, y) => [0.75 + y * 0.12, 0.8 + y * 0.1, 0.85]);
  const geoRound = new Batch().add('t', trunk, { color: '#9a6b4f' }).add('t', blob, { pos: [0, 0.4, 0] }).geometry('t');
  const geoPine = new Batch().add('t', trunk, { color: '#8a5e46' }).add('t', pine).geometry('t');
  const lists = [[], []], pal = ['#7fc77a', '#93d07a', '#6db88a', '#a7d77c', '#5fae86'];
  for (let i = 0; i < Q.farTrees; i++) {
    const a = R() * Math.PI * 2, d = 95 + Math.pow(R(), 0.7) * 130, x = Math.sin(a) * d, z = Math.cos(a) * d, s = 2.4 + R() * 2.2, k = R() < 0.65 ? 0 : 1;
    if (inTown(x, z, -8) || trailNear(x, z).d < 26 || campDist(x, z) < 26 || parkDist(x, z) < 26 || Math.hypot(x - TEMPLE_YARD.cx, z - TEMPLE_YARD.cz) < TEMPLE_YARD.w * 0.8) continue; // 마을 안·숲길·사찰 둘레는 비움 (trail.js 의 숲이 채움)
    lists[k].push({ x, y: groundH(x, z) + s * 0.9, z, s, ry: R() * 6, c: pal[Math.floor(R() * pal.length)] });
  }
  const farMat = soft('#ffffff', { vertexColors: true });
  instanced(scene, geoRound, farMat, lists[0]); instanced(scene, geoPine, farMat, lists[1]);

  // 매 프레임: 마을 시각 → 키프레임 분위기 → 빛·하늘·안개·구름·발광 재질. 실내(inKey)에선 낮 조명으로 부드럽게 바꿈
  const S = newState(), sv = [0, 0, 0], day = { idx: NaN, doy: 0, times: null }, tmp = new THREE.Color(), ta = new THREE.Color();
  let ind = 0, lastN = -1;
  const atmo = {
    hemi, sun, fill, follow, state: S, ms: Date.now(), clock: makeClock(),
    update(dt, camera, inKey) {
      const ms = (atmo.ms = atmo.clock(Date.now())), di = Math.floor((ms + KST) / 864e5);
      if (di !== day.idx) { day.idx = di; day.doy = kstParts(ms).doy; day.times = keyTimes(sunTimes(day.doy)); } // 날이 바뀔 때만
      const h = kstHours(ms);
      skyState(h, day.times, S);
      sunVec(day.doy, h, sv);
      if (inKey) IN = SACRED_KEYS.has(inKey) ? IN_WARM : IN_DAY; // 어느 실내인지에 따라 실내 조명 고름 (밖으로 나가면 마지막 것에서 서서히 풀림)
      ind += ((inKey ? 1 : 0) - ind) * (1 - Math.exp(-dt * 6));

      // 해와 달 중 센 쪽이 빛을 냄 (둘 다 0 인 해질녘·새벽에 바뀌어 티가 안 남). 방위는 진짜, 높이는 12° 이상으로 들어 올려 낮은 해에도 장면이 밝게
      const useSun = S.sunI >= S.moonI, g = useSun ? 1 : -1, la = (12 + 0.85 * Math.max(0, Math.asin(Math.max(-1, Math.min(1, sv[1] * g))) / DEG)) * DEG, hl = Math.hypot(sv[0], sv[2]) || 1;
      const nk = smooth(0.25, 0.75, S.night), eff = (a, b) => a + (b - a) * nk; // nk: 밤일수록 1 → 실내 조명도 밤 쪽 (해질녘·새벽엔 서서히)
      L.set((sv[0] * g / hl) * Math.cos(la), Math.sin(la), (sv[2] * g / hl) * Math.cos(la)).lerp(IN.dir, ind * (1 - nk)).normalize();
      sun.color.setRGB(S.sun[0], S.sun[1], S.sun[2], SRGB).lerp(ta.copy(IN.sun).lerp(NIGHT_IN.sun, nk), ind);
      sun.intensity = Math.max(S.sunI, S.moonI) + (eff(IN.sunI, NIGHT_IN.sunI) - Math.max(S.sunI, S.moonI)) * ind;
      sun.shadow.intensity = useSun ? 0.82 : Q.level === 'low' ? 0 : 0.5; // 달 그림자는 옅게, 낮음 단계는 없음
      renderer.shadowMap.autoUpdate = useSun || Q.level !== 'low';
      hemi.color.setRGB(S.hemiS[0], S.hemiS[1], S.hemiS[2], SRGB).lerp(ta.copy(IN.sky).lerp(NIGHT_IN.sky, nk), ind);
      hemi.groundColor.setRGB(S.hemiG[0], S.hemiG[1], S.hemiG[2], SRGB).lerp(ta.copy(IN.ground).lerp(NIGHT_IN.ground, nk), ind);
      hemi.intensity = S.hemiI + (eff(IN.hemiI, NIGHT_IN.hemiI) - S.hemiI) * ind;
      fill.intensity = S.fillI + (eff(IN.fillI, NIGHT_IN.fillI) - S.fillI) * ind; fill.color.set('#b8c6ff').lerp(ta.copy(IN.fillC).lerp(NIGHT_IN.fillC, nk), ind);
      post.tone(S.exp + (eff(IN.exp, NIGHT_IN.exp) - S.exp) * ind, S.bloom + (eff(IN.bloom, NIGHT_IN.bloom) - S.bloom) * ind);

      scene.fog.color.setRGB(S.hor[0], S.hor[1], S.hor[2], SRGB); scene.background.copy(scene.fog.color);
      SU.uTop.value.setRGB(S.top[0], S.top[1], S.top[2], SRGB); SU.uMid.value.setRGB(S.mid[0], S.mid[1], S.mid[2], SRGB); SU.uHor.value.copy(scene.fog.color);
      SU.uGlow.value.setRGB(S.glow[0], S.glow[1], S.glow[2], SRGB); SU.uSun.value.setRGB(S.sun[0], S.sun[1], S.sun[2], SRGB);
      SU.uSunDir.value.fromArray(sv); SU.uMoonDir.value.fromArray(sv).negate();
      SU.uHalo.value = S.halo; SU.uStar.value = starU.uStar.value = S.star;
      const ph = moonPhase(ms); SU.uPhase.value.set(Math.min(0.55, Math.cos(ph * Math.PI * 2)), ph < 0.5 ? 1 : -1); // 그믐에도 초승달만큼은 보이게
      stars.visible = S.star > 0.01;
      U.sky.value.setRGB(S.mid[0], S.mid[1], S.mid[2], SRGB).lerp(tmp.setRGB(S.hor[0], S.hor[1], S.hor[2], SRGB), 0.6);
      cloudMat.color.setRGB(S.cloud[0], S.cloud[1], S.cloud[2], SRGB); cloudMat.emissive.setRGB(S.cloudE[0], S.cloudE[1], S.cloudE[2], SRGB);
      U.night.value = S.night;
      if (Math.abs(S.night - lastN) > 0.002) { // 밤 정도가 변할 때만 발광 재질 세기 갱신
        lastN = S.night;
        for (const o of GLOWS) { const k = o.day + (o.night - o.day) * smooth(o.on - 0.12, o.on + 0.12, S.night); o.base ? o.mat.color.copy(o.base).multiplyScalar(k) : (o.mat.emissiveIntensity = k); }
      }

      sky.position.copy(camera.position);
      for (const { im, list } of clouds) {
        list.forEach((c, i) => { c.x += dt * 1.6; if (c.x > 460) c.x = -460; place0(im, i, c); });
        im.instanceMatrix.needsUpdate = true;
      }
    },
  };
  return atmo;
}
const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pv = new THREE.Vector3(), sv = new THREE.Vector3();
function place0(im, i, c) { im.setMatrixAt(i, m4.compose(pv.set(c.x, c.y, c.z), qq.setFromAxisAngle(up, c.ry), sv.setScalar(c.s))); }
