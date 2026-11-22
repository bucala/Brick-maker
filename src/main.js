import '@fontsource-variable/inter';
import '@fontsource-variable/roboto';
import '@fontsource/ibm-plex-mono/400.css';
import './style.css';
import './material-dark.css';
import commandDivider from './assets/fluent/command-divider.svg?no-inline';
import { icons } from './icons.js';
import { bounds, GRID, key, rectangle, technicRuns } from './footprint.js';
import { allowsExtraConnections, beamGeometry, categories, defaults, getCategory, isBeam } from './settings.js';
import { createViewport } from './viewport.js';

const panels = {
  footprint: 'Pôdorys',
  height: 'Výška dielca',
  connections: 'Prepojenia',
  print: 'Príprava na tlač',
};
const brickTops = [['solid', 'Plné study'], ['hollow', 'Duté study'], ['tile', 'Hladký diel (tile)']];
const iconButton = (id, icon, label) => `<button type="button" id="${id}" class="icon-button" title="${label}" aria-label="${label}">${icons[icon]}</button>`;
const toggle = (name, label, pressed = false) => `<button type="button" data-value="${name}" aria-pressed="${pressed}">${label}</button>`;
const option = (value, text) => `<option value="${value}">${text}</option>`;
const field = (id, label, options) => `<label class="field" for="${id}"><span>${label}</span><select id="${id}">${options.map(([value, text]) => option(value, text)).join('')}</select></label>`;
const dimension = (id, label, value) => `<label class="field" for="${id}"><span>${label} <small>(mod.)</small></span><input id="${id}" type="number" min="1" max="${GRID}" value="${value}"></label>`;

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <div class="identity">
      <span class="brand-icon">${icons.boxes}</span>
      <span class="brand">BrickCAD</span>
    </div>
  </header>
  <main class="workspace">
    <div class="commandbar">
      <div class="stage-name">${icons.orbit}<h1 id="stage-title">3D náhľad</h1></div>
      <div class="stage-actions" role="group" aria-label="Ovládanie náhľadu">
        <div class="segments view-modes" id="quality" role="group" aria-label="Kvalita náhľadu">
          ${toggle('quick', icons.zap + '<span>Rýchly</span>')}
          ${toggle('detail', icons.box + '<span>Detailný</span>', true)}
        </div>
        <img class="toolbar-divider" src="${commandDivider}" alt="" width="4" height="40">
        ${iconButton('section', 'slice', 'Rez dielcom')}
        ${iconButton('measure', 'ruler', 'Zobraziť rozmery')}
        ${iconButton('fit', 'fit', 'Prispôsobiť pohľad')}
      </div>
      <div class="export-wrap">
        <button type="button" id="export" class="primary" aria-expanded="false" aria-controls="formats" disabled>${icons.download}<span>Exportovať</span>${icons.chevron}</button>
        <div class="export-menu" id="formats" hidden>
          <button type="button" data-format="stl">${icons.file}<span><strong>STL</strong><small>Binárna sieť pre 3D tlač</small></span></button>
          <button type="button" data-format="step">${icons.box}<span><strong>STEP</strong><small>Editovateľné CAD teleso</small></span></button>
          <button type="button" data-format="3mf">${icons.layers}<span><strong>3MF</strong><small>Sieť s jednotkami v mm</small></span></button>
        </div>
      </div>
    </div>
    <section class="stage" aria-labelledby="stage-title">
      <div class="view">
        <div id="canvas-host"></div>
        <div class="view-badge" id="orientation">PERSPEKTÍVA</div>
        <div class="view-angles">
          <button type="button" id="angle" aria-expanded="false" aria-controls="angle-menu" title="Zmeniť pohľad" aria-label="Zmeniť pohľad">
            <span class="axis-origin"></span><i data-axis="0"><b>X</b></i><i data-axis="1"><b>Y</b></i><i data-axis="2"><b>Z</b></i>
          </button>
          <div id="angle-menu" class="angle-menu" hidden>
            <button data-view="iso">Perspektíva</button><button data-view="top">Zhora</button><button data-view="bottom">Zdola</button>
            <button data-view="front">Spredu</button><button data-view="side">Zboku</button>
          </div>
        </div>
        <div class="cut-control" id="cut-control" hidden>
          <label for="cut-axis">Os rezu</label><select id="cut-axis"><option>x</option><option>y</option><option>z</option></select>
          <input type="range" id="cut-position" min="0.04" max="0.96" step="0.01" value="0.5" aria-label="Poloha rezu">
        </div>
        <div id="stage-message" class="stage-message" role="status">Pripravuje sa CAD jadro…</div>
        <div class="viewport-bottom">
          <div class="measurements" id="measurements">
            <div class="measure-title">${icons.ruler}<span>Rozmery dielca</span></div>
            <strong id="size">—</strong><span id="module-size"></span>
          </div>
          <div class="gesture">${icons.mouse}<span>Ťahaj pre otočenie · Koliesko pre priblíženie</span></div>
        </div>
      </div>
      <div class="statusbar">
        <span id="status" role="status"><i></i> Výpočet geometrie…</span>
        <span class="status-right"><span id="stage-category"></span><span aria-hidden="true">·</span><span id="stage-mode">Referenčné</span></span>
      </div>
    </section>

    <aside class="sidebar" aria-labelledby="config-title">
      <div class="sidebar-header">
        <h2 id="config-title">Konfigurátor</h2>
        ${field('config-section', 'Sekcia', Object.entries(panels))}
      </div>
      <fieldset class="category-field" aria-describedby="category-note">
        <legend>Typ dielca</legend>
        <div id="category-options" class="category-options">
          ${Object.entries(categories).map(([id, category]) => `
            <label class="category-choice">
              <input type="radio" name="brick-category" value="${id}"${id === defaults.category ? ' checked' : ''}>
              <span>${category.title}</span>
            </label>
          `).join('')}
        </div>
        <p id="category-note" class="field-note"><strong id="category-pitch"></strong> <span id="category-description"></span></p>
        <div class="category-shape" id="technical-shape-field" hidden>
          ${field('technical-shape', 'Tvar dielca', [['beam', 'Zaoblený nosník'], ['brick', 'Kocka s otvormi']])}
        </div>
      </fieldset>
      <section class="panel" id="footprint" aria-label="${panels.footprint}">
        <div id="beam-footprint" hidden>${dimension('beam-length', 'Dĺžka nosníka', 5)}</div>
        <div id="brick-footprint">
        <div class="segments full" id="shape-mode" role="group" aria-label="Režim pôdorysu">
          ${toggle('rectangle', 'Obdĺžnik', true)}${toggle('custom', 'Vlastný tvar')}
        </div>
        <div class="fields two" id="dimensions">${dimension('width', 'Šírka X', 4)}${dimension('depth', 'Hĺbka Y', 2)}</div>
        <div class="grid-head"><span id="grid-label">Mriežka 16 × 16</span><span id="cell-count">8 buniek</span></div>
        <div class="grid-frame">
          <span class="grid-y">Y</span><span class="grid-x">X</span>
          <div id="cell-grid" class="cell-grid" aria-label="Pôdorysná mriežka" role="group"></div>
        </div>
        <div class="custom-tools" id="custom-tools" hidden>
          <button type="button" data-grid="fill">Vyplniť</button><button type="button" data-grid="clear">Vymazať</button>
          <button type="button" data-grid="mirror-x">Zrkadliť X</button><button type="button" data-grid="mirror-y">Zrkadliť Y</button>
        </div>
        <button type="button" id="edit-studs" class="text-button" aria-pressed="false">${icons.grid} <span>Upraviť jednotlivé study</span></button>
        </div>
      </section>
      <section class="panel" id="height" aria-label="${panels.height}" hidden>
        <p class="field-note" id="beam-height" hidden>Hrúbka zaobleného nosníka je ${beamGeometry.thickness} mm.</p>
        <div id="brick-height">
        <div class="height-row">
          <div class="stepper">${iconButton('plate-minus', 'minus', 'Ubrať platničku')}<output id="plate-number" for="plate-range">3</output>${iconButton('plate-plus', 'plus', 'Pridať platničku')}</div>
          <span>platničky</span><strong id="body-height">9,6 mm</strong>
        </div>
        <input type="range" id="plate-range" min="1" max="24" value="3" aria-label="Počet platničiek">
        </div>
      </section>
      <section class="panel" id="connections" aria-label="${panels.connections}" hidden>
        <div class="fields">
          <div class="fields" id="brick-topology">
            ${field('top', 'Horný povrch', brickTops)}
            ${field('slope', 'Šikmina', [['flat', 'Bez sklonu'], ['33', '33°'], ['45', '45°'], ['reverse', 'Obrátená 45°']])}
          </div>
          <div id="extra-connections" class="fields">
            ${field('technic', 'Priechodný spoj', [['none', 'Bez otvorov'], ['pin', 'Okrúhly otvor pre kolík'], ['axle', 'Krížový otvor pre osku']])}
            <div id="technic-axis" hidden>${field('axis', 'Smer otvorov', [['auto', 'Automaticky'], ['y', 'Pozdĺž osi Y'], ['x', 'Pozdĺž osi X']])}</div>
            <div id="side-connections" class="fields">
              ${field('snot', 'Bočné spoje', [['none', 'Bez bočných spojov'], ['stud', 'Bočné study'], ['recess', 'Bočné priehlbiny']])}
              <div id="snot-side" hidden>${field('side', 'Strana', [['south', 'Predná (−Y)'], ['north', 'Zadná (+Y)'], ['east', 'Pravá (+X)'], ['west', 'Ľavá (−X)']])}</div>
            </div>
          </div>
          <p class="field-note" id="connection-note" hidden></p>
          <details class="beam-alignment" id="beam-alignment" hidden>
            <summary>Zarovnanie pri 90°</summary>
            <p class="field-note">Pri zvislom uložení nosníka najprv zarovnaj os prvého otvoru. Výšky v tabuľke sa počítajú od tejto osi.</p>
            <table aria-label="Zarovnanie otvorov s platničkami">
              <thead><tr><th scope="col">Otvor</th><th scope="col">Platničky</th><th scope="col">Výška</th></tr></thead>
              <tbody id="beam-alignment-rows"></tbody>
            </table>
          </details>
        </div>
      </section>
      <section class="panel" id="print" aria-label="${panels.print}" hidden>
        <div class="segments full" id="print-mode" role="group" aria-label="Kompenzácia tlače">
          ${toggle('reference', 'Referenčné', true)}${toggle('fdm', 'Pre 3D tlač')}
        </div>
        <div id="fdm-fields" class="fields" hidden>
          ${field('nozzle', 'Priemer trysky', [[0.4, '0,4 mm'], [0.2, '0,2 mm'], [0.6, '0,6 mm']])}
          <label class="switch" id="bridge-field"><input type="checkbox" role="switch" id="bridging"><span class="switch-track" aria-hidden="true"></span>Kónický nábeh k rúrkam</label>
        </div>
        <div class="range-header"><label for="clutch">Sila zovretia</label><output id="clutch-value" for="clutch">0,00 mm</output></div>
        <input type="range" id="clutch" min="-0.15" max="0.15" step="0.01" value="0">
        <div class="range-labels"><span>Voľnejšie</span><span>Pevnejšie</span></div>
      </section>
    </aside>
  </main>
