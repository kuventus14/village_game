// 후처리: HDR 로 그린 뒤 → 은은한 블룸(밝은 등불·햇빛 반짝임만) → 톤매핑 + 채도 + 따뜻한 비네트를 한 번에.
// 컴포저 대신 직접 묶어서 큰 렌더 타깃을 하나만 씀 (메모리 절약). 낮음 단계는 후처리 없이 바로 그림
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const TONE = THREE.NeutralToneMapping; // 파스텔 색이 탁해지지 않는 톤매핑

export function createPost(renderer, scene, camera, Q) {
  renderer.toneMapping = TONE;
  renderer.toneMappingExposure = 1.0;
  if (!Q.post) return { render: () => renderer.render(scene, camera), setSize() {}, tone(e) { renderer.toneMappingExposure = e; } };

  const size = new THREE.Vector2();
  const samples = renderer.getPixelRatio() >= 1.75 ? Math.min(Q.samples, 2) : Q.samples; // 레티나에선 MSAA 를 줄여 메모리 절약
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.4, 1.15); // 세기, 번짐, 문턱(이보다 밝은 것만 번짐)
  const quad = new FullScreenQuad(new THREE.RawShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, toneMappingExposure: { value: 1 }, uAspect: { value: 1 } },
    vertexShader: `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; uniform sampler2D tDiffuse; uniform float uAspect; varying vec2 vUv;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      void main(){
        vec3 c = NeutralToneMapping(texture2D(tDiffuse, vUv).rgb);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.08);                                   // 살짝 더 화사하게
        c = sRGBTransferOETF(vec4(max(c, 0.0), 1.0)).rgb;
        vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
        float v = smoothstep(1.05, 0.35, length(d));
        c *= mix(vec3(0.84, 0.78, 0.86), vec3(1.0), v);              // 가장자리는 보랏빛으로 은은하게
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));

  return {
    tone(e, b) { quad.material.uniforms.toneMappingExposure.value = e; bloom.strength = b; }, // 시간대별 노출·블룸 (daycycle)
    setSize() {
      renderer.getDrawingBufferSize(size);
      rt.setSize(size.x, size.y);
      bloom.setSize(Math.round(size.x * Q.bloomScale), Math.round(size.y * Q.bloomScale));
      quad.material.uniforms.uAspect.value = size.x / size.y;
    },
    render(dt) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      bloom.render(renderer, null, rt, dt, false);
      renderer.setRenderTarget(null);
      quad.render(renderer);
    },
  };
}
