# MASTER_PROMPT.md — Campus Navigator

This is the master prompt to use when starting a new Claude session to build the Campus Navigator project. Paste it verbatim as your first message after filling in the three placeholders at the bottom.

---

## How to Use

1. Open a **fresh Claude conversation**
2. Fill in all `[PLACEHOLDER]` values (see the table at the end of this file)
3. Paste the entire prompt block below as your first message
4. Claude will deliver all files in order — confirm each one before requesting the next phase

---

---

## The Prompt

*(Copy everything between the lines below)*

---

You are an expert frontend developer. Build a campus interactive map web application as a fully static website — pure HTML, CSS, and vanilla JavaScript. No frameworks, no build tools, no backend of any kind. The entire app runs in the visitor's browser.

**Project name:** Campus Navigator
**College:** [YOUR COLLEGE NAME]
**Campus centre coordinates:** [LATITUDE], [LONGITUDE]
**Approximate campus size:** [WIDTH]m wide × [HEIGHT]m tall

---

### Tech Stack

- **Leaflet.js v1.9** loaded from CDN: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` and its CSS
- **OpenStreetMap tiles** — no API key needed
- **Vanilla JavaScript (ES6+)** — no jQuery, no React, no Vue
- **Vanilla CSS** with CSS custom properties for theming
- **Building data** from `data/campus.geojson` — a local file I will provide after you generate a template

---

### Files to Create

Deliver these four files in this exact order:

1. `index.html` — complete app shell
2. `style.css` — all styles
3. `app.js` — all JavaScript logic
4. `data/campus.geojson` — starter template with 2 example buildings for me to complete

After all four files, list the exact steps to deploy to Cloudflare Pages.

---

### CSS Custom Properties

Define all colours at the top of `style.css` as custom properties:

```css
:root {
  --primary: #2563EB;
  --primary-light: #DBEAFE;
  --success: #16A34A;
  --warning: #EA580C;
  --neutral: #6B7280;
  --purple: #7C3AED;
  --teal: #0D9488;
  --surface: #FFFFFF;
  --border: #E5E7EB;
  --text-primary: #111827;
  --text-secondary: #6B7280;
}
```

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — no Google Fonts.

---

### index.html Requirements

- `<!DOCTYPE html>`, UTF-8 charset, `viewport` meta tag (width=device-width, initial-scale=1)
- Load Leaflet CSS in `<head>`
- Load Leaflet JS and then `app.js` at the bottom of `<body>` (in that order)
- Link `style.css` in `<head>`
- The HTML structure must include:

```
<body>
  <header id="app-header">
    <div id="brand"><!-- logo + title --></div>
    <input id="search-input" type="text" placeholder="Search buildings…" autocomplete="off">
    <div id="search-results" role="listbox" aria-label="Building search results"></div>
  </header>

  <div id="map"></div>

  <!-- Hidden camera input -->
  <input type="file" id="camera-input" accept="image/*" capture="environment" style="display:none">

  <!-- Bottom panel -->
  <div id="bottom-panel" aria-live="polite">
    <div id="panel-handle"></div>
    <div id="panel-content"></div>
  </div>

  <!-- Floating controls -->
  <div id="controls">
    <button id="locate-btn" aria-label="Find my location">
      <!-- crosshair SVG icon inline -->
    </button>
  </div>
</body>
```

---

### style.css Requirements

- Map fills full viewport: `#map { width: 100vw; height: 100vh; }`
- Header bar: `position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--border);`
- Bottom panel: `position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); border-radius: 16px 16px 0 0; max-height: 40vh; transform: translateY(100%); transition: transform 0.3s ease; z-index: 20;`
- Panel visible class: `.panel-visible { transform: translateY(0); }`
- Locate Me button: `position: fixed; bottom: 100px; right: 16px; width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: none; cursor: pointer; z-index: 10;`
- User location dot: pulsing animation — `@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.4); } }` applied on a 2s loop
- Locate button loading state: spinning ring animation on the button
- Locate button success state: green background for 2 seconds
- Search results dropdown: `position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; z-index: 30; max-height: 200px; overflow-y: auto;`
- Wrap all `animation` declarations inside `@media (prefers-reduced-motion: no-preference)`
- Mobile-first, with `@media (min-width: 640px)` and `@media (min-width: 1024px)` breakpoints
- On tablet (≥640px): bottom panel becomes a right side-panel (320px wide, full height)
- On desktop (≥1024px): left sidebar always visible (300px), map fills remaining width

---

### app.js Requirements

Build these five features in one file. Use comments to clearly separate each section.

#### Section 1 — Map Initialisation

```javascript
// Initialise Leaflet map
const map = L.map('map', {
  center: [LATITUDE, LONGITUDE],
  zoom: 17,
  minZoom: 15,
  maxZoom: 19,
  zoomControl: false
});

// OSM tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Campus boundary — prevents panning away
const campusBounds = L.latLngBounds(
  [LATITUDE - 0.003, LONGITUDE - 0.004],
  [LATITUDE + 0.003, LONGITUDE + 0.004]
);
map.setMaxBounds(campusBounds);
```

