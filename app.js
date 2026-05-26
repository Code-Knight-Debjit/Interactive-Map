/* ============================================================
   Campus Navigator — app.js
   AMC Engineering College, Bangalore
   ============================================================ */

'use strict';

// ============================================================
// SECTION 1 — Map Initialisation
// ============================================================

const CAMPUS_CENTER = [12.8281, 77.5894]; // AMC Engineering College centroid
const GEOJSON_PATH  = 'data/campus.geojson';

const map = L.map('map', {
  center: CAMPUS_CENTER,
  zoom: 17,
  minZoom: 15,
  maxZoom: 19,
  zoomControl: false,
});

// OpenStreetMap tiles — no API key required
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

map.attributionControl.setPrefix(false);

// Campus boundary — prevents panning away from campus
const campusBounds = L.latLngBounds(
  [12.8228, 77.5840],
  [12.8335, 77.5950]
);
map.setMaxBounds(campusBounds);

// Add zoom control to bottom-left
L.control.zoom({ position: 'bottomleft' }).addTo(map);

// ============================================================
// SECTION 2 — Buildings from GeoJSON
// ============================================================

const typeColors = {
  academic : '#2563EB',
  library  : '#16A34A',
  admin    : '#6B7280',
  canteen  : '#EA580C',
  hostel   : '#7C3AED',
  sports   : '#0D9488',
  other    : '#9CA3AF',
};

// Module-level buildings array — used by GPS & search features
let buildings = [];

// Track the currently active (clicked) layer
let activeLayer = null;

// Campus navigation anchors used to build supermarket-style guidance routes
const MAIN_GATE = [12.82915, 77.58758];
const CAMPUS_SPINE_LNG = 77.58895;
let routeLayer = null;
let routeStartMarker = null;
let routeEndMarker = null;

/**
 * Calculate polygon centroid as average of coordinate pairs.
 * GeoJSON coords are [lng, lat] — returns Leaflet [lat, lng].
 */
function getCentroid(coordinates) {
  const ring = coordinates[0];
  let sumLat = 0, sumLng = 0;
  const n = ring.length;
  for (const [lng, lat] of ring) {
    sumLat += lat;
    sumLng += lng;
  }
  return [sumLat / n, sumLng / n];
}

/**
 * Convert GeoJSON [lng, lat] pairs to Leaflet [lat, lng] pairs.
 */
function toLLPairs(coordinates) {
  return coordinates[0].map(([lng, lat]) => [lat, lng]);
}

/**
 * Remove duplicate consecutive route points.
 */
function dedupeRoutePoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return point[0] !== previous[0] || point[1] !== previous[1];
  });
}

/**
 * Build a simple supermarket-style L-shaped guide route.
 */
function buildRoutePoints(origin, destination) {
  const entryTurn = [origin[0], CAMPUS_SPINE_LNG];
  const spineTurn = [destination[0], CAMPUS_SPINE_LNG];
  return dedupeRoutePoints([origin, entryTurn, spineTurn, destination]);
}

/**
 * Remove the currently drawn route from the map.
 */
function clearRoute() {
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
  routeStartMarker = null;
  routeEndMarker = null;
}

/**
 * Draw a route from the user's location or the main gate to a building.
 */
function drawRouteToBuilding(building) {
  const origin = userMarker ? [userMarker.getLatLng().lat, userMarker.getLatLng().lng] : MAIN_GATE;
  const points = buildRoutePoints(origin, building.centroid);

  clearRoute();

  routeLayer = L.layerGroup().addTo(map);

  const routePolyline = L.polyline(points, {
    color: '#F59E0B',
    weight: 6,
    opacity: 0.92,
    lineCap: 'round',
    lineJoin: 'round',
    dashArray: '12 10',
  }).addTo(routeLayer);

  routeStartMarker = L.circleMarker(points[0], {
    radius: 8,
    color: '#1F2937',
    weight: 2,
    fillColor: '#FFFFFF',
    fillOpacity: 1,
  }).addTo(routeLayer);

  routeEndMarker = L.circleMarker(points[points.length - 1], {
    radius: 9,
    color: '#F59E0B',
    weight: 3,
    fillColor: '#FFF7ED',
    fillOpacity: 1,
  }).addTo(routeLayer);

  map.fitBounds(routePolyline.getBounds().pad(0.18), { animate: true, duration: 0.8 });
}

