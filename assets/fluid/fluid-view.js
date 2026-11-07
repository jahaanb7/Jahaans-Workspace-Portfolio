// fluid-view.js: draws the WebAssembly SPH simulation with WebGL2 and wires up the controls.
//
// The physics is the C++ in src/library (compiled by web/fluid_wasm.cpp). This file only draws:
//   2D: particles are splatted into a density texture, then thresholded into a liquid surface.
//   3D: each particle is a shaded sphere impostor inside the tank, with an orbit camera.
//
// Markup (all optional except the canvas):
//   [data-fluid]                       root
//     canvas[data-fluid-gl]            WebGL2 canvas
//     canvas[data-fluid-overlay]       2D canvas for the neighbourhood circle
//     button[data-fluid-mode="2"|"3"]  mode toggle (aria-pressed)
//     button[data-fluid-play]          play / pause
//     button[data-fluid-reset]         reseed the block
//     button[data-fluid-splash]        radial impulse (the original "Inject Pulse")
//     input[data-fluid-param="h"|"viscosity"|"gravity"]   range sliders
//     output[data-fluid-out="…"]       slider readouts
//     [data-fluid-neigh]               neighbour count under the pointer (2D)
//     [data-fluid-hint]                one-line hint, changes with the mode

const KEY = { viscosity: 0, stiffness: 1, gravity: 2, h: 3, targetDensity: 4 };

const PALETTES = {
  // the colours from velocityColor() in Physics.h
  blue: { low: [0.0, 0.2, 0.87], high: [0.53, 0.61, 0.92], line: [1, 1, 1, 0.22] },
  // the portfolio palette: steel at rest, sky where it moves fast
  sky: { low: [0.29, 0.43, 0.55], high: [0.80, 0.90, 0.96], line: [0.94, 0.94, 0.94, 0.18] },
  mono: { low: [0.40, 0.41, 0.44], high: [0.96, 0.96, 0.95], line: [1, 1, 1, 0.16] },
};

const HINTS = {
  2: 'Drag to stir · click to splash · hover to see who counts',
  3: 'Drag to turn · scroll to zoom · click to splash',
};

/* ---------------- WebGL helpers ---------------- */

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

const mat = {
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  },
  lookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  },
};

/* ---------------- shaders ---------------- */

const SPHERE_VS = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 inst;
uniform mat4 uView, uProj;
uniform float uRadius;
out vec2 vUv; out vec3 vCenter; out float vSpeed;
void main(){
  vec4 c = uView * vec4(inst.xyz, 1.0);
  vCenter = c.xyz; vUv = corner; vSpeed = inst.w;
  gl_Position = uProj * vec4(c.xy + corner * uRadius, c.z, 1.0);
}`;

const SPHERE_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vCenter; in float vSpeed;
uniform mat4 uProj;
uniform float uRadius, uMaxSpeed;
uniform vec3 uLow, uHigh;
out vec4 o;
void main(){
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  vec3 n = vec3(vUv, sqrt(1.0 - r2));
  vec3 p = vCenter + n * uRadius;
  vec4 clip = uProj * vec4(p, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  vec3 L = normalize(vec3(0.4, 0.8, 0.6));
  vec3 V = normalize(-p);
  vec3 H = normalize(L + V);
  float s = clamp(vSpeed / uMaxSpeed, 0.0, 1.0);
  vec3 base = mix(uLow, uHigh, s);
  float diff = 0.35 + 0.65 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 48.0) * 0.55;
  float rim = pow(1.0 - n.z, 3.0) * 0.25;
  float fog = clamp((-p.z - 2.5) / 4.0, 0.0, 0.55);
  vec3 col = base * diff + spec + rim * uHigh;
  o = vec4(mix(col, col * 0.35, fog), 1.0);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 pos;
uniform mat4 uView, uProj;
void main(){ gl_Position = uProj * uView * vec4(pos, 1.0); }`;

