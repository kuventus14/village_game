// 소리 공용: AudioContext 하나를 효과음(sfx.js)·배경음악(bgm.js)이 같이 씀 + 마지막 단 리미터(모든 소리를 더해도 찢어지지 않게)
// 브라우저(특히 iOS Safari)는 사용자가 한 번 누르기 전엔 소리를 못 냄 → 첫 터치/키 입력 때 만들고 깨움. 탭이 안 보이면 멈춤(배터리)
let ac = null, out = null;
// 리미터: -6dB 넘는 순간만 세게 눌러 줌 (평소 소리는 그대로). 오프라인 렌더(샘플 내보내기)도 같은 걸 씀
export function makeOut(ctx) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = -6; c.knee.value = 4; c.ratio.value = 12; c.attack.value = 0.003; c.release.value = 0.25;
  c.connect(ctx.destination);
  return c;
}
function unlock() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = makeOut(ac); } catch { ac = null; return null; } }
  if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {});
  return ac;
}
if (typeof document !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { passive: true });
  document.addEventListener('visibilitychange', () => { if (ac) (document.hidden ? ac.suspend() : ac.resume()).catch(() => {}); });
}
export const audio = { get ctx() { return ac; }, get out() { return out; }, unlock };
