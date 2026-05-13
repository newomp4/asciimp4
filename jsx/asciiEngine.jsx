// ASCIImp4 - ASCII Engine
// Core frame-sampling and ASCII conversion logic

// JSON polyfill — AE ExtendScript sometimes ships without the JSON global
;(function() {
  if (typeof JSON !== 'undefined' && typeof JSON.parse === 'function') return;
  function _str(val) {
    if (val === null || val === undefined) return 'null';
    var t = typeof val;
    if (t === 'boolean' || t === 'number') return String(val);
    if (t === 'string') return '"' + val.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t') + '"';
    if (t !== 'object') return 'null';
    if (typeof val.length === 'number') {
      var a = []; for (var i=0;i<val.length;i++) a.push(_str(val[i])); return '['+a.join(',')+']';
    }
    var p = []; for (var k in val) { if (val.hasOwnProperty(k)) { var v=_str(val[k]); if(v!==undefined) p.push('"'+k+'":'+v); } }
    return '{'+p.join(',')+'}';
  }
  var _JSON = { stringify: _str, parse: function(s) { return eval('('+s+')'); } };
  try { $.global.JSON = _JSON; } catch(e) { JSON = _JSON; }
})();

var asciiEngine = (function() {

  /* ── Character ramps ── */
  var CHAR_SETS = {
    standard:  " .`'^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    numbers:   " 1234567890",
    binary:    " 01",
    letters:   " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    symbols:   " .,-~:;=!*#$@",
    blocks:    " ░▒▓█",
    dots:      " ·▪■",
    hex:       " 0123456789abcdef",
  };

  /* ── Math helpers ── */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── Luma from RGBA ── */
  function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

  /* ── Sample a pixel from a layer at a given time ── */
  function samplePixel(layer, normX, normY, time) {
    try {
      var pt = [normX, normY];
      var s = layer.sampleImage(pt, [0.5, 0.5], true, time);
      // returns [r,g,b,a] each 0-1
      return s;
    } catch(e) {
      return [0, 0, 0, 0];
    }
  }

  /* ── Build grid dimensions ── */
  function buildGrid(comp, srcLayer, cfg, time) {
    var w = comp.width;
    var h = comp.height;

    var cellSize = parseInt(cfg.cellSize) || 10;
    var resDiv   = parseInt(cfg.resDiv) || 2;
    var effectiveCell = cellSize * resDiv;

    // Dynamic scaling: measure bounding box of visible pixels
    if (cfg.dynamicScale) {
      var minX = w, maxX = 0, minY = h, maxY = 0;
      var step = Math.max(4, Math.round(effectiveCell / 2));
      var found = false;
      for (var sy = 0; sy < h; sy += step) {
        for (var sx = 0; sx < w; sx += step) {
          var px = samplePixel(srcLayer, sx / w, sy / h, time);
          var a = px[3];
          if (a > (cfg.alphaThresh || 128) / 255) {
            if (sx < minX) minX = sx;
            if (sx > maxX) maxX = sx;
            if (sy < minY) minY = sy;
            if (sy > maxY) maxY = sy;
            found = true;
          }
        }
      }
      if (found) {
        var bboxW = maxX - minX || effectiveCell;
        var bboxH = maxY - minY || effectiveCell;
        var coverage = (bboxW / w + bboxH / h) / 2;
        var resp = (cfg.scaleResp || 50) / 100;
        var dynCell = lerp(
          parseInt(cfg.cellMin) || 6,
          parseInt(cfg.cellMax) || 20,
          coverage * resp
        );
        effectiveCell = Math.round(dynCell) * resDiv;
      }
    }

    var cols = Math.floor(w / effectiveCell);
    var rows = Math.floor(h / effectiveCell);
    return { cols: cols, rows: rows, cellW: effectiveCell, cellH: effectiveCell, w: w, h: h };
  }

  /* ── Get chars for brightness ── */
  function getChar(brightness, cfg) {
    var ramp = cfg.charSet === 'custom' ? cfg.customChars : (CHAR_SETS[cfg.charSet] || CHAR_SETS.standard);
    if (!ramp || ramp.length === 0) ramp = CHAR_SETS.standard;
    var inv = cfg.invertMap;
    var t = brightness / 255;
    if (inv) t = 1 - t;
    var idx = Math.floor(t * (ramp.length - 1));
    idx = clamp(idx, 0, ramp.length - 1);
    return ramp.charAt(idx);
  }

  /* ── Sample a cell and get its brightness + color ── */
  function sampleCell(srcLayer, col, row, grid, time) {
    var nx = (col + 0.5) / grid.cols;
    var ny = (row + 0.5) / grid.rows;
    var px = samplePixel(srcLayer, nx, ny, time);
    var r = px[0] * 255;
    var g = px[1] * 255;
    var b = px[2] * 255;
    var a = px[3] * 255;
    return { r: r, g: g, b: b, a: a, luma: luma(r, g, b) };
  }

  /* ── Apply contrast / gamma ── */
  function applyContrast(val, contrast, gamma) {
    var v = val / 255;
    // contrast
    var c = (contrast || 100) / 100;
    v = (v - 0.5) * c + 0.5;
    // gamma
    var g = (gamma || 100) / 100;
    if (g !== 1) v = Math.pow(Math.max(0, v), 1 / g);
    return clamp(v * 255, 0, 255);
  }

  /* ── Build one text string for an entire row ── */
  function buildRowString(srcLayer, row, grid, cfg, time) {
    var chars = '';
    var lumaThresh = cfg.lumaThresh || 20;
    for (var col = 0; col < grid.cols; col++) {
      var cell = sampleCell(srcLayer, col, row, grid, time);
      // alpha check for rotoscoped layers
      if (cfg.useAlpha && cell.a < (cfg.alphaThresh || 128)) {
        chars += ' ';
        continue;
      }
      var processedLuma = applyContrast(cell.luma, cfg.contrast, cfg.gamma);
      if (processedLuma < lumaThresh) {
        chars += ' ';
        continue;
      }
      chars += getChar(processedLuma, cfg);
    }
    return chars;
  }

  /* ── Create output comp ── */
  function createOutputComp(srcComp, cfg) {
    var scale = (cfg.outScale || 100) / 100;
    var outComp = app.project.items.addComp(
      cfg.outCompName || 'ASCII_Output',
      Math.round(srcComp.width * scale),
      Math.round(srcComp.height * scale),
      srcComp.pixelAspect,
      srcComp.duration,
      srcComp.frameRate
    );
    // Set comp background color directly (avoids addSolid compatibility issues)
    if (cfg.bgFill) {
      outComp.bgColor = hexToAEColor(cfg.bgColor || '#000000');
    }
    return outComp;
  }

  /* ── hex color → AE [r,g,b] 0-1 ── */
  function hexToAEColor(hex) {
    hex = hex.replace('#', '');
    return [
      parseInt(hex.substring(0,2), 16) / 255,
      parseInt(hex.substring(2,4), 16) / 255,
      parseInt(hex.substring(4,6), 16) / 255,
    ];
  }

  /* ── Encode a string safely for embedding inside an expression's string literal ── */
  function exprStr(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if      (c === 92) out += '\\\\';
      else if (c === 34) out += '\\"';
      else if (c < 32 || c > 126) out += '\\u' + ('000' + c.toString(16)).slice(-4);
      else out += s.charAt(i);
    }
    return out;
  }

  /* ── Main render function — expression-based ──
     Adds ONE text layer with a Source Text expression directly into
     the source comp. The expression samples the source layer by index
     every frame — no pre-computation, no layer explosion, no crash.

     Horizontal sampling uses character width (cs * 0.55 for Courier New)
     so the ASCII grid fills the full comp width instead of ~60% of it.
  ── */
  function render(comp, srcLayer, cfg) {
    var SETS = {
      standard: " .`'^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
      numbers:  " 1234567890",
      binary:   " 01",
      letters:  " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      symbols:  " .,-~:;=!*#$@",
      blocks:   " ░▒▓█",
      hex:      " 0123456789abcdef"
    };
    var rawRamp = cfg.charSet === 'custom'
      ? (cfg.customChars || ' .:-=+*#@')
      : (SETS[cfg.charSet] || SETS.standard);

    var cs  = parseInt(cfg.cellSize) || 24; // font size = row height
    // Courier New character advance width ≈ fontSize × 0.55
    // Using this as the horizontal step fills the full comp width
    var cw  = Math.max(1, Math.round(cs * 0.55));

    var thresh   = ((cfg.lumaThresh  || 20)  / 255).toFixed(5);
    var aThresh  = ((cfg.alphaThresh || 128) / 255).toFixed(5);
    var contrast = ((cfg.contrast    || 100) / 100).toFixed(5);
    var gamma    = ((cfg.gamma       || 100) / 100).toFixed(5);
    var inv      = cfg.invertMap ? 'true' : 'false';
    var useA     = cfg.useAlpha  ? 'true' : 'false';
    // Reference source layer by index — works in any comp without name lookup
    var srcIdx   = srcLayer.index;

    var expr = [
      'try {',
      '  var src = thisComp.layer(' + srcIdx + ');',
      '  var W = thisComp.width, H = thisComp.height;',
      '  var cw = ' + cw + '; // char width (horiz sample step)',
      '  var ch = ' + cs + '; // char height (vert sample step)',
      '  var cols = Math.floor(W/cw), rows = Math.floor(H/ch);',
      '  var ramp = "' + exprStr(rawRamp) + '";',
      '  var thresh = ' + thresh + ', aT = ' + aThresh + ';',
      '  var con = ' + contrast + ', gam = ' + gamma + ';',
      '  var inv = ' + inv + ', useA = ' + useA + ';',
      '  var lines = [];',
      '  for (var r = 0; r < rows; r++) {',
      '    var line = "";',
      '    for (var c = 0; c < cols; c++) {',
      '      var p = src.sampleImage([(c+0.5)*cw - W/2, (r+0.5)*ch - H/2], [0.5,0.5], true, time);',
      '      if (useA && p[3] < aT) { line += " "; continue; }',
      '      var L = 0.299*p[0] + 0.587*p[1] + 0.114*p[2];',
      '      L = (L - 0.5)*con + 0.5;',
      '      if (gam !== 1) L = Math.pow(L < 0 ? 0 : L, 1/gam);',
      '      if (L < 0) L = 0; if (L > 1) L = 1;',
      '      if (L < thresh) { line += " "; continue; }',
      '      var t = inv ? 1-L : L;',
      '      var idx = Math.floor(t*(ramp.length-1));',
      '      if (idx < 0) idx = 0; if (idx >= ramp.length) idx = ramp.length-1;',
      '      line += ramp.charAt(idx);',
      '    }',
      '    lines[lines.length] = line;',
      '  }',
      '  lines.join("\\r");',
      '} catch(e) { "ERR: " + e.toString(); }'
    ].join('\n');

    // ── Remove any previous ASCII_Art layer so re-renders stay clean ──
    for (var li = comp.numLayers; li >= 1; li--) {
      if (comp.layers[li].name === 'ASCII_Art') { comp.layers[li].remove(); }
    }

    // ── Add text layer directly to the source comp ──
    // No nested comp = no positioning mismatch, expression references
    // the source layer by index in the same comp context.
    var textLayer = comp.layers.addText(' ');
    textLayer.name   = 'ASCII_Art';
    textLayer.moveToBeginning(); // sit above other layers

    var textProp = textLayer.property("Source Text");
    var td = textProp.value;
    td.font          = cfg.outFont || 'Courier New';
    td.fontSize      = cs;
    td.justification = ParagraphJustification.LEFT_JUSTIFY;
    td.fillColor     = hexToAEColor(cfg.colorPrimary || '#ffffff');
    td.tracking      = 0;
    td.leading       = cs;
    textProp.setValue(td);

    // Anchor at baseline of first character so position [0,cs] = top-left
    textLayer.property("Position").setValue([0, cs]);
    textLayer.property("Anchor Point").setValue([0, cs]);
    textLayer.inPoint  = 0;
    textLayer.outPoint = comp.duration;

    textProp.expression = expr;

    return { compName: comp.name, frames: 1, method: 'expression' };
  }

  /* ── Cluster detection ── */
  function detectClusters(comp, srcLayer, cfg, time) {
    var w = comp.width;
    var h = comp.height;
    var step = Math.max(4, Math.round((cfg.cellSize || 10) * 2));
    var threshold = (cfg.lumaThresh || 20) / 255;
    var trackMode = cfg.trackMode || 'bright';
    var alphaThresh = (cfg.alphaThresh || 128) / 255;

    // Collect qualifying pixels
    var pts = [];
    for (var sy = 0; sy < h; sy += step) {
      for (var sx = 0; sx < w; sx += step) {
        var px = samplePixel(srcLayer, sx / w, sy / h, time);
        var l = luma(px[0] * 255, px[1] * 255, px[2] * 255) / 255;
        var a = px[3];
        if (cfg.useAlpha && a < alphaThresh) continue;
        var qualifies = false;
        if (trackMode === 'bright' && l > threshold) qualifies = true;
        if (trackMode === 'dark' && l < (1 - threshold)) qualifies = true;
        if (trackMode === 'edge') {
          // simple edge: compare to neighbor
          var px2 = samplePixel(srcLayer, Math.min((sx + step) / w, 1), sy / h, time);
          var l2 = luma(px2[0]*255,px2[1]*255,px2[2]*255)/255;
          if (Math.abs(l - l2) > 0.15) qualifies = true;
        }
        if (qualifies) pts.push([sx, sy]);
      }
    }

    if (pts.length === 0) return [];

    // Simple k-means-style clustering
    var k = Math.min(parseInt(cfg.maxClusters) || 5, pts.length);
    var sens = (cfg.clusterSens || 40) / 100;
    var minArea = parseInt(cfg.clusterMinArea) || 200;

    // Initialize centroids spread across points
    var centroids = [];
    for (var i = 0; i < k; i++) {
      centroids.push(pts[Math.floor(i * pts.length / k)].slice());
    }

    // 5 iterations of assignment + update
    for (var iter = 0; iter < 5; iter++) {
      var buckets = [];
      for (var b = 0; b < k; b++) buckets.push([]);

      for (var pi = 0; pi < pts.length; pi++) {
        var best = 0, bestD = Infinity;
        for (var ci = 0; ci < k; ci++) {
          var dx = pts[pi][0] - centroids[ci][0];
          var dy = pts[pi][1] - centroids[ci][1];
          var d = dx*dx + dy*dy;
          if (d < bestD) { bestD = d; best = ci; }
        }
        buckets[best].push(pts[pi]);
      }

      for (var ci2 = 0; ci2 < k; ci2++) {
        if (buckets[ci2].length === 0) continue;
        var sumX = 0, sumY = 0;
        for (var bi = 0; bi < buckets[ci2].length; bi++) {
          sumX += buckets[ci2][bi][0];
          sumY += buckets[ci2][bi][1];
        }
        centroids[ci2] = [sumX / buckets[ci2].length, sumY / buckets[ci2].length];
      }
    }

    // Build final cluster result
    var results = [];
    for (var ci3 = 0; ci3 < k; ci3++) {
      var members = [];
      var maxDist = (w + h) * 0.15 * sens;
      for (var pi2 = 0; pi2 < pts.length; pi2++) {
        var dx2 = pts[pi2][0] - centroids[ci3][0];
        var dy2 = pts[pi2][1] - centroids[ci3][1];
        if (Math.sqrt(dx2*dx2 + dy2*dy2) < maxDist) members.push(pts[pi2]);
      }
      if (members.length === 0) continue;
      var sumX2 = 0, sumY2 = 0, minBx = w, maxBx = 0, minBy = h, maxBy = 0;
      for (var mi = 0; mi < members.length; mi++) {
        sumX2 += members[mi][0]; sumY2 += members[mi][1];
        if (members[mi][0] < minBx) minBx = members[mi][0];
        if (members[mi][0] > maxBx) maxBx = members[mi][0];
        if (members[mi][1] < minBy) minBy = members[mi][1];
        if (members[mi][1] > maxBy) maxBy = members[mi][1];
      }
      var area = (maxBx - minBx) * (maxBy - minBy);
      if (area < minArea) continue;
      results.push({
        cx: Math.round(sumX2 / members.length),
        cy: Math.round(sumY2 / members.length),
        bx: minBx, by: minBy,
        bw: maxBx - minBx,
        bh: maxBy - minBy,
        area: area,
        count: members.length,
        conf: Math.min(1, members.length / (pts.length / k))
      });
    }

    // Sort by area descending
    results.sort(function(a, b) { return b.area - a.area; });
    return results;
  }

  return {
    render: render,
    detectClusters: detectClusters,
    buildGrid: buildGrid,
    hexToAEColor: hexToAEColor,
  };

})();
