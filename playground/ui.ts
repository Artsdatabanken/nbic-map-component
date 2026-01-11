// playground/ui.ts
import { nbicMapPresets } from '../src';
import { MapAPI } from '../src/api/MapAPI';
// import type { MapEngine } from '../src/core/MapEngine'; // adjust path if different
import type { DrawKind, DrawStyleOptions } from '../src/api/types';

type UiLayers = {
  cluster: string;
  polygon: string;
  accuracy: string;
};

type WireUiConfig = {
  map: MapAPI;
  log: (msg: string) => void;
  renderFeatures: () => void;
  layers: UiLayers;
  baseLayerIds: string[];
  overlayLayerIds: string[];
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export function wireUi(cfg: WireUiConfig) {
  const { map, log, renderFeatures, layers, baseLayerIds, overlayLayerIds } = cfg;  
  log('Available layers: ' + Object.values(layers).join(', '));
  //   // --- base layer select
  const baseSelect = $('baseSelect') as HTMLSelectElement;
  baseSelect.innerHTML = baseLayerIds
    .map((id) => `<option value="${id}">${id}</option>`)
    .join('');
  baseSelect.addEventListener('change', () => {
    const id = baseSelect.value;
    for (const b of baseLayerIds) map.setLayerVisibility(b, b === id);
    log(`base: ${id}`);
  });

  const btnFitNorway = $('btnFitNorway') as HTMLButtonElement;
  btnFitNorway.addEventListener('click', () => {
    const coordinate = nbicMapPresets.norwayCoordinate;
    const transformCoordsFrom = map.transformCoordsFrom([coordinate[0], coordinate[1]], 'EPSG:4326', 'EPSG:3857');
    map.setCenter(transformCoordsFrom);
    map.setZoom(4);
    log('view: fit Norway');
  });
  // ---- helpers ----
  const bindClick = (id: string, fn: () => void) => $(id).addEventListener('click', fn);
  // const bindToggle = (id: string, fn: (on: boolean) => void) =>
  //   $(id).addEventListener('change', () => fn(asInput($(id)).checked));

  // ---- draw buttons ----
    const drawKind = $('drawKind') as HTMLSelectElement;
    const drawStart = $('drawStart') as HTMLButtonElement;
    const drawStop = $('drawStop') as HTMLButtonElement;
    const drawUndo = $('drawUndo') as HTMLButtonElement;
    const drawFinish = $('drawFinish') as HTMLButtonElement;
    const drawAbort = $('drawAbort') as HTMLButtonElement;
    const drawClear = $('drawClear') as HTMLButtonElement;

    const editingEnabled = $('editingEnabled') as HTMLInputElement;
    const verticesPersistent = $('verticesPersistent') as HTMLInputElement;
    const interactiveBuffer = $('interactiveBuffer') as HTMLInputElement;

    const selectedStroke = $('selectedStroke') as HTMLInputElement;
  function setDisabled(el: HTMLElement, disabled: boolean) {
    (el as HTMLButtonElement).disabled = disabled;
  }
    let isDrawing = false;
    const refreshDrawButtons = () => {
      setDisabled(drawStart, isDrawing);
      setDisabled(drawUndo, !isDrawing);
      setDisabled(drawFinish, !isDrawing);
      setDisabled(drawAbort, !isDrawing);
    };
    refreshDrawButtons();

    drawStart.addEventListener('click', () => {
      const kind = drawKind.value as DrawKind;
      const style: DrawStyleOptions = {
        strokeColor: selectedStroke.value,
        strokeWidth: 3,
        fillColor: 'rgba(0,255,0,0.12)',
        text: kind === 'Text'
          ? {
              label: 'location_pin',
              font: 'normal normal 400 36px "Material Icons"',
              fillColor: selectedStroke.value,
              strokeColor: 'transparent',
              strokeWidth: 0,
              offsetY: -10,
            }
          : undefined,
      };
      map.startDrawing({ kind, style, snap: true, buffer: interactiveBuffer.checked ? {interactive: true} : undefined });
      isDrawing = true;
      refreshDrawButtons();
      log(`draw:start ${kind}`);
    });

    drawUndo.addEventListener('click', () => map.undoLastPoint());
    drawStop.addEventListener('click', () => map.stopDrawing());
    drawFinish.addEventListener('click', () => map.finishCurrent());
    drawAbort.addEventListener('click', () => map.abortCurrent());
    drawClear.addEventListener('click', () => map.clearDrawn());

    // --- editing
    const applyEditing = () => {
      if (!editingEnabled.checked) {
        map.disableDrawEditing();
        log('editing: off');
        return;
      }
      map.enableDrawEditing({
        showVertices: true,
        showVerticesPersistent: verticesPersistent.checked,
        vertexStyle: { strokeColor: '#1976d2', strokeWidth: 2, fillColor: '#fff', pointRadius: 5 },
      });
      log(`editing: on (persistent=${verticesPersistent.checked})`);
    };
    editingEnabled.addEventListener('change', applyEditing);
    verticesPersistent.addEventListener('change', applyEditing);
    applyEditing();

  //   // --- react to events (to keep UI in sync)
    map.on('draw:start', () => {
      isDrawing = true;
      refreshDrawButtons();
    });
    map.on('draw:end', () => {
      isDrawing = false;
      refreshDrawButtons();
      // renderFeatureList();
    });
    map.on('draw:cleared', () => {
      isDrawing = false;
      refreshDrawButtons();
      // renderFeatureList();
    });
  // bindClick('btnDrawPoint', () => map.startDrawing({ kind: 'Point' }));
  // bindClick('btnDrawLine', () => map.startDrawing({ kind: 'LineString' }));
  // bindClick('btnDrawPoly', () => map.startDrawing({ kind: 'Polygon' }));
  // bindClick('btnDrawCircle', () => map.startDrawing({ kind: 'Circle' }));
  // bindClick('btnDrawBox', () => map.startDrawing({ kind: 'Box' })); // if DrawKind doesn't include Box yet

  // bindClick('btnDrawStop', () => map.stopDrawing());
  // bindClick('btnUndo', () => map.undoLastPoint?.());
  // bindClick('btnFinish', () => map.finishCurrent?.());

  // ---- editing ----
  // bindToggle('chkEdit', (on) => (on ? map.enableDrawEditing() : map.disableDrawEditing()));
  // bindToggle('chkPersistentVertices', (on) => {
  //   // if your enableDrawEditing supports options, use it; else ignore
  //   if (on) map.enableDrawEditing({ showVerticesPersistent: true });
  // });

  // ---- layers toggles (example) ----
  // bindToggle('chkDemoPoints', (on) => map.setLayerVisibility(layers.cluster, on));
  // bindToggle('chkClustering', (on) => {
  //   // if you implemented clustering toggle, call it here; otherwise log
  //   log(`Clustering toggle: ${on ? 'on' : 'off'} (wire to your API if available)`);
  // });
  //   // --- overlay toggles
    const overlayToggles = $('overlayToggles');
    overlayToggles.innerHTML = '';
    for (const id of overlayLayerIds) {
      const row = document.createElement('label');
      row.className = 'row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', () => {
        map.setLayerVisibility(id, cb.checked);
        log(`overlay ${id}: ${cb.checked ? 'on' : 'off'}`);
      });
      const span = document.createElement('span');
      span.textContent = id;
      row.append(cb, span);
      overlayToggles.appendChild(row);
    }

  // ---- misc ----
  // bindClick('btnClearDrawn', () => map.clearDrawn());
  bindClick('btnActivateHover', () => map.activateHoverInfo());
  bindClick('btnDeactivateHover', () => map.deactivateHoverInfo());
  bindClick('btnClearLog', () => {
    const el = document.getElementById('eventLog');
    if (el) el.textContent = '';
  });

  // Refresh feature dump when actions happen (optional)
  renderFeatures();
  log('UI wired.');
}


