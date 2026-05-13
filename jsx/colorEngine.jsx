// ASCIImp4 - Color Engine

var colorEngine = (function() {

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ── HSL ↔ RGB ── */
  function hslToRGB(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
  }

  function rgbToHSL(r, g, b) {
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function hexToRGB(hex) {
    hex = hex.replace('#', '');
    return [
      parseInt(hex.substring(0,2), 16) / 255,
      parseInt(hex.substring(2,4), 16) / 255,
      parseInt(hex.substring(4,6), 16) / 255,
    ];
  }

  function hexToHSL(hex) {
    var rgb = hexToRGB(hex);
    return rgbToHSL(rgb[0], rgb[1], rgb[2]);
  }

  /* ── Apply post-processing (hue shift, sat, brightness) ── */
  function postProcess(rgb, cfg) {
    var hsl = rgbToHSL(rgb[0], rgb[1], rgb[2]);
    hsl[0] = (hsl[0] + (cfg.hueShift || 0) + (cfg._hueOffset || 0) + 720) % 360;
    hsl[1] = clamp(hsl[1] * ((cfg.saturation || 100) / 100), 0, 100);
    hsl[2] = clamp(hsl[2] * ((cfg.brightness || 100) / 100), 0, 100);
    return hslToRGB(hsl[0], hsl[1], hsl[2]);
  }

  /* ── Thermal palette ── */
  var THERMAL = [
    [0,0,0.5],   // deep blue
    [0,0,1],     // blue
    [0,1,1],     // cyan
    [0,1,0],     // green
    [1,1,0],     // yellow
    [1,0.5,0],   // orange
    [1,0,0],     // red
    [1,1,1],     // white
  ];

  function thermalColor(t) {
    t = clamp(t, 0, 1);
    var idx = t * (THERMAL.length - 1);
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    var frac = idx - lo;
    var a = THERMAL[lo], b = THERMAL[hi];
    return [a[0]+(b[0]-a[0])*frac, a[1]+(b[1]-a[1])*frac, a[2]+(b[2]-a[2])*frac];
  }

  /* ── Build palette ── */
  function buildPalette(cfg) {
    var baseHSL = hexToHSL(cfg.colorPrimary || '#00e5ff');
    var count = parseInt(cfg.analogCount) || 4;
    var spread = parseFloat(cfg.hueSpread) || 30;
    var colors = [];
    for (var i = 0; i < count; i++) {
      var offset = (i - Math.floor(count / 2)) * (spread / Math.max(count - 1, 1));
      var hue = (baseHSL[0] + offset + 360) % 360;
      colors.push(hslToRGB(hue, baseHSL[1], baseHSL[2]));
    }
    return colors;
  }

  /* ── Get color for a whole row ── */
  function getRowColor(row, totalRows, time, cfg, palette) {
    var mode = cfg.colorMode || 'mono';
    var t = row / Math.max(totalRows - 1, 1);

    switch(mode) {
      case 'mono': {
        var rgb = hexToRGB(cfg.colorPrimary || '#00e5ff');
        return postProcess(rgb, cfg);
      }
      case 'gradient': {
        var c1 = hexToRGB(cfg.colorPrimary || '#00e5ff');
        var c2 = hexToRGB(cfg.colorSecondary || '#7c4dff');
        var blended = [c1[0]+(c2[0]-c1[0])*t, c1[1]+(c2[1]-c1[1])*t, c1[2]+(c2[2]-c1[2])*t];
        return postProcess(blended, cfg);
      }
      case 'analogous': {
        var idx = Math.floor(t * palette.length) % palette.length;
        return postProcess(palette[idx], cfg);
      }
      case 'hueshift': {
        var baseHSL = hexToHSL(cfg.colorPrimary || '#00e5ff');
        var hue = (baseHSL[0] + (cfg._hueOffset || 0) + t * 120 + 720) % 360;
        return postProcess(hslToRGB(hue, baseHSL[1], baseHSL[2]), cfg);
      }
      case 'neon': {
        var neonHues = [180, 120, 270, 60, 300];
        var nh = neonHues[row % neonHues.length];
        return hslToRGB(nh, 100, 60);
      }
      case 'thermal': {
        return thermalColor(t);
      }
      default: {
        var defRgb = hexToRGB(cfg.colorPrimary || '#00e5ff');
        return postProcess(defRgb, cfg);
      }
    }
  }

  /* ── Get color for an individual cell ── */
  function getCellColor(cell, col, row, grid, time, cfg, palette) {
    var mode = cfg.colorMode || 'mono';

    if (mode === 'source' || cfg.overlaySource) {
      var srcColor = [cell.r / 255, cell.g / 255, cell.b / 255];
      if (mode === 'source') {
        var blended = srcColor;
        if (cfg.overlaySource) {
          var baseColor = getRowColor(row, grid.rows, time, cfg, palette);
          var bl = (cfg.sourceBlend || 60) / 100;
          blended = [
            srcColor[0] * bl + baseColor[0] * (1 - bl),
            srcColor[1] * bl + baseColor[1] * (1 - bl),
            srcColor[2] * bl + baseColor[2] * (1 - bl),
          ];
        }
        return postProcess(blended, cfg);
      }
    }

    if (mode === 'glitch') {
      // Random hue per cell based on position + time
      var seed = (col * 31 + row * 97 + Math.floor(time * 10)) % 360;
      var glitchRgb = hslToRGB(seed, 90, 55);
      return glitchRgb;
    }

    if (cfg.perCharTint) {
      var lumaT = cell.luma / 255;
      var rowColor = getRowColor(row, grid.rows, time, cfg, palette);
      return [
        clamp(rowColor[0] * (0.5 + lumaT), 0, 1),
        clamp(rowColor[1] * (0.5 + lumaT), 0, 1),
        clamp(rowColor[2] * (0.5 + lumaT), 0, 1),
      ];
    }

    return getRowColor(row, grid.rows, time, cfg, palette);
  }

  return {
    buildPalette: buildPalette,
    getRowColor: getRowColor,
    getCellColor: getCellColor,
    hexToRGB: hexToRGB,
    hslToRGB: hslToRGB,
  };

})();