#### Section 2 — Buildings from GeoJSON

- `fetch('data/campus.geojson')` then `response.json()`
- Render each feature as `L.polygon` with colour from this map:
  ```javascript
  const typeColors = {
    academic: '#2563EB',
    library: '#16A34A',
    admin: '#6B7280',
    canteen: '#EA580C',
    hostel: '#7C3AED',
    sports: '#0D9488',
    other: '#9CA3AF'
  };
  ```
- Normal state: `fillOpacity: 0.3, weight: 2, opacity: 0.8`
- Hover: `fillOpacity: 0.55, weight: 3`
- On click: open `L.popup` with this HTML structure:
  ```html
  <div class="popup-content">
    <div class="popup-header">
      <span class="popup-name">{name}</span>
      <span class="popup-badge" style="background:{color}20;color:{color}">{type}</span>
    </div>
    <p class="popup-desc">{description}</p>
    <div class="popup-meta">
      <span>Floors: {floors}</span>
      {departments ? `<span>Depts: ${departments.join(' · ')}</span>` : ''}
    </div>
    <p class="popup-hint">Tap Locate Me to check if you are here</p>
  </div>
  ```
- Place a `L.divIcon` label at each polygon's centroid. Calculate centroid as the average of all coordinate pairs.
- Store all loaded GeoJSON features in a module-level array `let buildings = []` for use by the GPS feature.

#### Section 3 — GPS Location Detection

```javascript
document.getElementById('locate-btn').addEventListener('click', locateUser);

function locateUser() {
  // 1. Set button to loading state
  // 2. Call navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: 10000, enableHighAccuracy: true })
}

function onSuccess(position) {
  const { latitude, longitude, accuracy } = position.coords;

  // 3. Place/update user dot and accuracy ring on map
  // 4. Fly to location at zoom 18
  // 5. Run point-in-polygon check
  // 6. Update bottom panel
  // 7. Reset button to success state
}

function onError(error) {
  // 8. Show human-readable error in bottom panel
  // 9. Reset button to error state
}
```

**Point-in-polygon algorithm — implement ray casting:**

```javascript
function isPointInPolygon(point, polygon) {
  // point: [lat, lng]
  // polygon: array of [lat, lng] coordinate pairs
  let inside = false;
  const x = point[1], y = point[0]; // use lng as x, lat as y
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

**Haversine distance (for nearest-building fallback):**

```javascript
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Bottom panel content for each GPS state:**

```javascript
// Inside a building
showPanel(`
  <p class="panel-label">You are in</p>
  <h2 class="panel-building">${building.name}</h2>
  <p class="panel-sub">GPS confirmed</p>
  <button id="camera-btn" aria-label="Take a photo">📷</button>
`, 'success');

// Near a building
showPanel(`
  <p class="panel-label">You are near</p>
  <h2 class="panel-building">${nearest.name}</h2>
  <p class="panel-sub">approx. ${Math.round(distance)}m away</p>
  <button id="camera-btn" aria-label="Take a photo">📷</button>
`, 'primary');

// Off-campus
showPanel(`
  <p class="panel-building">You appear to be off-campus</p>
  <p class="panel-sub">Make sure you are inside college grounds.</p>
`, 'error');

// GPS permission denied
showPanel(`
  <p class="panel-building">Location access denied</p>
  <p class="panel-sub">Go to browser settings → Site permissions → Location → Allow.</p>
`, 'error');

// GPS timeout
showPanel(`
  <p class="panel-building">Could not get your location</p>
  <p class="panel-sub">Try stepping outdoors and tapping again.</p>
`, 'error');
```

The `showPanel(html, state)` function sets the panel content, applies a `data-state` attribute (which CSS uses to set the top border colour), and adds the `panel-visible` class.

#### Section 4 — Photo Capture

```javascript
// After showPanel(), attach camera button listener
document.getElementById('camera-btn')?.addEventListener('click', () => {
  document.getElementById('camera-input').click();
});

document.getElementById('camera-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const timestamp = new Date().toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // Append photo preview to panel content
    const preview = document.createElement('div');
    preview.className = 'photo-preview';
    preview.innerHTML = `
      <img src="${dataUrl}" alt="Location photo" class="photo-thumb">
      <p class="photo-caption">${currentBuilding} — ${timestamp}</p>
      <div class="photo-actions">
        ${navigator.share ? '<button id="share-btn">Share ↗</button>' : ''}
        <a id="download-btn" href="${dataUrl}" download="campus-location.jpg">Download ↓</a>
      </div>
    `;
    document.getElementById('panel-content').appendChild(preview);

    // Share button
    document.getElementById('share-btn')?.addEventListener('click', () => {
      fetch(dataUrl).then(r => r.blob()).then(blob => {
        const shareFile = new File([blob], 'campus-location.jpg', { type: 'image/jpeg' });
        navigator.share({ files: [shareFile], title: `I am at ${currentBuilding}` });
      });
    });
  };
  reader.readAsDataURL(file);
  e.target.value = ''; // reset so the same file can be selected again
});
```

