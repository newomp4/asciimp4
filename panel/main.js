'use strict';

/* ─── AE bridge via built-in CEP API (no CSInterface.js needed) ─── */
function evalScript(code, cb) {
  const cep = window.__adobe_cep__;
  if (cep) {
    cep.evalScript(code, result => {
      // result is either a plain string or {data, type} depending on CEP version
      const val = (result && result.data !== undefined) ? result.data : result;
      if (cb) cb(String(val));
    });
  } else {
    // Not running inside AE
    if (cb) cb('{"error":"Panel not running inside After Effects"}');
  }
}

/* ─── State ─── */
const state = {
  sourceLayer: '',
  useAlpha: false,
  frameStep: 1,
  charSet: 'standard',
  customChars: ' .:-=+*#@',
  invertMap: false,
  cellSize: 10,
  dynamicScale: false,
  cellMin: 6,
  cellMax: 20,
  scaleResp: 50,
  resDiv: 2,
  lumaThresh: 20,
  alphaThresh: 128,
  contrast: 100,
  gamma: 100,
  outCompName: 'ASCII_Output',
  outFont: 'Arial',
  leading: 100,
  tracking: 0,
  bgFill: true,
  bgColor: '#000000',
  colorMode: 'mono',
  colorPrimary: '#00e5ff',
  colorSecondary: '#7c4dff',
  hueSpread: 30,
  analogCount: 4,
  analogCycle: false,
  cycleSpeed: 30,
  hueShift: 0,
  saturation: 100,
  brightness: 100,
  overlaySource: false,
  sourceBlend: 60,
  perCharTint: false,
  trackerEnabled: false,
  maxClusters: 5,
  clusterSens: 40,
  clusterMinArea: 200,
  trackMode: 'bright',
  showBoxes: true,
  boxColor: '#ffffff',
  boxStroke: 1,
  boxRounded: false,
  showLines: true,
  lineStyle: 'dotted',
  lineColor: '#ffffff',
  lineOpacity: 60,
  showLabels: true,
  labelType: 'id',
  labelFont: 'Arial',
  labelSize: 12,
  labelColor: '#ffffff',
  scanLines: false,
  cornerBrackets: false,
};

const CHAR_SETS = {
  standard: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  numbers:  ' 123456789012345678901234567890',
  binary:   ' 01',
  letters:  ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  symbols:  ' .,-~:;=!*#$@',
  blocks:   ' ░▒▓█',
  dots:     ' ·▪■',
  hex:      ' 0123456789abcdef',
};

/* ─── Helpers ─── */
function $(id) { return document.getElementById(id); }

function log(msg, type) {
  const el = $('log');
  const line = document.createElement('div');
  line.className = type === 'err' ? 'log-err' : type === 'info' ? 'log-info' : 'log-ok';
  line.textContent = '> ' + msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function setProgress(pct, label) {
  const wrap = $('progress-wrap');
  wrap.style.display = pct >= 0 && pct < 100 ? 'block' : 'none';
  $('progress-fill').style.width = pct + '%';
  $('progress-label').textContent = label || (Math.round(pct) + '%');
}

function bindRange(id, stateKey, displayFn) {
  const el = $(id);
  if (!el) return;
  const valEl = $(id + '-val');
  el.addEventListener('input', () => {
    state[stateKey] = parseFloat(el.value);
    if (valEl) valEl.textContent = displayFn ? displayFn(el.value) : el.value;
  });
}

function bindToggle(id, stateKey, onChange) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('change', () => {
    state[stateKey] = el.checked;
    if (onChange) onChange(el.checked);
  });
}

/* ─── Tooltips ─── */
const tooltip = $('tooltip');

document.querySelectorAll('.tip').forEach(el => {
  el.addEventListener('mouseenter', e => {
    tooltip.textContent = el.dataset.tip;
    tooltip.style.display = 'block';
    const rect = el.getBoundingClientRect();
    let left = rect.right + 10;
    if (left + 230 > window.innerWidth) left = rect.left - 230;
    let top = rect.top - 4;
    if (top + 80 > window.innerHeight) top = window.innerHeight - 90;
    tooltip.style.left = Math.max(4, left) + 'px';
    tooltip.style.top = Math.max(4, top) + 'px';
  });
  el.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
});

/* ─── Tabs ─── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('pane-' + tab.dataset.pane).classList.add('active');
  });
});

/* ─── Collapsible sections ─── */
document.querySelectorAll('.section-header').forEach(hdr => {
  hdr.addEventListener('click', () => {
    hdr.closest('.section').classList.toggle('collapsed');
  });
});