`;

const $ = id => document.getElementById(id);
const sectionSelect = $('config-section');
sectionSelect.addEventListener('change', () => {
  for (const id of Object.keys(panels)) $(id).hidden = id !== sectionSelect.value;
});

const number = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 });
const twoDecimals = new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const params = structuredClone(defaults);
params.cells = centeredRectangle(4, 2);
params.technicalShape = 'beam';
params.beamLength = 5;
const categoryPassages = Object.fromEntries(Object.entries(categories).map(([id, category]) => [id, category.defaultPassage ?? 'none']));
categoryPassages.beam = 'pin';
const categoryTops = Object.fromEntries(Object.entries(categories).map(([id, category]) => [id, category.defaultTop]));
const passageKey = () => isBeam(params) ? 'beam' : params.category;
let quality = 'detail';
let shapeMode = 'rectangle';
let editingStuds = false;
let sectionOpen = false;
let revision = 0;
let active;
let pending;
let timer;
let viewport;
let workerFailed = false;

function centeredRectangle(width, depth) {
  return rectangle(width, depth, Math.floor((GRID - width) / 2), Math.floor((GRID - depth) / 2));
}

function setStatus(message, state = '') {
  $('status').className = state;
  $('status').replaceChildren(document.createElement('i'), document.createTextNode(message));
}

function notice(message, isError = false) {
  $('stage-message').textContent = message;
  $('stage-message').classList.toggle('error', isError);
  $('stage-message').hidden = !message;
}

const worker = new Worker(new URL('./cad.worker.js', import.meta.url), { type: 'module' });

try {
  viewport = createViewport($('canvas-host'), vectors => {
    vectors.forEach(([x, y], i) => {
      const axis = document.querySelector(`[data-axis="${i}"]`);
      const angle = Math.atan2(y, x);
      axis.style.width = `${Math.hypot(x, y) * 24}px`;
      axis.style.transform = `rotate(${angle}rad)`;
      axis.firstElementChild.style.transform = `rotate(${-angle}rad)`;
    });
  });
} catch {
  notice('3D náhľad vyžaduje WebGL 2. Export CAD zostáva dostupný.', true);
}

function flush() {
  if (active || workerFailed || !pending) return;
  active = pending;
  pending = null;
  worker.postMessage(active);
}

function schedule(delay = 110) {
  revision++;
  pending = null;
  clearTimeout(timer);
  $('export').disabled = true;
  hideMenu('export', 'formats');
  if (!isBeam(params) && !params.cells.length) {
    viewport?.clear();
    $('size').textContent = '—';
    $('module-size').textContent = 'Prázdny pôdorys';
    notice('Nakresli pôdorys v mriežke.');
    setStatus('Prázdny pôdorys');
    return;
  }
  setStatus('Výpočet geometrie…', 'working');
  if (workerFailed) return;
  timer = setTimeout(() => {
    pending = { id: revision, params: structuredClone(params), quality };
    flush();
  }, delay);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function filename(params, format) {
  if (isBeam(params)) return `brick-technicka-nosnik-${params.beamLength}m.${format}`;
  const { width, depth } = bounds(params.cells);
  const { filenameSuffix } = getCategory(params.category);
  return `brick${filenameSuffix}-${width}x${depth}-${params.plates}p.${format}`;
}

worker.onmessage = ({ data }) => {
  const request = active;
  active = null;
  if (data.format) {
    if (data.error) {
      notice(`Export zlyhal. ${data.error}`, true);
      if (data.id === revision) setStatus('Export zlyhal', 'error');
    } else {
      download(data.blob, filename(request.params, data.format));
      if (data.id === revision) setStatus(`Export ${data.format.toUpperCase()} pripravený`, 'ready');
    }
    if (data.id === revision) $('export').disabled = false;
  } else if (data.id === revision) {
    if (data.error) {
      viewport?.clear();
      $('size').textContent = '—';
      notice(data.error, true);
      setStatus('Chyba geometrie', 'error');
    } else {
      const { pitch, plateHeight } = getCategory(params.category).geometry;
      viewport?.setModel(data, pitch);
      updateSection();
      const [min, max] = data.limits;
      $('size').textContent = max.map((value, i) => number.format(value - min[i])).join(' × ') + ' mm';
      if (isBeam(params)) {
        $('module-size').textContent = `${params.beamLength} mod. · zaoblený nosník`;
      } else {
        const { width, depth } = bounds(params.cells);
        $('module-size').textContent = `${width} × ${depth} mod. · ${params.plates} × ${number.format(plateHeight)} mm`;
      }
      if (viewport) notice('');
      setStatus('Geometria pripravená', 'ready');
      $('export').disabled = false;
    }
  }
  flush();
};

worker.onerror = () => {
  workerFailed = true;
  active = null;
  $('export').disabled = true;
  notice('CAD jadro sa nepodarilo spustiť. Skús obnoviť stránku.', true);
  setStatus('Chyba CAD jadra', 'error');
};

function hideMenu(button, menu) {
  $(button).setAttribute('aria-expanded', 'false');
  $(menu).hidden = true;
}

function menu(button, list) {
  $(button).addEventListener('click', () => {
    const open = $(list).hidden;
    $(list).hidden = !open;
    $(button).setAttribute('aria-expanded', String(open));
    if (open) $(list).querySelector('button')?.focus();
  });
  document.addEventListener('click', event => {
    if (!$(button).contains(event.target) && !$(list).contains(event.target)) hideMenu(button, list);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$(list).hidden) {
      hideMenu(button, list);
      $(button).focus();
    }
  });
  $(list).addEventListener('keydown', event => {
    const items = [...$(list).querySelectorAll('button')];
    const index = items.indexOf(event.target);
    const next = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    items[next].focus();
  });
}

menu('export', 'formats');
menu('angle', 'angle-menu');

$('formats').addEventListener('click', event => {
  const button = event.target.closest('[data-format]');
  if (!button || active || (!isBeam(params) && !params.cells.length)) return;
  const { format } = button.dataset;
  hideMenu('export', 'formats');
  $('export').disabled = true;
  setStatus(`Export ${format.toUpperCase()}…`, 'working');
  pending = { id: revision, params: structuredClone(params), quality, format };
  flush();
});

$('angle-menu').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  viewport?.fit(button.dataset.view);
  $('orientation').textContent = button.textContent.toLocaleUpperCase('sk');
  hideMenu('angle', 'angle-menu');
  $('angle').focus();
});

$('fit').addEventListener('click', () => {
  viewport?.fit();
  $('orientation').textContent = 'PERSPEKTÍVA';
});

$('measure').setAttribute('aria-pressed', 'true');
$('measure').addEventListener('click', () => {
  $('measurements').hidden = !$('measurements').hidden;
  $('measure').setAttribute('aria-pressed', String(!$('measurements').hidden));
});

function updateSection() {
  viewport?.setSection(sectionOpen ? $('cut-axis').value : null, Number($('cut-position').value));
}

$('section').setAttribute('aria-pressed', 'false');
$('section').addEventListener('click', () => {
  sectionOpen = !sectionOpen;
  $('section').setAttribute('aria-pressed', String(sectionOpen));
  $('cut-control').hidden = !sectionOpen;
  updateSection();
});
$('cut-axis').addEventListener('change', updateSection);
$('cut-position').addEventListener('input', updateSection);

function segments(id, callback) {
  $(id).addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    for (const sibling of $(id).children) sibling.setAttribute('aria-pressed', String(sibling === button));
    callback(button.dataset.value);
  });
}

segments('quality', value => { quality = value; schedule(); });
segments('print-mode', value => {
  params.mode = value;
  $('fdm-fields').hidden = value !== 'fdm';
  $('stage-mode').textContent = value === 'fdm' ? 'FDM' : 'Referenčné';
  schedule();
});

const grid = $('cell-grid');
const gridButtons = rectangle(GRID, GRID).map(([x, y], index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.x = x;
  button.dataset.y = y;
  button.tabIndex = index === 0 ? 0 : -1;
  button.setAttribute('aria-label', `Bunka X ${x + 1}, Y ${y + 1}`);
  grid.appendChild(button);
  return button;
});

function renderGrid() {
  const filled = new Set(params.cells.map(cell => key(...cell)));
  const disabled = new Set(params.disabled);
  if (params.top === 'tile') editingStuds = false;
  const canEdit = shapeMode === 'custom' || editingStuds;
  grid.classList.toggle('editable', canEdit);
  grid.classList.toggle('stud-mode', editingStuds);
  grid.setAttribute('aria-label', editingStuds ? 'Zapnutie jednotlivých studov' : 'Pôdorysná mriežka');
  for (const button of gridButtons) {
    const pos = key(button.dataset.x, button.dataset.y);
    const marked = filled.has(pos);
    button.classList.toggle('filled', marked);
    button.classList.toggle('stud-off', disabled.has(pos));
    button.setAttribute('aria-pressed', String(editingStuds ? marked && !disabled.has(pos) : marked));
    button.setAttribute('aria-disabled', String(!canEdit || (editingStuds && !marked)));
  }
  $('edit-studs').disabled = params.top === 'tile' || !filled.size;
  $('edit-studs').setAttribute('aria-pressed', String(editingStuds));
  $('edit-studs').querySelector('span').textContent = editingStuds ? 'Dokončiť úpravu studov' : 'Upraviť jednotlivé study';
  const length = params.cells.length;
  $('cell-count').textContent = `${length} ${length === 1 ? 'bunka' : length >= 2 && length <= 4 ? 'bunky' : 'buniek'}`;
}

function setCells(cells, disabled = params.disabled) {
  params.cells = cells;
  const filled = new Set(cells.map(cell => key(...cell)));
  params.disabled = disabled.filter(pos => filled.has(pos));
  if (!cells.length) editingStuds = false;
  renderGrid();
  updateOptions();
  schedule();
}

function updateRectangle() {
  const dims = ['width', 'depth'].map(id => {
    const value = Math.round($(id).valueAsNumber) || 1;
    $(id).value = Math.min(GRID, Math.max(1, value));
    return Number($(id).value);
  });
  setCells(centeredRectangle(...dims));
}

segments('shape-mode', value => {
  shapeMode = value;
  editingStuds = false;
  $('dimensions').hidden = value === 'custom';
  $('custom-tools').hidden = value !== 'custom';
  if (value === 'rectangle') updateRectangle();
  else renderGrid();
});

for (const id of ['width', 'depth']) $(id).addEventListener('change', updateRectangle);

$('edit-studs').addEventListener('click', () => {
  editingStuds = !editingStuds;
  renderGrid();
  if (editingStuds) focusCell(gridButtons.find(button => button.classList.contains('filled')));
});

function paint(button, enabled) {
  const { x, y } = button.dataset;
  const pos = key(x, y);
  const occupied = button.classList.contains('filled');
  if (editingStuds) {
    if (!occupied || enabled === !button.classList.contains('stud-off')) return;
    const disabled = new Set(params.disabled);
    if (enabled) disabled.delete(pos);
    else disabled.add(pos);
    params.disabled = [...disabled];
    renderGrid();
    schedule();
  } else if (shapeMode === 'custom' && enabled !== occupied) {
    setCells(enabled
      ? [...params.cells, [Number(x), Number(y)]]
      : params.cells.filter(cell => key(...cell) !== pos));
  }
}

function focusCell(button, focus = true) {
  const previous = grid.querySelector('[tabindex="0"]');
  if (previous) previous.tabIndex = -1;
  button.tabIndex = 0;
  if (focus) button.focus({ preventScroll: true });
}

const marked = button => editingStuds ? !button.classList.contains('stud-off') : button.classList.contains('filled');
let stroke;
grid.addEventListener('pointerdown', event => {
  const button = event.target.closest('button');
  if (!button || button.getAttribute('aria-disabled') === 'true' || event.button !== 0) return;
  event.preventDefault();
  stroke = { enabled: !marked(button), pointer: event.pointerId };
  grid.setPointerCapture(event.pointerId);
  focusCell(button);
  paint(button, stroke.enabled);
});
grid.addEventListener('pointermove', event => {
  if (!stroke || stroke.pointer !== event.pointerId) return;
  const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('button');
  if (button && grid.contains(button)) paint(button, stroke.enabled);
});
grid.addEventListener('lostpointercapture', () => { stroke = null; });

grid.addEventListener('keydown', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const step = steps[event.key];
  if (!step) return;
  event.preventDefault();
  const x = Number(button.dataset.x) + step[0];
  const y = Number(button.dataset.y) + step[1];
  if (x >= 0 && x < GRID && y >= 0 && y < GRID) focusCell(gridButtons[x + GRID * y]);
});
grid.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (event.detail === 0 && button?.getAttribute('aria-disabled') === 'false') paint(button, !marked(button));
});

$('custom-tools').addEventListener('click', event => {
  const action = event.target.closest('[data-grid]')?.dataset.grid;
  if (action === 'fill') setCells(rectangle(GRID, GRID));
  if (action === 'clear') setCells([]);
  if (action?.startsWith('mirror')) {
    const reflect = ([x, y]) => action === 'mirror-x' ? [GRID - 1 - x, y] : [x, GRID - 1 - y];
    setCells(params.cells.map(reflect), params.disabled.map(pos => key(...reflect(pos.split(',').map(Number)))));
  }
});

function updateOptions() {
  const beam = isBeam(params);
  const beamHasHoles = beam && params.technic !== 'none';
  const hasExtraConnections = !beam && getCategory(params.category).defaultPassage !== null;
  const available = allowsExtraConnections(params);
  $('extra-connections').hidden = !hasExtraConnections && !beam;
  $('side-connections').hidden = beam;
  $('technic').disabled = !available && !beam;
  $('snot').disabled = !available;
  $('technic-axis').hidden = params.technic === 'none' || !available;
  $('snot-side').hidden = params.snot === 'none' || !available;
  $('bridging').disabled = params.slope !== 'flat';
  $('beam-alignment').hidden = !beamHasHoles;
  const notes = [];
  if (hasExtraConnections && !available) notes.push('Priechodné a bočné spoje vyžadujú rovnú hornú plochu a aspoň 3 platničky.');
  if (!beam && params.slope !== 'flat' && params.top !== 'tile') notes.push('Study na zlome šikminy sa vynechajú.');
  if (params.top === 'hollow-classic') {
    const diameter = getCategory(params.category).geometry.classicSocketDiameter;
    notes.push(`Horný otvor Ø ${number.format(diameter)} mm prijíma spodnú rúrku. Spodné vybrania sú určené pre study klasického dielca.`);
  }
  if (beamHasHoles) {
    notes.push(`Priechodné otvory · ${params.beamLength} · os Z`);
    const { plateHeight } = getCategory('classic').geometry;
    const rows = [];
    for (let index = 0; index < params.beamLength; index++) {
      const height = index * beamGeometry.pitch;
      const plates = Math.round(height / plateHeight);
      if (Math.abs(plates * plateHeight - height) < 1e-9) {
        rows.push(`<tr><th scope="row">${index + 1}</th><td>${plates}</td><td>${number.format(height)} mm</td></tr>`);
      }
    }
    $('beam-alignment-rows').innerHTML = rows.join('');
  } else if (available && params.technic !== 'none') {
    const { axis, runs } = technicRuns(params.cells, params.axis);
    notes.push(runs.length
      ? `Priechodné otvory · ${runs.length} · os ${axis.toUpperCase()}`
      : 'Pôdorys potrebuje v smere otvorov protiľahlé úseky stien široké aspoň dva moduly.');
  }
  $('connection-note').hidden = !notes.length;
  $('connection-note').textContent = notes.join(' ');
}

function updateBodyHeight() {
  const height = params.plates * getCategory(params.category).geometry.plateHeight;
  $('body-height').textContent = `${number.format(height)} mm`;
}

function renderCategory() {
  const category = getCategory(params.category);
  const beam = isBeam(params);
  params.technic = categoryPassages[passageKey()];
  params.top = categoryTops[params.category];
  $('stage-category').textContent = category.title;
  $('category-description').textContent = category.description;
  $('category-pitch').textContent = `Rozstup ${category.geometry.pitch} mm.`;
  $('technical-shape-field').hidden = params.category !== 'technical';
  $('beam-footprint').hidden = !beam;
  $('brick-footprint').hidden = beam;
  $('beam-height').hidden = !beam;
  $('brick-height').hidden = beam;
  $('brick-topology').hidden = beam;
  $('bridge-field').hidden = beam;
  $('technic').value = params.technic;
  const tops = category.geometry.classicSocketDiameter ? [...brickTops, ['hollow-classic', 'Spojenie s klasickými dielcami']] : brickTops;
  $('top').innerHTML = tops.map(([value, title]) => option(value, title)).join('');
  $('top').value = params.top;
  renderGrid();
  updateBodyHeight();
  updateOptions();
}

$('category-options').addEventListener('change', event => {
  params.category = event.target.value;
  renderCategory();
  schedule();
});

$('technical-shape').addEventListener('change', event => {
  params.technicalShape = event.target.value;
  renderCategory();
  schedule();
});

$('beam-length').addEventListener('change', event => {
  const input = event.target;
  params.beamLength = Math.min(GRID, Math.max(1, Math.round(input.valueAsNumber) || 1));
  input.value = params.beamLength;
  updateOptions();
  schedule();
});

function setPlates(value) {
  params.plates = value;
  $('plate-number').value = value;
  $('plate-range').value = value;
  updateRangeFill($('plate-range'));
  updateBodyHeight();
  $('plate-minus').disabled = value === 1;
  $('plate-plus').disabled = value === 24;
  updateOptions();
  schedule();
}

$('plate-minus').addEventListener('click', () => setPlates(params.plates - 1));
$('plate-plus').addEventListener('click', () => setPlates(params.plates + 1));
$('plate-range').addEventListener('input', event => setPlates(Number(event.target.value)));

for (const id of ['top', 'slope', 'technic', 'axis', 'snot', 'side', 'nozzle']) {
  $(id).addEventListener('change', event => {
    params[id] = id === 'nozzle' ? Number(event.target.value) : event.target.value;
    if (id === 'technic') categoryPassages[passageKey()] = params.technic;
    if (id === 'top') categoryTops[params.category] = params.top;
    renderGrid();
    updateOptions();
    schedule();
  });
}
$('bridging').addEventListener('change', event => { params.bridging = event.target.checked; schedule(); });
$('clutch').addEventListener('input', event => {
  params.clutch = Number(event.target.value);
  $('clutch-value').value = `${params.clutch > 0 ? '+' : ''}${twoDecimals.format(params.clutch)} mm`;
  schedule();
});

function updateRangeFill(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const percent = 100 * (input.valueAsNumber - minimum) / (maximum - minimum);
  input.style.setProperty('--fill', `${percent}%`);
}

for (const input of document.querySelectorAll('input[type="range"]')) {
  updateRangeFill(input);
  input.addEventListener('input', () => updateRangeFill(input));
}

renderCategory();
schedule(0);
