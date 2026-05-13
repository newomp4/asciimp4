// ASCIImp4 - Overlay Builder
// Builds data overlay layers: bounding boxes, connector lines, labels

var overlayBuilder = (function() {

  function hexToAEColor(hex) {
    hex = hex.replace('#', '');
    return [
      parseInt(hex.substring(0,2), 16) / 255,
      parseInt(hex.substring(2,4), 16) / 255,
      parseInt(hex.substring(4,6), 16) / 255,
    ];
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ── Draw a rectangle shape layer ── */
  function addBoundingBox(comp, cluster, idx, cfg, time, frameRate) {
    var color = hexToAEColor(cfg.boxColor || '#00e5ff');
    var strokeW = parseFloat(cfg.boxStroke) || 1;
    var opacity = 100;

    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = "BB_" + idx;

    var contents = shapeLayer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    grp.name = "BBox_" + idx;

    var rect = grp.property("Contents").addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([cluster.bw, cluster.bh]);
    rect.property("Position").setValue([cluster.cx, cluster.cy]);
    if (cfg.boxRounded) {
      rect.property("Roundness").setValue(6);
    }

    // Stroke
    var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("Color").setValue(color);
    stroke.property("Opacity").setValue(opacity);
    stroke.property("Stroke Width").setValue(strokeW);

    shapeLayer.inPoint = time;
    shapeLayer.outPoint = time + (1 / frameRate);

    return shapeLayer;
  }

  /* ── Draw a scan-line rect (animated dashes) ── */
  function addScanLine(comp, cluster, cfg, time, frameRate) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = "ScanLine";
    var contents = shapeLayer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");

    var path = grp.property("Contents").addProperty("ADBE Vector Shape - Rect");
    path.property("Size").setValue([cluster.bw, 2]);
    path.property("Position").setValue([cluster.cx, cluster.by]);

    var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("Color").setValue(hexToAEColor(cfg.boxColor || '#00e5ff'));
    stroke.property("Stroke Width").setValue(1);
    stroke.property("Opacity").setValue(60);

    // Animate Y position within bounding box over 0.5s
    var posY = shapeLayer.property("Position");
    posY.setValueAtTime(time, [0, cluster.by]);
    posY.setValueAtTime(time + 0.5, [0, cluster.by + cluster.bh]);

    shapeLayer.inPoint = time;
    shapeLayer.outPoint = time + (1 / frameRate);

    return shapeLayer;
  }

  /* ── Draw corner brackets (HUD style) ── */
  function addCornerBrackets(comp, cluster, cfg, time, frameRate) {
    var color = hexToAEColor(cfg.boxColor || '#00e5ff');
    var bracketLen = Math.min(20, cluster.bw * 0.2);

    var corners = [
      { x: cluster.bx,              y: cluster.by,              dx: 1,  dy: 1  },
      { x: cluster.bx + cluster.bw, y: cluster.by,              dx: -1, dy: 1  },
      { x: cluster.bx,              y: cluster.by + cluster.bh, dx: 1,  dy: -1 },
      { x: cluster.bx + cluster.bw, y: cluster.by + cluster.bh, dx: -1, dy: -1 },
    ];

    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = "Brackets";
    var contents = shapeLayer.property("Contents");

    for (var ci = 0; ci < corners.length; ci++) {
      var c = corners[ci];
      var grp = contents.addProperty("ADBE Vector Group");

      // Horizontal arm
      var hShape = grp.property("Contents").addProperty("ADBE Vector Shape - Group");
      var hPath = new Shape();
      hPath.vertices = [[c.x, c.y], [c.x + c.dx * bracketLen, c.y]];
      hPath.closed = false;
      hShape.property("Path").setValue(hPath);

      // Vertical arm
      var vShape = grp.property("Contents").addProperty("ADBE Vector Shape - Group");
      var vPath = new Shape();
      vPath.vertices = [[c.x, c.y], [c.x, c.y + c.dy * bracketLen]];
      vPath.closed = false;
      vShape.property("Path").setValue(vPath);

      var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("Color").setValue(color);
      stroke.property("Stroke Width").setValue(parseFloat(cfg.boxStroke) || 1);
    }

    shapeLayer.inPoint = time;
    shapeLayer.outPoint = time + (1 / frameRate);
    return shapeLayer;
  }

  /* ── Draw a connector line between two clusters ── */
  function addConnectorLine(comp, a, b, cfg, time, frameRate) {
    var color = hexToAEColor(cfg.lineColor || '#7c4dff');
    var opacity = (cfg.lineOpacity || 60);
    var style = cfg.lineStyle || 'dotted';

    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = "Connector";
    var contents = shapeLayer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");

    var pathShape = grp.property("Contents").addProperty("ADBE Vector Shape - Group");
    var path = new Shape();
    path.vertices = [[a.cx, a.cy], [b.cx, b.cy]];
    path.closed = false;
    pathShape.property("Path").setValue(path);

    var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("Color").setValue(color);
    stroke.property("Opacity").setValue(opacity);
    stroke.property("Stroke Width").setValue(1);
    stroke.property("Line Cap").setValue(2); // round

    if (style === 'dotted') {
      stroke.property("Dashes").addProperty("ADBE Vector Stroke Dash 1").setValue(1);
      stroke.property("Dashes").addProperty("ADBE Vector Stroke Gap 1").setValue(4);
    } else if (style === 'dashed') {
      stroke.property("Dashes").addProperty("ADBE Vector Stroke Dash 1").setValue(6);
      stroke.property("Dashes").addProperty("ADBE Vector Stroke Gap 1").setValue(4);
    }

    shapeLayer.inPoint = time;
    shapeLayer.outPoint = time + (1 / frameRate);
    return shapeLayer;
  }

  /* ── Add a label text layer ── */
  function addLabel(comp, cluster, idx, cfg, time, frameRate) {
    var labelType = cfg.labelType || 'id';
    var labelText;
    switch(labelType) {
      case 'coords': labelText = cluster.cx + ',' + cluster.cy; break;
      case 'area':   labelText = 'A:' + cluster.area; break;
      case 'conf':   labelText = Math.round(cluster.conf * 100) + '%'; break;
      default:       labelText = '#' + (idx + 1); break;
    }

    var textLayer = comp.layers.addText(labelText);
    var textDoc = textLayer.property("Source Text").value;
    textDoc.font = cfg.labelFont || 'Arial';
    textDoc.fontSize = parseFloat(cfg.labelSize) || 12;
    textDoc.fillColor = colorEngine.hexToRGB(cfg.labelColor || '#ffffff');
    textLayer.property("Source Text").setValue(textDoc);

    var px = cluster.bx;
    var py = cluster.by - 6;
    textLayer.property("Position").setValue([px, py]);

    textLayer.inPoint = time;
    textLayer.outPoint = time + (1 / frameRate);
    return textLayer;
  }

  /* ── Main build function ── */
  function build(comp, srcLayer, cfg) {
    var clusters = asciiEngine.detectClusters(comp, srcLayer, cfg, comp.time);
    if (!clusters || clusters.length === 0) {
      return { layerCount: 0 };
    }

    var frameRate = comp.frameRate;
    var time = comp.time;
    var layerCount = 0;

    // Find or create overlay comp
    var overlayComp = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.items[i] instanceof CompItem &&
          app.project.items[i].name === 'ASCII_Overlay') {
        overlayComp = app.project.items[i];
        break;
      }
    }
    if (!overlayComp) {
      overlayComp = app.project.items.addComp(
        'ASCII_Overlay', comp.width, comp.height,
        comp.pixelAspect, comp.duration, frameRate
      );
    }

    // Bounding boxes
    if (cfg.showBoxes) {
      for (var ci = 0; ci < clusters.length; ci++) {
        if (cfg.cornerBrackets) {
          addCornerBrackets(overlayComp, clusters[ci], cfg, time, frameRate);
          layerCount++;
        } else {
          addBoundingBox(overlayComp, clusters[ci], ci, cfg, time, frameRate);
          layerCount++;
        }
        if (cfg.scanLines) {
          addScanLine(overlayComp, clusters[ci], cfg, time, frameRate);
          layerCount++;
        }
      }
    }

    // Connector lines between adjacent clusters
    if (cfg.showLines && clusters.length > 1) {
      for (var li = 0; li < clusters.length - 1; li++) {
        addConnectorLine(overlayComp, clusters[li], clusters[li+1], cfg, time, frameRate);
        layerCount++;
      }
    }

    // Labels
    if (cfg.showLabels) {
      for (var lbi = 0; lbi < clusters.length; lbi++) {
        addLabel(overlayComp, clusters[lbi], lbi, cfg, time, frameRate);
        layerCount++;
      }
    }

    return { layerCount: layerCount, compName: overlayComp.name };
  }

  return { build: build };

})();
