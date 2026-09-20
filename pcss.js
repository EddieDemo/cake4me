/* =====================================================================
   pcss.js — contact-hardening shadows (PCSS) for three.js r128.

   One job: patch three's built-in shadow lookup so a shadow's edge is crisp
   where the caster touches the receiver and softens the further the shadow
   falls from it — what a real, physically large light does. Nothing else in
   the app knows the shader exists; look.js turns it on with one call.

   How: three's `shadowmap_pars_fragment` chunk defines getShadow(). We insert
   PCSS functions above it and route the lookup through them when PCSS_ON is
   defined. Per shadowed pixel: a blocker search (how far is the occluder?),
   a penumbra estimate from that distance and the light's size, then a
   Poisson-disk filter of that width, rotated per pixel so the grain reads
   as texture rather than banding.

   The map must be a plain depth map (PCF type), not VSM: VSM stores moments.

   Two kinds of shadow map. The key's is ORTHOGRAPHIC (parallel rays, linear
   depth, constant search radius). A spot's is PERSPECTIVE (diverging rays,
   non-linear depth, search and penumbra radii that scale with distance from
   the light). getShadow() doesn't say which it's sampling, so we borrow the
   otherwise-unused `shadowRadius` uniform as a flag: 0 = orthographic,
   > 0 = perspective, with the value being tan(half-cone) so the shader can
   convert world sizes to map UV at any depth. look.js sets both.

   Tuning is by defines baked into the shader, so changes need a recompile.
   install() bumps a global program-cache key so every material recompiles on
   the next frame — no page reload needed when tuning from the console.

   API (window.CakePCSS):
     install(opts)   patch the chunk with these settings and force a recompile
     uninstall()     restore three's original chunk and force a recompile
     opts            { lightSize, frustumWidth, near, far, samples, maxRadius }
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('pcss.js: THREE not loaded'); return; }

  var original = THREE.ShaderChunk.shadowmap_pars_fragment;
  var version = 0;
  var currentGlsl = null;      // what's installed right now, so a repeat install is a no-op

  // Every material's program is cached by parameters that don't include chunk text, so a
  // patched chunk would never reach an already-compiled material. A global cache key that
  // changes on each install/uninstall makes three treat every program as new.
  var protoKey = THREE.Material.prototype.customProgramCacheKey;
  THREE.Material.prototype.customProgramCacheKey = function () {
    return (protoKey ? protoKey.call(this) : '') + '|pcss' + version;
  };

  function glsl(o) {
    return [
      '',
      '#define PCSS_ON 1',
      '#define PCSS_LIGHT_SIZE ' + o.lightSize.toFixed(4),        // world units: how big the light is
      '#define PCSS_FRUSTUM_W ' + o.frustumWidth.toFixed(4),      // shadow camera width, world units
      '#define PCSS_NEAR ' + o.near.toFixed(4),
      '#define PCSS_FAR ' + o.far.toFixed(4),
      '#define PCSS_MAX_UV ' + o.maxRadius.toFixed(5),            // penumbra cap, in shadow-map UV
      '#define PCSS_N ' + (o.samples | 0),
      // Perspective (spot) maps
      '#define PCSS_SPOT_LIGHT_SIZE ' + o.spotLightSize.toFixed(4),
      '#define PCSS_SPOT_NEAR ' + o.spotNear.toFixed(4),
      '#define PCSS_SPOT_FAR ' + o.spotFar.toFixed(4),
      '',
      'vec2 pcssDisk[PCSS_N];',
      'void pcssInitDisk( const in vec2 seed ) {',
      '  float step = PI2 * 7.0 / float( PCSS_N );',               // 7 rings: a good spread for 9–25 samples
      '  float angle = rand( seed ) * PI2;',                       // per-pixel rotation hides banding
      '  float r = 1.0 / float( PCSS_N ), dr = r;',
      '  for ( int i = 0; i < PCSS_N; i ++ ) {',
      '    pcssDisk[ i ] = vec2( cos( angle ), sin( angle ) ) * pow( r, 0.75 );',
      '    r += dr; angle += step;',
      '  }',
      '}',
      // Depth in the map is 0..1 across near..far for an orthographic light. Distances from
      // the light in world units make the penumbra maths honest.
      'float pcssDist( const in float z ) { return PCSS_NEAR + z * ( PCSS_FAR - PCSS_NEAR ); }',
      'float pcssBlocker( sampler2D map, const in vec2 uv, const in float zR, const in float searchUV ) {',
      '  float sum = 0.0; int n = 0;',
      '  for ( int i = 0; i < PCSS_N; i ++ ) {',
      '    float d = unpackRGBAToDepth( texture2D( map, uv + pcssDisk[ i ] * searchUV ) );',
      '    if ( d < zR ) { sum += d; n ++; }',
      '  }',
      '  return n == 0 ? -1.0 : sum / float( n );',
      '}',
      'float pcssFilter( sampler2D map, const in vec2 uv, const in float zR, const in float radiusUV ) {',
      '  float lit = 0.0;',
      '  for ( int i = 0; i < PCSS_N; i ++ ) {',
      '    if ( zR <= unpackRGBAToDepth( texture2D( map, uv + pcssDisk[ i ] * radiusUV ) ) ) lit += 1.0;',
      '    if ( zR <= unpackRGBAToDepth( texture2D( map, uv - pcssDisk[ i ].yx * radiusUV ) ) ) lit += 1.0;',
      '  }',
      '  return lit / ( 2.0 * float( PCSS_N ) );',
      '}',
      // Perspective depth: the map stores NDC z in 0..1; recover distance from the light.
      'float pcssSpotDist( const in float z ) {',
      '  float zc = z * 2.0 - 1.0;',
      '  return ( 2.0 * PCSS_SPOT_NEAR * PCSS_SPOT_FAR ) / ( PCSS_SPOT_FAR + PCSS_SPOT_NEAR - zc * ( PCSS_SPOT_FAR - PCSS_SPOT_NEAR ) );',
      '}',
      'float pcss( sampler2D map, const in vec4 coord, const in float tanHalf ) {',
      '  vec2 uv = coord.xy; float zR = coord.z;',
      '  pcssInitDisk( uv );',
      '  if ( tanHalf <= 0.0 ) {',
      // ---- orthographic (the key): parallel rays, linear depth, constant search radius ----
      '    float searchUV = PCSS_LIGHT_SIZE / PCSS_FRUSTUM_W;',
      '    float zB = pcssBlocker( map, uv, zR, searchUV );',
      '    if ( zB < 0.0 ) return 1.0;',
      '    float dR = pcssDist( zR ), dB = max( pcssDist( zB ), 0.001 );',
      '    float penumbraW = PCSS_LIGHT_SIZE * ( dR - dB ) / dB;',
      '    return pcssFilter( map, uv, zR, min( penumbraW / PCSS_FRUSTUM_W, PCSS_MAX_UV ) );',
      '  } else {',
      // ---- perspective (a spot): the map's world width grows with distance, 2·d·tan(half-cone) ----
      '    float dR = pcssSpotDist( zR );',
      '    float mapW = 2.0 * dR * tanHalf;',                      // world width of the map at the receiver's depth
      '    float searchUV = PCSS_SPOT_LIGHT_SIZE / mapW;',
      '    float zB = pcssBlocker( map, uv, zR, searchUV );',
      '    if ( zB < 0.0 ) return 1.0;',
      '    float dB = max( pcssSpotDist( zB ), 0.001 );',
      '    float penumbraW = PCSS_SPOT_LIGHT_SIZE * ( dR - dB ) / dB;',
      '    return pcssFilter( map, uv, zR, min( penumbraW / mapW, PCSS_MAX_UV ) );',
      '  }',
      '}',
      ''
    ].join('\n');
  }

  function install(opts) {
    var o = {
      lightSize: 0.6, frustumWidth: 13, near: 1, far: 40, samples: 13, maxRadius: 0.035,
      spotLightSize: 0.5, spotNear: 1, spotFar: 60
    };
    for (var k in opts) if (opts.hasOwnProperty(k) && opts[k] !== undefined) o[k] = opts[k];
    var code = glsl(o);
    // Idempotent: re-installing identical settings must NOT bump the cache key, or every route
    // change recompiles every material for nothing (14 programs became 26 across one navigation).
    if (code === currentGlsl) return o;
    currentGlsl = code;
    var shader = original;
    shader = shader.replace('#ifdef USE_SHADOWMAP', '#ifdef USE_SHADOWMAP' + code);
    // Route the lookup through PCSS just inside getShadow's frustum test.
    shader = shader.replace('#if defined( SHADOWMAP_TYPE_PCF )',
      '#ifdef PCSS_ON\n\t\t\treturn pcss( shadowMap, shadowCoord, shadowRadius );\n\t\t#endif\n\t\t#if defined( SHADOWMAP_TYPE_PCF )');
    THREE.ShaderChunk.shadowmap_pars_fragment = shader;
    version++;
    return o;
  }
  function uninstall() {
    if (currentGlsl === null) return;
    currentGlsl = null;
    THREE.ShaderChunk.shadowmap_pars_fragment = original;
    version++;
  }

  window.CakePCSS = { install: install, uninstall: uninstall };
})();