// import type { MapAPI } from '../src/api/MapAPI';
// import type { DrawKind, DrawStyleOptions, LayerDef } from '../src/api/types';

// type UiDeps = {
//   map: MapAPI;
//   baseLayerIds: string[];
//   overlayLayerIds: string[];
//   overlays: Record<string, LayerDef>;
//   pushLog: (msg: string) => void;
//   renderFeatureList: () => void;
// };

// function $(id: string): HTMLElement {
//   const el = document.getElementById(id);
//   if (!el) throw new Error(`Missing #${id}`);
//   return el;
// }

// function setDisabled(el: HTMLElement, disabled: boolean) {
//   (el as HTMLButtonElement).disabled = disabled;
// }

// export function wireUi(deps: UiDeps) {
//   const {
//     map,
//     baseLayerIds,
//     overlayLayerIds,
//     overlays,
//     pushLog,
//     renderFeatureList,
//   } = deps;

// //   // --- base layer select
//   const baseSelect = $('baseSelect') as HTMLSelectElement;
//   baseSelect.innerHTML = baseLayerIds
//     .map((id) => `<option value="${id}">${id}</option>`)
//     .join('');
//   baseSelect.addEventListener('change', () => {
//     const id = baseSelect.value;
//     for (const b of baseLayerIds) map.setLayerVisibility(b, b === id);
//     pushLog(`base: ${id}`);
//   });