const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 o;
void main(){ o = uColor; }`;

// 2D: additive gaussian splats. R = weight, G = weight * speed
const SPLAT_VS = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 inst;
uniform vec2 uScale, uOffset;
uniform float uSize;
out vec2 vUv; out float vSpeed;
void main(){
  vUv = corner; vSpeed = inst.w;
  vec2 p = inst.xy * uScale + uOffset + corner * uSize * uScale;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 vUv; in float vSpeed;
uniform float uGain;
out vec4 o;
void main(){
  float w = exp(-dot(vUv, vUv) * 3.2) * uGain;
  o = vec4(w, w * vSpeed, 0.0, 0.0);
}`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 corner;
out vec2 vUv;
void main(){ vUv = corner * 0.5 + 0.5; gl_Position = vec4(corner, 0.0, 1.0); }`;

const SURFACE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uThreshold, uMaxSpeed, uUnit;
uniform vec3 uLow, uHigh;
out vec4 o;
void main(){
  vec4 f = texture(uField, vUv) / uUnit;
  float d = f.r;
  float a = smoothstep(uThreshold - 0.08, uThreshold + 0.08, d);
  if (a <= 0.0) { o = vec4(0.0); return; }
  float speed = f.g / max(d, 1e-4);
  float s = clamp(speed / uMaxSpeed, 0.0, 1.0);
  // surface normal from the field gradient, for a soft top light
  float dx = texture(uField, vUv + vec2(uTexel.x, 0.0)).r - texture(uField, vUv - vec2(uTexel.x, 0.0)).r;
  float dy = texture(uField, vUv + vec2(0.0, uTexel.y)).r - texture(uField, vUv - vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3(-dx / uUnit, -dy / uUnit, 0.06));
  float light = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.3, 0.7, 0.65))), 0.0);
  float edge = 1.0 - smoothstep(uThreshold, uThreshold + 0.5, d);
  light = mix(0.92, light, edge);   // shade the surface band only; the body stays calm
  vec3 col = mix(uLow, uHigh, s) * light + edge * 0.35 * uHigh;
  o = vec4(col * a, a);
}`;

/* ---------------- the view ---------------- */