/**
 * Compute a short, human-readable guide for the selected building.
 */
function buildGuideSteps(building, originLabel, distanceMetres) {
  const destinationLabel = building.properties.name;
  const approxMinutes = Math.max(1, Math.round(distanceMetres / 70));
  const landmark = building.properties.landmark || 'the destination entrance';

  return [
    `Start from ${originLabel}.`,
    `Follow the highlighted campus aisle toward the central walkway.`,
    `Turn at ${landmark} and continue to ${destinationLabel}.`,
    `Estimated walk: about ${approxMinutes} min · ${Math.round(distanceMetres)} m.`,
  ];
}

/**
 * Show the guidance panel for a selected building.
 */
function showGuidePanel(building) {
  const originLabel = userMarker ? 'your live location' : 'the main gate';
  const origin = userMarker ? [userMarker.getLatLng().lat, userMarker.getLatLng().lng] : MAIN_GATE;
  const distanceMetres = Math.round(haversineMetres(origin, building.centroid));
  const steps = buildGuideSteps(building, originLabel, distanceMetres);

  showPanel(`
    <div class="guide-shell">
      <div class="guide-head">
        <div>
          <p class="panel-label">Campus guide</p>
          <p class="panel-building">${building.properties.name}</p>
          <p class="panel-sub">${building.properties.description}</p>
        </div>
        <div class="guide-distance">${distanceMetres} m</div>
      </div>

      <div class="guide-route-note">
        <span class="route-pill">Follow the highlighted path</span>
        <span class="route-pill route-pill-muted">${originLabel}</span>
      </div>

      <div class="guide-steps">
        ${steps.map((step, index) => `
          <div class="guide-step">
            <span class="guide-step-index">${index + 1}</span>
            <p>${step}</p>
          </div>
        `).join('')}
      </div>

      <div class="guide-actions">
        <button class="guide-action-primary" id="route-btn">Show route</button>
        <button class="guide-action-secondary" id="route-clear-btn">Clear route</button>
      </div>
    </div>
  `, 'primary');

  requestAnimationFrame(() => {
    document.getElementById('route-btn')?.addEventListener('click', () => drawRouteToBuilding(building));
    document.getElementById('route-clear-btn')?.addEventListener('click', () => clearRoute());
  });
}

/**
 * Show the initial supermarket-style campus overview panel.
 */
function showWelcomePanel() {
  const featured = buildings.filter((building) => [
    'Admin Block',
    'Main Block',
    'Mechanical Block',
    'Boys Hostel',
    'Girls Hostel',
  ].includes(building.properties.name));

  showPanel(`
    <div class="guide-shell">
      <div class="guide-head">
        <div>
          <p class="panel-label">Campus map</p>
          <p class="panel-building">Choose a destination</p>
          <p class="panel-sub">Tap any building or search for it. The map will draw a route like an indoor store guide.</p>
        </div>
      </div>

      <div class="guide-route-note">
        <span class="route-pill">Main gate</span>
        <span class="route-pill route-pill-muted">Live routing</span>
      </div>

      <div class="quick-stops" aria-label="Quick destinations">
        ${featured.map((building) => `
          <button class="quick-stop" data-building="${building.properties.name}">
            <strong>${building.properties.short_name || building.properties.name}</strong>
            <span>${building.properties.type}</span>
          </button>
        `).join('')}
      </div>

      <p class="guide-footer">Search building names, open the guide, and tap <strong>Show route</strong> to see the wayfinding path.</p>
    </div>
  `, 'info');

  requestAnimationFrame(() => {
    document.querySelectorAll('.quick-stop').forEach((button) => {
      button.addEventListener('click', () => {
        const building = buildings.find((item) => item.properties.name === button.dataset.building);
        if (building) {
          focusBuilding(building);
        }
      });
    });
  });
}

/**
 * Focus the map and show guidance for a building.
 */