//   // --- overlay toggles
//   const overlayToggles = $('overlayToggles');
//   overlayToggles.innerHTML = '';
//   for (const id of overlayLayerIds) {
//     const row = document.createElement('label');
//     row.className = 'row';
//     const cb = document.createElement('input');
//     cb.type = 'checkbox';
//     cb.checked = true;
//     cb.addEventListener('change', () => {
//       map.setLayerVisibility(id, cb.checked);
//       pushLog(`overlay ${id}: ${cb.checked ? 'on' : 'off'}`);
//     });
//     const span = document.createElement('span');
//     span.textContent = id;
//     row.append(cb, span);
//     overlayToggles.appendChild(row);
//   }

//   // --- draw
//   const drawKind = $('drawKind') as HTMLSelectElement;
//   const drawStart = $('drawStart') as HTMLButtonElement;
//   const drawStop = $('drawStop') as HTMLButtonElement;
//   const drawUndo = $('drawUndo') as HTMLButtonElement;
//   const drawFinish = $('drawFinish') as HTMLButtonElement;
//   const drawAbort = $('drawAbort') as HTMLButtonElement;
//   const drawClear = $('drawClear') as HTMLButtonElement;

//   const editingEnabled = $('editingEnabled') as HTMLInputElement;
//   const verticesPersistent = $('verticesPersistent') as HTMLInputElement;

//   const selectedStroke = $('selectedStroke') as HTMLInputElement;

//   let isDrawing = false;
//   const refreshDrawButtons = () => {
//     setDisabled(drawStart, isDrawing);
//     setDisabled(drawUndo, !isDrawing);
//     setDisabled(drawFinish, !isDrawing);
//     setDisabled(drawAbort, !isDrawing);
//   };
//   refreshDrawButtons();

//   drawStart.addEventListener('click', () => {
//     const kind = drawKind.value as DrawKind;
//     const style: DrawStyleOptions = {
//       strokeColor: selectedStroke.value,
//       strokeWidth: 3,
//       fillColor: 'rgba(0,255,0,0.12)',
//       text: kind === 'Text'
//         ? {
//             label: 'location_pin',
//             font: 'normal normal 400 36px "Material Icons"',
//             fillColor: selectedStroke.value,
//             strokeColor: 'transparent',
//             strokeWidth: 0,
//             offsetY: -10,
//           }
//         : undefined,
//     };
//     map.startDrawing({ kind, style, snap: true });
//     isDrawing = true;
//     refreshDrawButtons();
//     pushLog(`draw:start ${kind}`);
//   });

//   drawUndo.addEventListener('click', () => map.undoLastPoint());
//   drawStop.addEventListener('click', () => map.stopDrawing());
//   drawFinish.addEventListener('click', () => map.finishCurrent());
//   drawAbort.addEventListener('click', () => map.abortCurrent());
//   drawClear.addEventListener('click', () => map.clearDrawn());

