// ASCIImp4 - ExtendScript Host
// Entry point loaded via $.evalFile from main.js (no #include)

var asciiHost = (function() {

  /* ── helpers ── */
  function ok(obj) { return JSON.stringify(obj); }
  function err(msg) { return JSON.stringify({ error: String(msg) }); }

  function getComp() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition.");
    return comp;
  }

  function getLayerByIndex(comp, idx) {
    idx = parseInt(idx);
    if (isNaN(idx) || idx < 1 || idx > comp.numLayers) throw new Error("Layer index out of range: " + idx);
    return comp.layers[idx];
  }

  /* ─────────────────────────────────────────
     getSelectedLayer()
     Returns {index, name} of the currently selected layer
  ───────────────────────────────────────── */
  function getSelectedLayer() {
    try {
      var comp = getComp();
      var sel = comp.selectedLayers;
      if (!sel || sel.length === 0) return ok({ index: null, name: null });
      return ok({ index: sel[0].index, name: sel[0].name });
    } catch(e) { return err(e.message); }
  }

  /* ─────────────────────────────────────────
     getLayers()
     Returns [{index, name, type}] for the active comp
  ───────────────────────────────────────── */
  function getLayers() {
    try {
      var comp = getComp();
      var result = [];
      for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layers[i];
        var type = "Other";
        if (layer instanceof AVLayer) {
          if (layer.source instanceof FootageItem) {
            type = layer.source.mainSource instanceof FileSource ? "Video" : "Solid";
          }
        } else if (layer instanceof TextLayer) {
          type = "Text";
        } else if (layer instanceof ShapeLayer) {
          type = "Shape";
        }
        result.push({ index: i, name: layer.name, type: type });
      }
      return ok(result);
    } catch(e) { return err(e.message); }
  }

  /* ─────────────────────────────────────────
     renderASCII(cfgJson)
     Main render: reads the source layer frame by frame,
     converts to ASCII, writes text layers into a new comp.
  ───────────────────────────────────────── */
  function renderASCII(cfgJson) {
    try {
      var cfg = JSON.parse(cfgJson);
      var comp = getComp();
      var srcLayer = getLayerByIndex(comp, cfg.sourceLayer);

      app.beginUndoGroup("ASCIImp4 Render");

      var result = asciiEngine.render(comp, srcLayer, cfg);

      app.endUndoGroup();
      return ok(result);
    } catch(e) {
      app.endUndoGroup();
      return err(e.message + (e.line ? " (line " + e.line + ")" : ""));
    }
  }

  /* ─────────────────────────────────────────
     buildOverlay(cfgJson)
     Builds data overlay (boxes, lines, labels) on the ASCII comp.
  ───────────────────────────────────────── */
  function buildOverlay(cfgJson) {
    try {
      var cfg = JSON.parse(cfgJson);
      var comp = getComp();
      var srcLayer = getLayerByIndex(comp, cfg.sourceLayer);

      app.beginUndoGroup("ASCIImp4 Overlay");

      var result = overlayBuilder.build(comp, srcLayer, cfg);

      app.endUndoGroup();
      return ok(result);
    } catch(e) {
      app.endUndoGroup();
      return err(e.message);
    }
  }

  /* ─────────────────────────────────────────
     previewClusters(cfgJson)
     Samples current-time frame and returns cluster data.
  ───────────────────────────────────────── */
  function previewClusters(cfgJson) {
    try {
      var cfg = JSON.parse(cfgJson);
      var comp = getComp();
      var srcLayer = getLayerByIndex(comp, cfg.sourceLayer);
      var clusters = asciiEngine.detectClusters(comp, srcLayer, cfg, comp.time);
      return ok(clusters);
    } catch(e) { return err(e.message); }
  }

  return {
    getSelectedLayer: getSelectedLayer,
    getLayers: getLayers,
    renderASCII: renderASCII,
    buildOverlay: buildOverlay,
    previewClusters: previewClusters
  };

})();