#### Section 5 — Search

```javascript
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  searchResults.innerHTML = '';
  if (!query) return;

  const matches = buildings.filter(b =>
    b.properties.name.toLowerCase().includes(query) ||
    b.properties.short_name.toLowerCase().includes(query)
  );

  matches.slice(0, 6).forEach(b => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.setAttribute('role', 'option');
    item.textContent = b.properties.name;
    item.addEventListener('click', () => {
      map.flyTo(b.centroid, 18);
      b.layer.openPopup();
      searchInput.value = '';
      searchResults.innerHTML = '';
    });
    searchResults.appendChild(item);
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#app-header')) searchResults.innerHTML = '';
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { searchResults.innerHTML = ''; searchInput.blur(); }
});
```

---

### GeoJSON Template

Generate `data/campus.geojson` with this exact structure. Use placeholder coordinates close to `[LATITUDE], [LONGITUDE]` for the two example buildings:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "CSE Block",
        "short_name": "CSE",
        "type": "academic",
        "floors": 4,
        "description": "Department of Computer Science and Engineering. Houses labs, classrooms, and faculty offices.",
        "departments": ["CSE", "IT"],
        "landmark": "Red brick building with large blue signboard, located near the north gate"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [LONGITUDE + 0.0002, LATITUDE + 0.0002],
          [LONGITUDE + 0.0005, LATITUDE + 0.0002],
          [LONGITUDE + 0.0005, LATITUDE - 0.0001],
          [LONGITUDE + 0.0002, LATITUDE - 0.0001],
          [LONGITUDE + 0.0002, LATITUDE + 0.0002]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Main Library",
        "short_name": "Library",
        "type": "library",
        "floors": 3,
        "description": "Central library with reading halls, digital resources, and a printing section.",
        "departments": [],
        "landmark": "Glass facade building adjacent to the main gate with a blue Nila Library sign"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [LONGITUDE - 0.0003, LATITUDE + 0.0003],
          [LONGITUDE - 0.0001, LATITUDE + 0.0003],
          [LONGITUDE - 0.0001, LATITUDE + 0.0001],
          [LONGITUDE - 0.0003, LATITUDE + 0.0001],
          [LONGITUDE - 0.0003, LATITUDE + 0.0003]
        ]]
      }
    }
  ]
}
```

---

### Definition of Done

The project is complete when:

- [ ] `index.html` opens in Chrome Mobile without any console errors
- [ ] The map loads, shows campus tiles, and cannot be panned off-campus
- [ ] All buildings from `campus.geojson` appear as coloured polygons with labels
- [ ] Tapping a polygon opens a popup with full building details
- [ ] Tapping Locate Me shows a loading state, then places a dot and shows the bottom panel
- [ ] The bottom panel correctly says "You are in" or "You are near" based on GPS
- [ ] The camera button opens the device camera; the photo appears in the panel
- [ ] The Share/Download buttons work
- [ ] The search bar filters buildings and flying to a result works
- [ ] The app works on a real phone (test on Android Chrome and iPhone Safari)
- [ ] Deployed to Cloudflare Pages with HTTPS

---

Start with `index.html`. Deliver the complete file, then wait for my confirmation before moving to `style.css`.

---

---

## Placeholders to Fill Before Sending

| Placeholder | How to get the value |
|---|---|
| `[YOUR COLLEGE NAME]` | Type your college's full official name |
| `[LATITUDE], [LONGITUDE]` | Open Google Maps → right-click campus centre → "Copy coordinates" |
| `[WIDTH]m × [HEIGHT]m` | Rough estimate (e.g. `400m wide × 300m tall`) |

---

## After the Code Is Generated

1. Open [geojson.io](https://geojson.io) in your browser
2. Navigate to your college, switch to satellite view
3. Use the polygon tool to trace every building's footprint
4. For each polygon, add properties: `name`, `short_name`, `type`, `floors`, `description`, `departments`, `landmark`
5. Click **Save → GeoJSON** and save as `data/campus.geojson`
6. Open `index.html` locally in Chrome to test
7. Push to GitHub → connect to Cloudflare Pages → done

---

## Iterative Follow-Up Prompts

Use these in the same session after the initial code is delivered.

**To fix GPS detection for a specific building:**
> "The GPS says I am near [Building X] but I am actually inside [Building Y]. Paste my current `campus.geojson` here: [paste]. Please check whether the polygon coordinates for [Building Y] are correct and suggest adjustments."

**To add a new building after deployment:**
> "Add this building to `campus.geojson`. Name: [Name], short_name: [Short], type: [type], floors: [N], description: [text], coordinates from geojson.io: [paste the coordinates array]."

**To add a collapsible panel handle:**
> "The bottom panel should be collapsible. Add a drag handle at the top — tapping it toggles between a compact peek state (80px tall, shows only the building name) and the full expanded state."

**To improve map marker readability:**
> "The building short-name labels are hard to read at zoom 17 when many buildings are close together. Hide labels for buildings whose polygons are smaller than 1000 square metres at the current zoom level."
