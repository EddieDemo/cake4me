/* shaders.js — the GLSL the cake's own materials use (v1.09, refactor step 4b).
   Plain files of strings, one object per program, so a shader can be read on its own instead of
   inside the function that uses it. Patches to three.js's built-in shaders (icing, wax, ribbon,
   crumb) are applied with patch.js, next to the material that needs them. */
(function () {
  window.CakeShaders = {
    // A flame: a 3D teardrop that glows from inside, sways and stretches in the vertex shader;
    // blended like an object with soft edges (v1.06), only its halo additive.
    flame: { vertex: [
    'uniform float uTime; uniform float uPhase; varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vAxis;',
    'void main(){',
    '  vec3 p = position; float h = clamp(p.y / 0.30, 0.0, 1.0); vH = h;',
    '  float t = uTime + uPhase;',
    '  float sway = 0.55 * sin(t * 1.7) + 0.30 * sin(t * 3.9 + 1.3) + 0.15 * sin(t * 7.3 + 2.1);',
    '  float sway2 = 0.5 * sin(t * 2.3 + 0.7) + 0.35 * sin(t * 5.1 + 2.2);',
    '  float stretch = 1.0 + 0.10 * sin(t * 9.1) + 0.06 * sin(t * 15.7 + 1.1) + 0.04 * sin(t * 23.3 + 0.4);',
    '  p.y *= stretch;',
    '  p.x += 0.018 * sway * h * h; p.z += 0.012 * sway2 * h * h;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vAxis = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));',
    '  gl_Position = projectionMatrix * mv;',
    '}'  ].join('\n'),
             fragment: [
    'uniform float uGlow; uniform float uCover; uniform float uOpaque; varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vAxis;',
    'void main(){',
    '  float f = abs(dot(normalize(vN), normalize(vV)));',
    '  float core = pow(f, 2.2), edge = pow(f, 0.8);',
    '  vec3 white = vec3(1.0, 0.95, 0.80), yellow = vec3(1.0, 0.76, 0.30), orange = vec3(1.0, 0.45, 0.12), blue = vec3(0.25, 0.35, 1.0);',
    '  vec3 c = mix(orange, yellow, edge);',
    '  c = mix(c, white, core * smoothstep(0.1, 0.35, vH) * (1.0 - smoothstep(0.55, 0.95, vH)));',
    '  float root = 1.0 - smoothstep(0.0, 0.14, vH);',
    '  c = mix(c, blue, root * 0.8);',
    '  float cone = (1.0 - smoothstep(0.08, 0.3, vH)) * core;',
    '  c *= 1.0 - 0.45 * cone;',
    '  float a = edge * smoothstep(0.0, 0.24, vH) * (1.0 - 0.55 * root) * (1.0 - smoothstep(0.85, 1.0, vH) * 0.6);   // fades to nothing at the base: no hard edge where the candle hides it',
    // The flame's HEART hides what's behind it (its own light brought with it); only the edges
    // and the halo stay translucent. Otherwise the flame took its colour from the backdrop —
    // rich against the wall, pale and grey against the bright floor, with the horizon line
    // showing through it.
    '  float alpha = a * max(uCover, uOpaque * core);',
    '  gl_FragColor = vec4(c * uGlow * (a + (alpha - a * uCover)), alpha);',
    '}'  ].join('\n') },
    // A sparkler's sparks: one quad each, path from seed and time, entirely on the GPU.
    sparks: { vertex: [
    'attribute vec4 aSeed; attribute vec2 aCorner; uniform float uTime; uniform vec3 uOrigin; varying vec3 vCol;',
    'float h(float i, float k){ return fract(sin(i * 127.1 + k * 311.7) * 43758.5453); }',
    'vec3 at(vec3 o, vec3 v, float t){ return o + v * t + vec3(0.0, -1.1 * t * t, 0.0); }',
    'void main(){',
    '  float i = aSeed.x;',
    '  float life = 0.35 + 0.55 * h(i, 1.0);',
    '  float age = mod(uTime + h(i, 2.0) * life, life);',
    '  float th = h(i, 3.0) * 6.2832, ph = acos(1.0 - 2.0 * h(i, 4.0)), sp = 1.6 + 2.2 * h(i, 5.0);',
    '  vec3 vel = vec3(sin(ph) * cos(th) * sp, cos(ph) * sp * 0.8 + 0.35, sin(ph) * sin(th) * sp);',
    '  vec3 head, tail; float w; vec3 col; float fade = 1.0 - age / life;',
    '  if (aSeed.y < 0.0) {',
    '    head = at(uOrigin, vel, age); tail = at(uOrigin, vel, max(0.0, age - 0.16 - 0.12 * h(i, 6.0))); w = 0.006;',
    '    col = mix(vec3(1.0, 0.75, 0.35), vec3(1.0, 0.97, 0.85), fade);',
    '  } else {',
    '    float k = aSeed.y, bT = age - life * 0.6;',
    '    if (aSeed.z < 0.5 || bT < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec3(0.0); return; }',
    '    vec3 bp = at(uOrigin, vel, life * 0.6);',
    '    float a2 = h(i * 13.0 + k, 8.0) * 6.2832, b2 = acos(1.0 - 2.0 * h(i * 13.0 + k, 9.0)), s2 = 0.6 + 0.5 * h(i * 13.0 + k, 10.0);',
    '    vec3 v2 = vec3(sin(b2) * cos(a2), cos(b2), sin(b2) * sin(a2)) * s2;',
    '    head = bp + v2 * bT; tail = bp + v2 * max(0.0, bT - 0.1); w = 0.004;',
    '    col = vec3(1.0, 0.75, 0.35) * max(0.0, 1.0 - bT / (life * 0.4));',
    '  }',
    '  vec4 hv = modelViewMatrix * vec4(head, 1.0), tv = modelViewMatrix * vec4(tail, 1.0);',
    '  vec2 d = hv.xy - tv.xy; vec2 side = normalize(vec2(-d.y, d.x) + 1e-6) * w;',
    '  vec4 p = mix(tv, hv, aCorner.x); p.xy += side * aCorner.y;',
    '  vCol = col * mix(0.15, 1.0, aCorner.x);                  // bright at the head, fading behind',
    '  gl_Position = projectionMatrix * p;',
    '}'  ].join('\n'),
              fragment: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol * 1.5, 1.0); }' },
    // Hundreds and thousands: sphere impostors — one point each, painted as a lit ball with real depth.
    sprinkles: { vertex: [
    'attribute float aRadius; attribute vec3 aColor; uniform float uScale;',
    'varying vec3 vCol; varying vec3 vCentre; varying float vR;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vCentre = mv.xyz; vR = aRadius; vCol = aColor;',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = max(1.0, uScale * aRadius / -mv.z);',
    '}'  ].join('\n'),
                 fragment: [
    'uniform mat4 projectionMatrix;                         // three sets it; the fragment shader must declare it',
    'uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uUp; uniform vec3 uFillDir; uniform vec3 uFillCol;',
    'uniform vec3 uP1Pos; uniform vec3 uP1Col; uniform float uP1Cut; uniform vec3 uP2Pos; uniform vec3 uP2Col; uniform float uP2Cut;',
    'varying vec3 vCol; varying vec3 vCentre; varying float vR;',
    'vec3 point(vec3 lp, vec3 lc, float cut, vec3 p, vec3 n){ vec3 d = lp - p; float dist = length(d);',
    '  float f = cut > 0.0 ? pow(clamp(1.0 - dist / cut, 0.0, 1.0), 2.0) : 0.0; return lc * f * max(dot(n, d / max(dist, 1e-4)), 0.0); }',
    'void main(){',
    '  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y; float r2 = dot(c, c); if (r2 > 1.0) discard;',
    '  vec3 n = vec3(c, sqrt(1.0 - r2));',
    '  vec3 p = vCentre + n * vR;',
    '  vec4 clip = projectionMatrix * vec4(p, 1.0);',
    '  gl_FragDepthEXT = (clip.z / clip.w) * 0.5 + 0.5;      // the depth a real ball would have',
    '  vec3 amb = mix(uGround, uSky, dot(n, uUp) * 0.5 + 0.5);',
    '  vec3 light = amb + uKeyCol * max(dot(n, uKeyDir), 0.0) + uFillCol * max(dot(n, uFillDir), 0.0) + point(uP1Pos, uP1Col, uP1Cut, p, n) + point(uP2Pos, uP2Col, uP2Cut, p, n);',
    '  vec3 col = vCol * light;',
    '  vec3 h = normalize(uKeyDir + vec3(0.0, 0.0, 1.0));',
    '  col += uKeyCol * pow(max(dot(n, h), 0.0), 32.0) * 0.18;  // a soft sugary sheen',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}'  ].join('\n') }
  };
})();