/* ─── Range bindings ─── */
bindRange('frame-step', 'frameStep');
bindRange('cell-size', 'cellSize');
bindRange('cell-min', 'cellMin');
bindRange('cell-max', 'cellMax');
bindRange('scale-resp', 'scaleResp');
bindRange('res-div', 'resDiv');
bindRange('luma-thresh', 'lumaThresh');
bindRange('alpha-thresh', 'alphaThresh');
bindRange('contrast', 'contrast');
bindRange('gamma', 'gamma', v => (v / 100).toFixed(1));
bindRange('leading', 'leading', v => v + '%');
bindRange('tracking', 'tracking');
bindRange('hue-spread', 'hueSpread', v => v + '°');
bindRange('analog-count', 'analogCount');
bindRange('cycle-speed', 'cycleSpeed');
bindRange('hue-shift', 'hueShift', v => v + '°');
bindRange('saturation', 'saturation', v => v + '%');
bindRange('brightness', 'brightness', v => v + '%');
bindRange('source-blend', 'sourceBlend', v => v + '%');
bindRange('max-clusters', 'maxClusters');
bindRange('cluster-sens', 'clusterSens');
bindRange('cluster-min-area', 'clusterMinArea');
bindRange('box-stroke', 'boxStroke');
bindRange('line-opacity', 'lineOpacity', v => v + '%');
bindRange('label-size', 'labelSize');

/* ─── Toggle bindings ─── */
bindToggle('use-alpha', 'useAlpha');
bindToggle('invert-map', 'invertMap');
bindToggle('dynamic-scale', 'dynamicScale', v => {
  $('dynamic-opts').style.display = v ? 'block' : 'none';
});
bindToggle('bg-fill', 'bgFill', v => {
  $('bg-color-row').style.display = v ? 'flex' : 'none';
});
bindToggle('analog-cycle', 'analogCycle');
bindToggle('overlay-source', 'overlaySource');
bindToggle('per-char-tint', 'perCharTint');
bindToggle('tracker-enabled', 'trackerEnabled');
bindToggle('show-boxes', 'showBoxes');
bindToggle('box-rounded', 'boxRounded');
bindToggle('show-lines', 'showLines');
bindToggle('show-labels', 'showLabels');
bindToggle('scan-lines', 'scanLines');
bindToggle('corner-brackets', 'cornerBrackets');

/* ─── Color inputs ─── */
['color-primary', 'color-secondary', 'bg-color', 'box-color', 'line-color', 'label-color'].forEach(id => {
  const el = $(id);
  if (!el) return;
  const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  el.addEventListener('input', e => {
    state[key] = e.target.value;
    if (id === 'color-primary') updateAnalogousPreview();
  });
});

/* ─── Select bindings ─── */
$('out-font').addEventListener('change', e => { state.outFont = e.target.value; });
$('label-font').addEventListener('change', e => { state.labelFont = e.target.value; });
$('out-comp-name').addEventListener('input', e => { state.outCompName = e.target.value; });
$('custom-charset').addEventListener('input', e => {
  state.customChars = e.target.value;
  updateCharsetPreview();
});

/* ─── Charset chips ─── */
document.querySelectorAll('#charset-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#charset-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.charSet = chip.dataset.set;
    $('custom-row').style.display = state.charSet === 'custom' ? 'flex' : 'none';
    updateCharsetPreview();
  });
});

function updateCharsetPreview() {
  const chars = state.charSet === 'custom' ? state.customChars : (CHAR_SETS[state.charSet] || '');
  $('charset-preview').textContent = chars.length > 22 ? chars.substring(0, 22) + '…' : chars;
}

/* ─── Color mode chips ─── */
const COLOR_MODE_HINTS = {
  mono:      'Single color applied to all characters.',
  source:    'Samples original video color per ASCII cell.',
  analogous: 'Generates harmonious color palette from base hue.',
  hueshift:  'Animates hue rotation over time.',
  gradient:  'Vertical gradient from primary to secondary color.',
  neon:      'High-saturation cycling neon palette.',
  thermal:   'Cool-to-hot thermal imaging palette.',
  glitch:    'Randomized color per character each frame.',
};

document.querySelectorAll('#color-mode-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#color-mode-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.colorMode = chip.dataset.mode;
    $('color-mode-hint').textContent = COLOR_MODE_HINTS[state.colorMode] || '';
  });
});

/* ─── Other chip groups ─── */
document.querySelectorAll('#track-mode-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#track-mode-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.trackMode = chip.dataset.tmode;
  });
});

document.querySelectorAll('#line-style-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#line-style-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.lineStyle = chip.dataset.lstyle;
  });
});

document.querySelectorAll('#label-type-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#label-type-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.labelType = chip.dataset.ltype;
  });
});

/* ─── Analogous preview ─── */
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h /= 6;
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