function focusBuilding(building) {
  map.flyTo(building.centroid, 18, { animate: true, duration: 0.8 });
  drawRouteToBuilding(building);
  showGuidePanel(building);
  setTimeout(() => building.layer.openPopup(), 700);
}

/**
 * Build popup HTML for a building feature.
 */
function buildPopupHTML(props, color) {
  const depts = props.departments && props.departments.length
    ? props.departments.join(' &middot; ')
    : null;

  return `
    <div class="popup-content">
      <div class="popup-header">
        <span class="popup-name">${props.name}</span>
        <span class="popup-badge" style="background:${color}20;color:${color}">
          ${props.type}
        </span>
      </div>
      <div class="popup-divider"></div>
      <p class="popup-desc">${props.description}</p>
      <div class="popup-meta">
        <span><strong>Floors:</strong> ${props.floors}</span>
        ${depts ? `<span><strong>Depts:</strong> ${depts}</span>` : ''}
        ${props.landmark ? `<span><strong>Find it:</strong> ${props.landmark}</span>` : ''}
      </div>
      <p class="popup-hint">Tap <strong>Locate Me</strong> to check if you are here</p>
    </div>`;
}

/**
 * Load and render all buildings from GeoJSON.
 */
async function loadBuildings() {
  let data;
  try {
    const res = await fetch(GEOJSON_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('Failed to load campus.geojson:', err);
    showPanel(`
      <p class="panel-label">Map Error</p>
      <p class="panel-building">Building data failed to load</p>
      <p class="panel-sub">Check your internet connection and reload the page.</p>
    `, 'error');
    return;
  }

  data.features.forEach((feature) => {
    const props  = feature.properties;
    const geom   = feature.geometry;

    // Skip the campus boundary outline (the "AMC Engineering College" polygon)
    // We'll render it separately as a light perimeter
    if (props.type === 'other') {
      const perimeterCoords = toLLPairs(geom.coordinates);
      L.polygon(perimeterCoords, {
        color        : '#2563EB',
        weight       : 2,
        opacity      : 0.25,
        fillColor    : '#2563EB',
        fillOpacity  : 0.04,
        dashArray    : '6 5',
        interactive  : false,
      }).addTo(map);
      return;
    }

    const color    = typeColors[props.type] || typeColors.other;
    const centroid = getCentroid(geom.coordinates);
    const llCoords = toLLPairs(geom.coordinates);
    const building = {
      properties : props,
      centroid   : centroid,
      coordinates: geom.coordinates,
      layer      : null,
      color      : color,
    };

    const layer = L.polygon(llCoords, {
      color       : color,
      weight      : 2,
      opacity     : 0.8,
      fillColor   : color,
      fillOpacity : 0.3,
    }).addTo(map);

    // Popup
    const popup = L.popup({
      maxWidth    : 270,
      className   : 'campus-popup',
      closeButton : true,
    }).setContent(buildPopupHTML(props, color));
    layer.bindPopup(popup);
    building.layer = layer;

    // Hover effects
    layer.on('mouseover', () => {
      if (layer !== activeLayer) {
        layer.setStyle({ fillOpacity: 0.55, weight: 3 });
      }
    });
    layer.on('mouseout', () => {
      if (layer !== activeLayer) {
        layer.setStyle({ fillOpacity: 0.3, weight: 2 });
      }
    });

    // Click — highlight + show info panel on mobile
    layer.on('click', () => {
      // Reset previous active
      if (activeLayer && activeLayer !== layer) {
        activeLayer.setStyle({ fillOpacity: 0.3, weight: 2, dashArray: null });
      }
      activeLayer = layer;
      layer.setStyle({ fillOpacity: 0.55, weight: 3, dashArray: '6 4' });

      showGuidePanel(building);
    });

    // divIcon label at centroid — hidden below zoom 16
    const labelIcon = L.divIcon({
      className : 'map-label',
      html      : props.short_name || props.name,
      iconSize  : null,
      iconAnchor: [0, 0],
    });

    const labelMarker = L.marker(centroid, {
      icon       : labelIcon,
      interactive: false,
      zIndexOffset: -1,
    }).addTo(map);

    // Hide label at low zoom
    map.on('zoomend', () => {
      if (map.getZoom() < 16) {
        labelMarker.setOpacity(0);
      } else {
        labelMarker.setOpacity(1);
      }
    });

    // Store for GPS + search use
    buildings.push(building);
  });

  showWelcomePanel();
}

loadBuildings();

// ============================================================
// SECTION 3 — GPS Location Detection
// ============================================================

let userMarker  = null; // pulsing dot
let accuracyCircle = null; // accuracy ring
let currentBuilding = 'Campus'; // updated when location is confirmed

const locateBtn = document.getElementById('locate-btn');

locateBtn.addEventListener('click', locateUser);

function locateUser() {
  if (!navigator.geolocation) {
    showPanel(`
      <p class="panel-label">Not supported</p>
      <p class="panel-building">Location services unavailable</p>
      <p class="panel-sub">Location services are not supported on this browser. Try Chrome or Safari.</p>
    `, 'error');
    return;
  }

  setLocateBtnState('loading');

  navigator.geolocation.getCurrentPosition(
    onLocationSuccess,
    onLocationError,
    { timeout: 10000, enableHighAccuracy: true, maximumAge: 5000 }
  );
}

function onLocationSuccess(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const latlng = L.latLng(latitude, longitude);

  // Place / update user dot
  if (userMarker) {
    map.removeLayer(userMarker);
    map.removeLayer(accuracyCircle);
  }

  // Accuracy ring
  accuracyCircle = L.circle(latlng, {
    radius      : accuracy,
    color       : '#2563EB',
    weight      : 1,
    opacity     : 0.4,
    fillColor   : '#DBEAFE',
    fillOpacity : 0.28,
    interactive : false,
  }).addTo(map);

  // Pulsing dot
  const dotIcon = L.divIcon({
    className : '',
    html      : '<div class="user-dot-wrapper"><div class="user-dot-inner"></div></div>',
    iconSize  : [14, 14],
    iconAnchor: [7, 7],
  });
  userMarker = L.marker(latlng, { icon: dotIcon, zIndexOffset: 1000 }).addTo(map);

  // Fly to location
  map.flyTo(latlng, 18, { animate: true, duration: 0.8 });

  // Determine building status
  const result = detectBuilding(latitude, longitude);

  if (result.type === 'inside') {
    currentBuilding = result.building.properties.name;
    setLocateBtnState('success');
    showLocationPanel('inside', result.building);

  } else if (result.type === 'near') {
    currentBuilding = result.building.properties.name;
    setLocateBtnState('success');
    showLocationPanel('near', result.building, result.distance);

  } else {
    currentBuilding = 'AMC Campus';
    setLocateBtnState('success');
    showPanel(`
      <p class="panel-label">Off Campus</p>
      <p class="panel-building">You appear to be off-campus</p>
      <p class="panel-sub">Make sure you are inside AMC Engineering College grounds.</p>
    `, 'error');
  }

  // Reset button after 2 seconds
  setTimeout(() => setLocateBtnState('idle'), 2000);
}

function onLocationError(error) {
  setLocateBtnState('error');
  setTimeout(() => setLocateBtnState('idle'), 2000);

  let title = 'Location Error';
  let msg   = 'Could not get your location. Please try again.';

  switch (error.code) {
    case error.PERMISSION_DENIED:
      title = 'Location access denied';
      msg   = 'Go to your browser settings → Site permissions → Location → Allow.';
      break;
    case error.TIMEOUT:
      title = 'Could not get your location';
      msg   = 'Try stepping outdoors and tapping again.';
      break;
    case error.POSITION_UNAVAILABLE:
      title = 'Location unavailable';
      msg   = 'Location services are not available on this device.';
      break;
  }

  showPanel(`
    <p class="panel-label">Error</p>
    <p class="panel-building">${title}</p>
    <p class="panel-sub">${msg}</p>
  `, 'error');
}

/**
 * Set the Locate Me button visual state.
 * @param {'idle'|'loading'|'success'|'error'} state
 */
function setLocateBtnState(state) {
  locateBtn.classList.remove('loading', 'success', 'error');
  if (state !== 'idle') locateBtn.classList.add(state);
}

// ============================================================
// Point-in-Polygon — Ray Casting Algorithm
// ============================================================

/**
 * Test if a [lat, lng] point is inside a GeoJSON polygon.
 * GeoJSON coords are [lng, lat].
 */
function isPointInPolygon(point, geoJsonCoords) {
  const [lat, lng] = point;
  const ring       = geoJsonCoords[0];
  let inside       = false;
  const n          = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i]; // xi = lng, yi = lat
    const [xj, yj] = ring[j];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Haversine distance in metres between two [lat, lng] points.
 */
function haversineMetres(a, b) {
  const R    = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat +
            Math.cos((a[0] * Math.PI) / 180) *
            Math.cos((b[0] * Math.PI) / 180) *
            sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Determine whether the user is inside a building, near one, or off-campus.
 */
function detectBuilding(lat, lng) {
  const point = [lat, lng];

  // 1. Check if inside any polygon
  for (const b of buildings) {
    if (isPointInPolygon(point, b.coordinates)) {
      return { type: 'inside', building: b };
    }
  }

  // 2. Find nearest building centroid
  let nearest = null;
  let minDist  = Infinity;

  for (const b of buildings) {
    const d = haversineMetres(point, b.centroid);
    if (d < minDist) {
      minDist  = d;
      nearest  = b;
    }
  }

  // 3. Off-campus check — > 600m from campus centre
  const distFromCentre = haversineMetres(point, CAMPUS_CENTER);
  if (distFromCentre > 600) {
    return { type: 'offcampus' };
  }

  return { type: 'near', building: nearest, distance: Math.round(minDist) };
}

// ============================================================
// Panel helpers
// ============================================================

/**
 * Show a building info panel (from polygon click, mobile only).
 */
function showBuildingInfo(props, color) {
  const depts = props.departments && props.departments.length
    ? props.departments.join(' · ')
    : '—';

  showPanel(`
    <p class="panel-label">Building Info</p>
    <p class="panel-building">${props.name}</p>
    <p class="panel-sub">${props.description}</p>
    <div class="popup-meta" style="margin-bottom:0;">
      <span><strong>Floors:</strong> ${props.floors}</span>
      <span><strong>Type:</strong> ${props.type}</span>
      ${props.departments && props.departments.length ? `<span><strong>Depts:</strong> ${depts}</span>` : ''}
    </div>
  `, 'info');
}

/**
 * Show location result panel.
 * @param {'inside'|'near'} type
 * @param {object} building
 * @param {number} [distance]
 */
function showLocationPanel(type, building, distance) {
  const label  = type === 'inside' ? 'You are in' : 'You are near';
  const state  = type === 'inside' ? 'success' : 'primary';
  const sub    = type === 'inside'
    ? `GPS confirmed · ${building.properties.floors} floor${building.properties.floors !== 1 ? 's' : ''}`
    : `Approx. ${distance}m away`;

  showPanel(`
    <div class="panel-row">
      <div>
        <p class="panel-label">${label}</p>
        <p class="panel-building">${building.properties.name}</p>
        <p class="panel-sub">${sub}</p>
      </div>
      <button id="camera-btn" aria-label="Take a location photo">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7 3H13L14.5 5H17C17.55 5 18 5.45 18 6V15C18 15.55 17.55 16 17 16H3C2.45 16 2 15.55 2 15V6C2 5.45 2.45 5 3 5H5.5L7 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="10" cy="10.5" r="2.5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
  `, state);

  // Attach camera listener after DOM update
  requestAnimationFrame(() => {
    document.getElementById('camera-btn')?.addEventListener('click', () => {
      document.getElementById('camera-input').click();
    });
  });
}

/**
 * Core panel display function.
 * @param {string} html   — innerHTML for panel content
 * @param {'success'|'primary'|'error'|'info'} state
 */
function showPanel(html, state) {
  const panel   = document.getElementById('bottom-panel');
  const content = document.getElementById('panel-content');

  content.innerHTML = html;
  panel.dataset.state = state;
  panel.classList.add('panel-visible');
}

// Close panel when tapping the map
map.on('click', () => {
  const panel = document.getElementById('bottom-panel');
  panel.classList.remove('panel-visible');
  clearRoute();
  if (activeLayer) {
    activeLayer.setStyle({ fillOpacity: 0.3, weight: 2, dashArray: null });
    activeLayer = null;
  }
});

// ============================================================
// SECTION 4 — Photo Capture
// ============================================================

document.getElementById('camera-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (ev) => {
    const dataUrl   = ev.target.result;
    const timestamp = new Date().toLocaleString('en-IN', {
      hour  : '2-digit',
      minute: '2-digit',
      day   : '2-digit',
      month : 'short',
      year  : 'numeric',
    });

    const preview = document.createElement('div');
    preview.className = 'photo-preview';

    // FIX 5: Use navigator.share (not navigator.canShare) per MASTER_PROMPT spec.
    // navigator.share is the standard Web Share API check.
    preview.innerHTML = `
      <img src="${dataUrl}" alt="Location photo" class="photo-thumb">
      <p class="photo-caption">${currentBuilding} — ${timestamp}</p>
      <div class="photo-actions">
        ${navigator.share ? '<button id="share-btn">Share ↗</button>' : ''}
        <a id="download-btn" href="${dataUrl}" download="amc-campus-${Date.now()}.jpg">Download ↓</a>
      </div>`;

    document.getElementById('panel-content').appendChild(preview);

    // Share button
    document.getElementById('share-btn')?.addEventListener('click', async () => {
      try {
        const blob = await fetch(dataUrl).then(r => r.blob());
        const shareFile = new File([blob], 'campus-location.jpg', { type: 'image/jpeg' });
        await navigator.share({
          files : [shareFile],
          title : `I am at ${currentBuilding} — AMC Engineering College`,
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
      }
    });
  };

  reader.readAsDataURL(file);
  e.target.value = ''; // Reset so same file can be re-selected
});

// ============================================================
// SECTION 5 — Search
// ============================================================

const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchClear   = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();

  // Show/hide clear button
  searchClear.style.display = query ? 'flex' : 'none';

  searchResults.innerHTML = '';

  if (!query) {
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  const matches = buildings.filter(b => {
    const name      = (b.properties.name       || '').toLowerCase();
    const shortName = (b.properties.short_name || '').toLowerCase();
    const depts     = (b.properties.departments || []).join(' ').toLowerCase();
    return name.includes(query) || shortName.includes(query) || depts.includes(query);
  });

  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-item" style="color:var(--text-secondary);cursor:default;">No buildings found</div>';
    searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  searchInput.setAttribute('aria-expanded', 'true');

  matches.slice(0, 6).forEach((b, idx) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    item.style.animationDelay = `${idx * 30}ms`;

    item.innerHTML = `
      <span style="flex:1">${b.properties.name}</span>
      <span style="font-size:11px;color:var(--text-secondary);text-transform:capitalize">${b.properties.type}</span>
    `;

    const select = () => {
      focusBuilding(b);
      searchInput.value = '';
      searchClear.style.display = 'none';
      searchResults.innerHTML  = '';
      searchInput.setAttribute('aria-expanded', 'false');
    };

    item.addEventListener('click', select);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') select();
    });

    searchResults.appendChild(item);
  });
});

// Clear button
searchClear.addEventListener('click', () => {
  searchInput.value          = '';
  searchResults.innerHTML    = '';
  searchClear.style.display  = 'none';
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.focus();
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('#app-header')) {
    searchResults.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
  }
});

// Keyboard navigation
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchResults.innerHTML = '';
    searchInput.blur();
    searchInput.setAttribute('aria-expanded', 'false');
  }

  if (e.key === 'ArrowDown') {
    const first = searchResults.querySelector('.search-item');
    if (first) first.focus();
    e.preventDefault();
  }
});

searchResults.addEventListener('keydown', (e) => {
  const items   = [...searchResults.querySelectorAll('.search-item')];
  const focused = document.activeElement;
  const idx     = items.indexOf(focused);

  if (e.key === 'ArrowDown' && idx < items.length - 1) {
    items[idx + 1].focus();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    if (idx === 0) searchInput.focus();
    else items[idx - 1].focus();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    searchResults.innerHTML = '';
    searchInput.focus();
  }
});