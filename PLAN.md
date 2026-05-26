# PLAN.md — College Campus Interactive Map

**Project:** Campus Navigator
**Version:** 1.0
**Approach:** Static Website (GPS + Photo Capture)
**Author:** Debjit Paul

---

## 1. Project Overview

Campus Navigator is a zero-backend, fully static web application that allows new students to navigate their college campus. It uses Leaflet.js for interactive mapping, browser-native GPS for real-time location detection, and lets students take a photo as a shareable confirmation of where they are.

The entire app runs in the student's browser. No server, no database, no framework. It is hosted on a free static hosting platform and can handle 500+ concurrent students without any load issues because there is nothing to overload — every student's browser works independently.

---

## 2. Goals & Non-Goals

### Goals

- Interactive, zoomable campus map with all buildings labeled
- One-tap "Where am I?" button using browser GPS
- Building detection: tell the student which building they are inside or nearest to
- Optional photo capture so students can take and share a location snapshot
- Mobile-first design optimised for phones on campus
- Total page weight under 400KB
- Deployable on GitHub Pages, Cloudflare Pages, or Netlify for free

### Non-Goals

- No indoor navigation (floor-level maps)
- No user accounts or login
- No real-time crowd data or occupancy tracking
- No server-side code of any kind
- No AI/vision-based building recognition (deferred to a future version)

---

## 3. Tech Stack

| Concern | Tool | Why |
|---|---|---|
| Map rendering | Leaflet.js v1.9 | 42KB, no API key, works with OSM tiles |
| Map tiles | OpenStreetMap | Free, no rate limit for this scale |
| Building data | GeoJSON file (local) | Hand-crafted, updated by editing a text file |
| Location detection | navigator.geolocation | Built into every browser, no key needed |
| Photo capture | HTML input[capture] | Native camera, no library needed |
| Styling | Vanilla CSS | No framework overhead |
| Scripting | Vanilla JS (ES6+) | No build step, instant deploy |
| Hosting | Cloudflare Pages | Free, global CDN, gzip auto-enabled |

---

## 4. File Structure

```
campus-navigator/
├── index.html              # Entry point — full app shell
├── style.css               # All styles
├── app.js                  # All JavaScript logic
├── data/
│   └── campus.geojson      # Building polygons + metadata
├── assets/
│   └── icons/              # Custom map marker SVGs (optional)
└── README.md
```

No build step. No package.json. Open `index.html` in a browser and it works.

---

## 5. Data Layer — campus.geojson

This is the most important file in the project. It is written once using a free browser tool and updated whenever a building changes. Each feature in the file represents one building.

### Required properties per building

| Property | Type | Example |
|---|---|---|
| `name` | string | `"CSE Block"` |
| `short_name` | string | `"CSE"` |
| `type` | string | `"academic"` |
| `floors` | number | `4` |
| `description` | string | `"Dept. of Computer Science."` |
| `departments` | array | `["CSE", "IT"]` |
| `landmark` | string | `"Red brick, blue signboard, north gate"` |

### How to create the GeoJSON file