function hslToHex(h,s,l) {
  h/=360; s/=100; l/=100;
  let r,g,b;
  if (s === 0) { r=g=b=l; }
  else {
    const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return '#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function updateAnalogousPreview() {
  const [h,s,l] = hexToHSL(state.colorPrimary);
  const count = state.analogCount;
  const spread = state.hueSpread;
  const container = $('analogous-preview');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const offset = (i - Math.floor(count/2)) * (spread / Math.max(count-1, 1));
    const sw = document.createElement('div');
    sw.className = 'a-swatch';
    sw.style.background = hslToHex((h + offset + 360) % 360, s, l);
    container.appendChild(sw);
  }
}

$('hue-spread').addEventListener('input', updateAnalogousPreview);
$('analog-count').addEventListener('input', updateAnalogousPreview);

/* ─── Layer selection ─── */
function grabSelectedLayer(cb) {
  evalScript('asciiHost.getSelectedLayer()', result => {
    try {
      const res = JSON.parse(result);
      if (res.error || !res.index) {
        log('No layer selected in AE — click a layer in the timeline first.', 'err');
        if (cb) cb(false);
        return;
      }
      state.sourceLayer = res.index;
      $('selected-layer-name').textContent = res.name;
      $('selected-layer-name').style.fontStyle = 'normal';
      log('Using layer: ' + res.name, 'ok');
      if (cb) cb(true);
    } catch(e) {
      log('Layer error: ' + e.message, 'err');
      if (cb) cb(false);
    }
  });
}

$('btn-use-selected').addEventListener('click', () => grabSelectedLayer());

/* ─── Main RENDER ─── */
$('run-btn').addEventListener('click', () => {
  const doRender = () => {
    if (!state.sourceLayer) {
      log('No layer selected — click a layer in the AE timeline first.', 'err');
      return;
    }
    setProgress(1, 'Starting…');
    log('Starting ASCII render…', 'info');
    evalScript('asciiHost.renderASCII(' + JSON.stringify(JSON.stringify(state)) + ')', result => {
      try {
        const res = JSON.parse(result);
        if (res.error) { log('Error: ' + res.error, 'err'); }
        else { log('Done! Comp: ' + res.compName + ' (' + res.frames + ' frames)', 'ok'); }
      } catch(e) { log('Parse error: ' + result, 'err'); }
      setProgress(100);
    });
  };

  // Auto-grab selected layer on render if not already set
  if (!state.sourceLayer) {
    grabSelectedLayer(ok => { if (ok) doRender(); });
  } else {
    doRender();
  }
});

/* ─── Build Overlay ─── */
$('btn-build-overlay').addEventListener('click', () => {
  log('Building data overlay layers…', 'info');
  evalScript('asciiHost.buildOverlay(' + JSON.stringify(JSON.stringify(state)) + ')', result => {
    try {
      const res = JSON.parse(result);
      if (res.error) { log('Overlay error: ' + res.error, 'err'); }
      else { log('Overlay built: ' + res.layerCount + ' layers created', 'ok'); }
    } catch(e) { log('Overlay error: ' + e.message, 'err'); }
  });
});

/* ─── Preview Clusters ─── */
$('btn-preview-clusters').addEventListener('click', () => {
  log('Analyzing clusters on current frame…', 'info');
  evalScript('asciiHost.previewClusters(' + JSON.stringify(JSON.stringify(state)) + ')', result => {
    try {
      const clusters = JSON.parse(result);
      const list = $('cluster-list');
      if (!clusters || !clusters.length) { list.textContent = 'No clusters found.'; return; }
      list.innerHTML = clusters.map((c, i) =>
        `#${i+1}  cx:${c.cx} cy:${c.cy}  area:${c.area}  conf:${(c.conf*100).toFixed(0)}%`
      ).join('\n');
      log(clusters.length + ' clusters detected', 'ok');
    } catch(e) { log('Cluster error: ' + e.message, 'err'); }
  });
});

/* ─── Presets ─── */
const DEFAULT_PRESETS = [
  { name: 'Binary Glitch',  tag: 'built-in', state: { charSet:'binary',   colorMode:'glitch',    dynamicScale:true, cellMin:6, cellMax:18 }},
  { name: 'Warm Analog',    tag: 'built-in', state: { charSet:'standard', colorMode:'analogous', colorPrimary:'#ff9100', hueSpread:40 }},
  { name: 'Cold Scan',      tag: 'built-in', state: { charSet:'standard', colorMode:'mono',      colorPrimary:'#00e5ff', scanLines:true }},
  { name: 'Matrix',         tag: 'built-in', state: { charSet:'letters',  colorMode:'mono',      colorPrimary:'#00e676', bgColor:'#000000' }},
  { name: 'Thermal Vision', tag: 'built-in', state: { charSet:'blocks',   colorMode:'thermal',   dynamicScale:true }},
  { name: 'Hex Data',       tag: 'built-in', state: { charSet:'hex',      colorMode:'hueshift',  showBoxes:true, showLabels:true }},
];