export async function createFluidView(root, opts = {}) {
  const gl = root.querySelector('[data-fluid-gl]').getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error('WebGL2 is not available');
  const canvas = gl.canvas;
  const overlay = root.querySelector('[data-fluid-overlay]');
  const octx = overlay ? overlay.getContext('2d') : null;
  const pal = PALETTES[opts.palette] || PALETTES.blue;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const M = await opts.loadModule();
  const sim = {
    reset: M._fs_reset, step: M._fs_step, count: M._fs_count, data: M._fs_data, box: M._fs_box,
    set: M._fs_set, get: M._fs_get, impulse: M._fs_impulse, stir: M._fs_stir,
  };

  /* ---- GPU resources ---- */
  const sphere = program(gl, SPHERE_VS, SPHERE_FS);
  const line = program(gl, LINE_VS, LINE_FS);
  const splat = program(gl, SPLAT_VS, SPLAT_FS);
  const surface = program(gl, QUAD_VS, SURFACE_FS);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const inst = gl.createBuffer();

  const particlesVao = gl.createVertexArray();
  gl.bindVertexArray(particlesVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const boxBuf = gl.createBuffer();
  const boxVao = gl.createVertexArray();
  gl.bindVertexArray(boxVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, boxBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // density field for 2D: half float when the browser can render to it, bytes otherwise
  const floatOK = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('EXT_float_blend');
  const fieldTex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  let fieldW = 0, fieldH = 0;
  const UNIT = floatOK ? 1 : 0.12; // byte targets clip at 1, so splats are scaled down
  function sizeField(w, h) {
    if (w === fieldW && h === fieldH) return;
    fieldW = w; fieldH = h;
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    if (floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---- state ---- */
  let mode = opts.mode === 3 || opts.mode === '3d' ? 3 : 2;
  let playing = !reduce, visible = false, raf = 0, last = 0, substeps = 3;
  let W = 1, H = 1, dpr = 1;
  let box = [1, 1, 1];
  const cam = { yaw: -0.55, pitch: 0.32, dist: 4.6, auto: !reduce };
  let view, proj;
  const pointer = { inside: false, x: 0, y: 0, wx: 0, wy: 0, down: false, moved: 0, lastX: 0, lastY: 0, lastT: 0 };

  function data() {
    const n = sim.count();
    return { n, arr: new Float32Array(M.HEAPF32.buffer, sim.data(), n * 4) };
  }

  function boxLines() {
    const [x, y, z] = box;
    const v = [
      -x, -y, -z, x, -y, -z, x, -y, -z, x, y, -z, x, y, -z, -x, y, -z, -x, y, -z, -x, -y, -z,
      -x, -y, z, x, -y, z, x, -y, z, x, y, z, x, y, z, -x, y, z, -x, y, z, -x, -y, z,
      -x, -y, -z, -x, -y, z, x, -y, -z, x, -y, z, x, y, -z, x, y, z, -x, y, -z, -x, y, z,
    ];
    gl.bindBuffer(gl.ARRAY_BUFFER, boxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  }

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (overlay && (overlay.width !== W || overlay.height !== H)) { overlay.width = W; overlay.height = H; }
    sizeField(Math.max(1, W >> 1), Math.max(1, H >> 1));
  }

  // 2D world <-> clip: fit the box into the canvas with a small margin, keeping aspect
  function fit2D() {
    const pad = 0.94;
    const s = Math.min(W / (2 * box[0]), H / (2 * box[1])) * pad;
    return { sx: (s * 2) / W, sy: (s * 2) / H, px: s };
  }

  /* ---- drawing ---- */
  function draw() {
    const { n, arr } = data();
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (mode === 3) draw3D(n); else draw2D(n);
    drawOverlay(n, arr);
  }

  function draw3D(n) {
    if (cam.auto && playing) cam.yaw += 0.0012;
    const e = [
      Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      Math.sin(cam.pitch) * cam.dist,
      Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    ];
    view = mat.lookAt(e, [0, -0.25, 0], [0, 1, 0]);
    proj = mat.perspective((50 * Math.PI) / 180, W / H, 0.1, 50);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(sphere.p);
    gl.uniformMatrix4fv(sphere.u.uView, false, view);
    gl.uniformMatrix4fv(sphere.u.uProj, false, proj);
    gl.uniform1f(sphere.u.uRadius, 0.05);
    gl.uniform1f(sphere.u.uMaxSpeed, 3.0);
    gl.uniform3fv(sphere.u.uLow, pal.low);
    gl.uniform3fv(sphere.u.uHigh, pal.high);
    gl.bindVertexArray(particlesVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(line.p);
    gl.uniformMatrix4fv(line.u.uView, false, view);
    gl.uniformMatrix4fv(line.u.uProj, false, proj);
    const c = pal.line;
    gl.uniform4f(line.u.uColor, c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
    gl.bindVertexArray(boxVao);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.bindVertexArray(null);
  }

  function draw2D(n) {
    const f = fit2D();
    // splat pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, fieldW, fieldH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(splat.p);
    gl.uniform2f(splat.u.uScale, f.sx, f.sy);
    gl.uniform2f(splat.u.uOffset, 0, 0);
    gl.uniform1f(splat.u.uSize, 0.1);
    gl.uniform1f(splat.u.uGain, UNIT);
    gl.bindVertexArray(particlesVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // surface pass
    gl.viewport(0, 0, W, H);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(surface.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.uniform1i(surface.u.uField, 0);
    gl.uniform2f(surface.u.uTexel, 1 / fieldW, 1 / fieldH);
    gl.uniform1f(surface.u.uThreshold, 1.1);
    gl.uniform1f(surface.u.uMaxSpeed, 2.5);
    gl.uniform1f(surface.u.uUnit, UNIT);
    gl.uniform3fv(surface.u.uLow, pal.low);
    gl.uniform3fv(surface.u.uHigh, pal.high);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  // 2D only: the smoothing circle around the pointer and the particles inside it
  const neighOut = root.querySelector('[data-fluid-neigh]');
  function drawOverlay(n, arr) {
    if (!octx) return;
    octx.clearRect(0, 0, W, H);
    if (mode !== 2 || !pointer.inside) { if (neighOut) neighOut.textContent = '–'; return; }
    const f = fit2D();
    const h = sim.get(KEY.h);
    const cx = W / 2 + pointer.wx * f.px, cy = H / 2 - pointer.wy * f.px;
    let count = 0;
    octx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < n; i++) {
      const dx = arr[i * 4] - pointer.wx, dy = arr[i * 4 + 1] - pointer.wy;
      if (dx * dx + dy * dy < h * h) {
        count++;
        octx.beginPath();
        octx.arc(W / 2 + arr[i * 4] * f.px, H / 2 - arr[i * 4 + 1] * f.px, 1.6 * dpr, 0, Math.PI * 2);
        octx.fill();
      }
    }
    octx.strokeStyle = 'rgba(255,255,255,0.75)';
    octx.lineWidth = 1 * dpr;
    octx.setLineDash([4 * dpr, 4 * dpr]);
    octx.beginPath(); octx.arc(cx, cy, h * f.px, 0, Math.PI * 2); octx.stroke();
    octx.setLineDash([]);
    octx.beginPath(); octx.moveTo(cx, cy); octx.lineTo(cx + h * f.px, cy); octx.stroke();
    octx.font = `italic ${13 * dpr}px Georgia, serif`;
    octx.fillStyle = 'rgba(255,255,255,0.85)';
    octx.fillText('h', cx + (h * f.px) / 2 - 3 * dpr, cy - 5 * dpr);
    if (neighOut) neighOut.textContent = String(count);
  }

  /* ---- loop ---- */
  function frame(t) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.033, last ? (t - last) / 1000 : 1 / 60);
    last = t;
    if (playing) {
      const t0 = performance.now();
      sim.step(dt, mode === 2 ? substeps : 1);
      const cost = performance.now() - t0;
      // keep the page smooth on slow machines: fewer 2D substeps if a step is expensive
      if (mode === 2) substeps = cost > 14 ? Math.max(1, substeps - 1) : cost < 6 ? Math.min(3, substeps + 1) : substeps;
    }
    draw();
    if (playing || pointer.inside || mode === 3) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } }

  /* ---- controls ---- */
  const modeBtns = [...root.querySelectorAll('[data-fluid-mode]')];
  const playBtn = root.querySelector('[data-fluid-play]');
  const hint = root.querySelector('[data-fluid-hint]');
  const sliders = [...root.querySelectorAll('[data-fluid-param]')];

  function syncSliders() {
    sliders.forEach((s) => {
      const v = sim.get(KEY[s.dataset.fluidParam]);
      s.value = String(v);
      const out = root.querySelector(`[data-fluid-out="${s.dataset.fluidParam}"]`);
      if (out) out.textContent = (+v).toFixed(2);
    });
  }

  function setMode(m) {
    mode = m;
    sim.reset(m);
    box = [sim.box(0), sim.box(1), sim.box(2)];
    if (m === 3) boxLines();
    root.dataset.mode = m === 3 ? '3d' : '2d';
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.fluidMode === m)));
    if (hint) hint.textContent = HINTS[m];
    syncSliders();
    if (!playing) { for (let i = 0; i < 160; i++) sim.step(1 / 60, m === 2 ? 2 : 1); } // show a settled frame
    draw();
    kick();
  }

  function setPlaying(p) {
    playing = p;
    if (playBtn) { playBtn.setAttribute('aria-pressed', String(!p)); playBtn.textContent = p ? 'Pause' : 'Play'; }
    if (p) cam.auto = cam.auto && !reduce;
    kick();
  }

  function splashAt(x, y, z) {
    sim.impulse(x, y, z, mode === 2 ? 0.6 : 0.55, mode === 2 ? 5 : 4);
    if (!playing) setPlaying(true);
    kick();
  }

  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(+b.dataset.fluidMode)));
  playBtn?.addEventListener('click', () => setPlaying(!playing));
  root.querySelector('[data-fluid-reset]')?.addEventListener('click', () => setMode(mode));
  root.querySelector('[data-fluid-splash]')?.addEventListener('click', () => splashAt(0, -box[1] * 0.7, 0));
  sliders.forEach((s) => s.addEventListener('input', () => {
    sim.set(KEY[s.dataset.fluidParam], +s.value);
    const out = root.querySelector(`[data-fluid-out="${s.dataset.fluidParam}"]`);
    if (out) out.textContent = (+s.value).toFixed(2);
    if (!playing) draw();
  }));

  // pointer: 2D drag stirs, 3D drag orbits; a click without movement splashes
  function toWorld2D(e) {
    const r = canvas.getBoundingClientRect();
    const f = fit2D();
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    return [(x - W / 2) / f.px, (H / 2 - y) / f.px];
  }
  function pickPlane3D(e) {
    // ray through the pointer, hit the vertical plane through the tank centre facing the camera
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    const eye = [Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist];
    const f = 1 / Math.tan((25 * Math.PI) / 180), a = W / H;
    // camera basis from the view matrix rows
    const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]], back = [view[2], view[6], view[10]];
    const d = [0, 1, 2].map((i) => right[i] * (nx * a / f) + up[i] * (ny / f) - back[i]);
    const t = -(eye[0] * back[0] + eye[2] * back[2]) / (d[0] * back[0] + d[2] * back[2] || 1e-6);
    return [0, 1, 2].map((i) => eye[i] + d[i] * t);
  }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerenter', () => { pointer.inside = true; kick(); });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; if (!playing) draw(); });
  canvas.addEventListener('pointerdown', (e) => {
    pointer.down = true; pointer.moved = 0;
    pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.lastT = performance.now();
    canvas.setPointerCapture(e.pointerId);
    cam.auto = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    pointer.inside = true;
    if (mode === 2) { const [wx, wy] = toWorld2D(e); pointer.wx = wx; pointer.wy = wy; }
    if (pointer.down) {
      const dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now(), dt = Math.max(8, now - pointer.lastT) / 1000;
      if (mode === 3) {
        cam.yaw -= dx * 0.008;
        cam.pitch = Math.max(-0.2, Math.min(1.35, cam.pitch + dy * 0.006));
      } else if (pointer.moved > 3) {
        const f = fit2D();
        const vx = (dx * dpr) / f.px / dt, vy = (-dy * dpr) / f.px / dt;
        const cap = 6, m = Math.hypot(vx, vy), k = m > cap ? cap / m : 1;
        sim.stir(pointer.wx, pointer.wy, 0, vx * k, vy * k, 0, 0.35, 0.5);
        if (!playing) setPlaying(true);
      }
      pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.lastT = now;
    }
    kick();
  });
  const end = (e) => {
    if (!pointer.down) return;
    pointer.down = false;
    if (pointer.moved < 4 && e.type === 'pointerup') {
      if (mode === 2) splashAt(pointer.wx, pointer.wy, 0);
      else { const p = pickPlane3D(e); splashAt(p[0], p[1], p[2]); }
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    if (mode !== 3) return;
    e.preventDefault();
    cam.dist = Math.max(2.6, Math.min(8, cam.dist * Math.exp(e.deltaY * 0.001)));
    kick();
  }, { passive: false });

  // keyboard: arrows turn the camera in 3D, space plays or pauses, R resets, S splashes
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === ' ') { e.preventDefault(); setPlaying(!playing); }
    else if (k === 'r' || k === 'R') setMode(mode);
    else if (k === 's' || k === 'S') splashAt(0, -box[1] * 0.7, 0);
    else if (mode === 3 && k.startsWith('Arrow')) {
      e.preventDefault(); cam.auto = false;
      if (k === 'ArrowLeft') cam.yaw += 0.1; if (k === 'ArrowRight') cam.yaw -= 0.1;
      if (k === 'ArrowUp') cam.pitch = Math.min(1.35, cam.pitch + 0.08); if (k === 'ArrowDown') cam.pitch = Math.max(-0.2, cam.pitch - 0.08);
      kick();
    }
  });

  /* ---- lifecycle ---- */
  new ResizeObserver(() => { resize(); if (!playing || !raf) draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) kick(); });

  resize();
  setPlaying(playing);
  setMode(mode);
  return { setMode, setPlaying, get mode() { return mode; }, get playing() { return playing; }, sim };
}