//   // --- editing
//   const applyEditing = () => {
//     if (!editingEnabled.checked) {
//       map.disableDrawEditing();
//       pushLog('editing: off');
//       return;
//     }
//     map.enableDrawEditing({
//       showVertices: true,
//       showVerticesPersistent: verticesPersistent.checked,
//       vertexStyle: { strokeColor: '#1976d2', strokeWidth: 2, fillColor: '#fff', pointRadius: 5 },
//     });
//     pushLog(`editing: on (persistent=${verticesPersistent.checked})`);
//   };
//   editingEnabled.addEventListener('change', applyEditing);
//   verticesPersistent.addEventListener('change', applyEditing);
//   applyEditing();

//   // --- selection
//   const layerSelect = $('selectLayer') as HTMLSelectElement;
//   const idInput = $('selectId') as HTMLInputElement;
//   const selectApply = $('selectApply') as HTMLButtonElement;
//   const selectClear = $('selectClear') as HTMLButtonElement;

//   layerSelect.innerHTML = overlayLayerIds
//     .map((id) => `<option value="${id}">${id}</option>`)
//     .join('');

//   selectApply.addEventListener('click', () => {
//     const layerId = layerSelect.value;
//     const raw = idInput.value.trim();
//     const id = raw.match(/^\d+$/) ? Number(raw) : raw;
//     const ok = map.selectFeature(layerId, id, {
//       strokeColor: '#00c853',
//       strokeWidth: 3,
//       fillColor: 'rgba(0,200,83,0.15)',
//     });
//     pushLog(ok ? `select: ${layerId} / ${String(id)}` : `select: not found (${layerId} / ${String(id)})`);
//   });
//   selectClear.addEventListener('click', () => {
//     map.clearSelection();
//     pushLog('select: cleared');
//   });

//   // --- export / clear
//   const exportGeo = $('exportGeo') as HTMLButtonElement;
//   // const clearDraw = $('clearDraw') as HTMLButtonElement;

//   exportGeo.addEventListener('click', () => {
//     const json = map.exportDrawnGeoJSON({ pretty: true });
//     navigator.clipboard?.writeText(json).catch(() => void 0);
//     pushLog(`export: draw GeoJSON copied (${json.length} chars)`);
//   });

//   // clearDraw.addEventListener('click', () => {
//   //   map.clearDrawn();
//   //   renderFeatureList();
//   //   pushLog('draw: cleared');
//   // });

//   // --- load sample buttons
//   const load1 = $('loadSample1') as HTMLButtonElement;
//   const load2 = $('loadSample2') as HTMLButtonElement;
//   // const load3 = $('loadSample3') as HTMLButtonElement;
//   // const resetView = $('resetView') as HTMLButtonElement;

//   load1.addEventListener('click', () => {
//     const def = overlays.cluster;
//     map.removeLayer(def.id);
//     map.addLayer(def);
//     pushLog('sample: clusterPoints reloaded');
//   });
//   load2.addEventListener('click', () => {
//     const def = overlays.polygon;
//     map.removeLayer(def.id);
//     map.addLayer(def);
//     pushLog('sample: polygon reloaded');
//   });
//   // load3.addEventListener('click', () => {
//   //   const def = overlays.accuracyCircles;
//   //   map.removeLayer(def.id);
//   //   map.addLayer(def);
//   //   pushLog('sample: accuracyCircles reloaded');
//   // });
//   // resetView.addEventListener('click', () => {
//   //   map.setView({ center: [1148286.84, 7919205.03], zoom: 11 });
//   //   pushLog('view: reset');
//   // });

//   // --- react to events (to keep UI in sync)
//   map.on('draw:start', () => {
//     isDrawing = true;
//     refreshDrawButtons();
//   });
//   map.on('draw:end', () => {
//     isDrawing = false;
//     refreshDrawButtons();
//     renderFeatureList();
//   });
//   map.on('draw:cleared', () => {
//     isDrawing = false;
//     refreshDrawButtons();
//     renderFeatureList();
//   });
// }