let userPresets = [];
try { userPresets = JSON.parse(localStorage.getItem('asciimp4_presets') || '[]'); } catch(e){}

function savePresetsToStorage() {
  localStorage.setItem('asciimp4_presets', JSON.stringify(userPresets));
}

function renderPresetList() {
  const list = $('preset-list');
  list.innerHTML = '';
  const all = [...DEFAULT_PRESETS, ...userPresets];
  all.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.innerHTML = `
      <div><span class="preset-name">${p.name}</span> <span class="preset-tag">${p.tag || 'user'}</span></div>
      <div class="preset-actions">
        <button class="btn-ghost" style="padding:2px 8px;font-size:9px" data-load="${i}">Load</button>
        ${i >= DEFAULT_PRESETS.length ? `<button class="btn-ghost" style="padding:2px 7px;font-size:9px;color:#ff6b6b" data-del="${i - DEFAULT_PRESETS.length}">✕</button>` : ''}
      </div>`;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = all[parseInt(btn.dataset.load)];
      Object.assign(state, p.state);
      applyStateToUI();
      log('Loaded preset: ' + p.name, 'ok');
    });
  });

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      userPresets.splice(parseInt(btn.dataset.del), 1);
      savePresetsToStorage();
      renderPresetList();
    });
  });
}

$('btn-save-preset').addEventListener('click', () => {
  const name = $('new-preset-name').value.trim();
  if (!name) { log('Enter a preset name.', 'err'); return; }
  userPresets.push({ name, tag: 'user', state: Object.assign({}, state) });
  savePresetsToStorage();
  renderPresetList();
  log('Saved preset: ' + name, 'ok');
  $('new-preset-name').value = '';
});

$('btn-export-presets').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ presets: userPresets }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'asciimp4-presets.json';
  a.click();
});

$('btn-import-presets').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.presets) {
          userPresets = userPresets.concat(data.presets);
          savePresetsToStorage();
          renderPresetList();
          log('Imported ' + data.presets.length + ' presets', 'ok');
        }
      } catch(err) { log('Import error: ' + err.message, 'err'); }
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
});

/* ─── Apply state → UI ─── */
function applyStateToUI() {
  const rangeMap = {
    'frame-step':'frameStep', 'cell-size':'cellSize', 'cell-min':'cellMin',
    'cell-max':'cellMax', 'scale-resp':'scaleResp', 'res-div':'resDiv',
    'luma-thresh':'lumaThresh', 'alpha-thresh':'alphaThresh', 'contrast':'contrast',
    'gamma':'gamma', 'leading':'leading', 'tracking':'tracking',
    'hue-spread':'hueSpread', 'analog-count':'analogCount', 'cycle-speed':'cycleSpeed',
    'hue-shift':'hueShift', 'saturation':'saturation', 'brightness':'brightness',
    'source-blend':'sourceBlend', 'max-clusters':'maxClusters',
    'cluster-sens':'clusterSens', 'cluster-min-area':'clusterMinArea',
    'box-stroke':'boxStroke', 'line-opacity':'lineOpacity', 'label-size':'labelSize',
  };
  Object.entries(rangeMap).forEach(([id, key]) => {
    const el = $(id);
    if (el && state[key] !== undefined) { el.value = state[key]; el.dispatchEvent(new Event('input')); }
  });
  ['use-alpha','invert-map','dynamic-scale','bg-fill','analog-cycle',
   'overlay-source','per-char-tint','tracker-enabled','show-boxes',
   'box-rounded','show-lines','show-labels','scan-lines','corner-brackets'
  ].forEach(id => {
    const el = $(id);
    const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (el && state[key] !== undefined) { el.checked = state[key]; el.dispatchEvent(new Event('change')); }
  });
  document.querySelectorAll('#charset-chips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.set === state.charSet);
  });
  updateCharsetPreview();
  updateAnalogousPreview();
}

/* ─── Init ─── */
updateCharsetPreview();
updateAnalogousPreview();
renderPresetList();
$('dynamic-opts').style.display = 'none';

// Check AE connection
const statusEl = $('ae-status');
if (window.__adobe_cep__) {
  evalScript('$.engineName', result => {
    if (result && !result.includes('error')) {
      statusEl.textContent = '● connected';
      statusEl.style.color = 'var(--text2)';
    } else {
      statusEl.textContent = '● no comp open';
      statusEl.style.color = '#ff6b6b';
    }
  });
} else {
  statusEl.textContent = '● not in AE';
  statusEl.style.color = '#ff6b6b';
}