1. Open [geojson.io](https://geojson.io) in your browser
2. Navigate to your college on the map
3. Switch to satellite view for accuracy
4. Use the polygon tool to trace each building's footprint
5. Click a polygon → Add properties (name, type, etc.)
6. When all buildings are drawn, click **Save → GeoJSON**
7. Save the file as `data/campus.geojson` in your project

This step takes 2–4 hours. Do it before writing any code.

---

## 6. Core Features — Detailed Spec

### 6.1 Map Initialisation

1. Load Leaflet.js from CDN
2. Initialize map centred on college coordinates at zoom level 17
3. Set `maxBounds` to campus boundary so users cannot pan to another city
4. Set `minZoom: 15`, `maxZoom: 19`
5. Load `campus.geojson` and render each building as a coloured polygon
6. Render a short label at the centroid of each polygon using `L.divIcon`

### 6.2 Building Polygons

Polygon colour is determined by building type:

| Type | Colour |
|---|---|
| academic | Blue `#2563EB` |
| library | Green `#16A34A` |
| admin | Gray `#6B7280` |
| canteen | Orange `#EA580C` |
| hostel | Purple `#7C3AED` |
| sports | Teal `#0D9488` |

Each polygon on click opens a popup showing: building name, type badge, departments list, description, and floor count.

### 6.3 Where Am I? (GPS Location)

1. Student taps the **Locate Me** button
2. App calls `navigator.geolocation.getCurrentPosition()`
3. Button shows a loading spinner while GPS resolves (timeout: 10s)
4. On success: a pulsing blue dot is placed at the student's coordinates with an accuracy ring
5. App runs a **ray-casting point-in-polygon** check against every building in the GeoJSON
6. **If inside a building:** bottom panel slides up — "You are in: [Building Name]"
7. **If outside all buildings:** find nearest building centroid by Haversine distance — "You are near: [Building Name] — approx. Xm away"
8. **If > 500m from campus centre:** "You appear to be off-campus"
9. Map animates (`flyTo`) to the student's location at zoom 18

### 6.4 Photo Capture (Confirmation Snapshot)

1. After location is confirmed in the bottom panel, a camera icon button appears
2. Tapping it triggers a hidden `<input type="file" accept="image/*" capture="environment">`
3. The device camera opens natively — no third-party library involved
4. On capture: photo is shown as a 160×120px thumbnail in the bottom panel
5. Below the thumbnail: "[Building Name] — [HH:MM, DD Mon YYYY]"
6. A **Share** button uses `navigator.share()` if the browser supports it
7. A **Download** button is always present as a fallback
8. The image is never uploaded. All processing is in-browser only.

### 6.5 Search

- A search input in the header filters buildings as the user types
- A dropdown shows matching building names
- Selecting a result: closes dropdown, flies map to that building, opens its popup
- Press Escape or tap outside to close the dropdown

---

## 7. Build Phases

| Phase | Name | Deliverable | Est. Time |
|---|---|---|---|
| 0 | Data prep | `campus.geojson` with all buildings drawn | 2–4 hrs |
| 1 | Map shell | Leaflet map, tiles, campus boundary, header, button | 1–2 hrs |
| 2 | Buildings | Coloured polygons, labels, popups | 2–3 hrs |
| 3 | GPS feature | Location dot, point-in-polygon, bottom panel | 2–3 hrs |
| 4 | Photo capture | Camera input, thumbnail, share/download | 1–2 hrs |
| 5 | Search | Fuzzy search bar with map flyTo | 1 hr |
| 6 | Polish & deploy | Mobile tuning, deploy to Cloudflare Pages | 1–2 hrs |

**Total estimated coding time: 8–13 hours** (after GeoJSON data is ready)

---

## 8. Performance Targets

- Total bundle size: < 400KB (including Leaflet from CDN)
- Time to interactive on 4G: < 2 seconds
- Lighthouse mobile score: > 85
- GPS response: < 3 seconds outdoors with clear signal
- Concurrent users: unlimited (static CDN, no server bottleneck)

---

## 9. Hosting & Deployment

1. Push the project folder to a GitHub repository
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) and connect the repo
3. Build command: *(leave blank — no build step)*
4. Publish directory: `/` (root)
5. Click Deploy

Every `git push` to `main` auto-deploys. HTTPS is provided free — this is required for the GPS API to work (browsers block geolocation on plain HTTP).

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| GPS inaccurate indoors | Wrong building shown | Show "nearest building + distance"; add indoor disclaimer |
| Student denies GPS permission | Locate Me fails | Show human-readable instructions to enable location |
| OSM tiles slow on slow network | Map appears blank | Loading spinner; tiles cache after first load |
| Web Share API not supported | Share button broken | Download link always present as fallback |
| GeoJSON polygon edges drift slightly | Detection wrong near building edges | Add 5m tolerance; test on-site during Phase 6 |
