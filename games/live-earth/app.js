(function () {
  'use strict';
  Cesium.Ion.defaultAccessToken = undefined;

  const S = {
    labels: true, trails: true, lighting: true,
    minAlt: 1000, maxPlanes: 300, trailLen: 8,
    quality: 'medium', showFps: false
  };
  try {
    const saved = JSON.parse(localStorage.getItem('le_settings') || '{}');
    Object.assign(S, saved);
  } catch (_) {}
  function saveS() {
    try { localStorage.setItem('le_settings', JSON.stringify(S)); } catch (_) {}
  }

  const satelliteProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Tiles © Esri', maximumLevel: 19
  });

  const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    fullscreenButton: true, infoBox: false, selectionIndicator: false,
    terrainProvider: undefined, imageryProvider: false,
    skyBox: false, skyAtmosphere: new Cesium.SkyAtmosphere(),
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity
  });
  viewer.imageryLayers.removeAll();
  const satelliteLayer = viewer.imageryLayers.addImageryProvider(satelliteProvider);
  viewer.scene.globe.enableLighting = S.lighting;
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a2744');
  viewer.scene.fog.enabled = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a12');
  viewer.scene.globe.tileCacheSize = 100;
  applyQuality(S.quality);

  function applyQuality(q) {
    const s = viewer.scene;
    if (q === 'low') {
      s.fxaa = false; s.fog.enabled = false;
      s.globe.maximumScreenSpaceError = 4;
      s.globe.showGroundAtmosphere = false;
    } else if (q === 'medium') {
      s.fxaa = true; s.fog.enabled = true;
      s.globe.maximumScreenSpaceError = 2;
      s.globe.showGroundAtmosphere = true;
    } else {
      s.fxaa = true; s.fog.enabled = true;
      s.globe.maximumScreenSpaceError = 1.2;
      s.globe.showGroundAtmosphere = true;
    }
    viewer.scene.requestRender();
  }

  let osmLayer = null, radarLayer = null;
  const entityData = new Map();

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._id);
    toast._id = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function showInfo(title, sub, fields) {
    document.getElementById('icTitle').textContent = title || '—';
    document.getElementById('icSub').textContent = sub || '';
    const grid = document.getElementById('icGrid');
    grid.innerHTML = '';
    (fields || []).forEach(f => {
      const div = document.createElement('div');
      div.className = 'ic-item' + (f.full ? ' full' : '');
      div.innerHTML = '<div class="ic-k">' + f.k + '</div><div class="ic-v">' + (f.v == null || f.v === '' ? '—' : f.v) + '</div>';
      grid.appendChild(div);
    });
    document.getElementById('infoCard').classList.add('show');
  }
  function hideInfo() { document.getElementById('infoCard').classList.remove('show'); }
  document.getElementById('icClose').onclick = hideInfo;

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(function (click) {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id && picked.id.id) {
      const id = String(picked.id.id);
      const d = entityData.get(id);
      if (d) { showInfo(d.title, d.sub, d.fields); viewer.scene.requestRender(); return; }
    }
    if (document.getElementById('weatherToggle').checked) {
      const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const c = Cesium.Cartographic.fromCartesian(cartesian);
        fetchWeatherAt(Cesium.Math.toDegrees(c.latitude), Cesium.Math.toDegrees(c.longitude));
        return;
      }
    }
    hideInfo();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  viewer.camera.changed.addEventListener(() => viewer.scene.requestRender());

  function setStreetMode(on) {
    if (on) {
      if (!osmLayer) {
        osmLayer = viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', credit: '© OSM', maximumLevel: 19
        }));
      }
      osmLayer.show = true; satelliteLayer.alpha = 0.25;
      toast('Street view on');
    } else {
      if (osmLayer) osmLayer.show = false; satelliteLayer.alpha = 1;
    }
    viewer.scene.requestRender();
  }

  let airOn = false, airTimer = null;
  const planes = new Map();
  const NM_TO_DEG_LAT = 1 / 60;

  function setDot(id, state) {
    const d = document.getElementById(id);
    if (d) d.className = 'status-dot' + (state ? ' ' + state : '');
  }

  function clearPlanes() {
    for (const p of planes.values()) {
      if (p.ent) viewer.entities.remove(p.ent);
      if (p.trail) viewer.entities.remove(p.trail);
      entityData.delete(p.id);
    }
    planes.clear();
    document.getElementById('planeCount').textContent = '0';
    viewer.scene.requestRender();
  }

  function getBBox() {
    const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
    if (!rect) {
      const c = viewer.camera.positionCartographic;
      const lat = Cesium.Math.toDegrees(c.latitude), lon = Cesium.Math.toDegrees(c.longitude);
      return { lamin: lat - 4, lamax: lat + 4, lomin: lon - 6, lomax: lon + 6, lat, lon };
    }
    return {
      lamin: Cesium.Math.toDegrees(rect.south), lamax: Cesium.Math.toDegrees(rect.north),
      lomin: Cesium.Math.toDegrees(rect.west), lomax: Cesium.Math.toDegrees(rect.east),
      lat: Cesium.Math.toDegrees((rect.south + rect.north) / 2),
      lon: Cesium.Math.toDegrees((rect.west + rect.east) / 2)
    };
  }

  function parseAC(data) {
    if (!data) return null;
    if (typeof data.contents === 'string') { try { data = JSON.parse(data.contents); } catch (e) { return null; } }
    if (Array.isArray(data.ac) && data.ac.length) return data.ac;
    if (Array.isArray(data.aircraft) && data.aircraft.length) return data.aircraft;
    if (Array.isArray(data.states) && data.states.length) {
      return data.states.map(s => ({
        hex: s[0], flight: s[1], lat: s[6], lon: s[5],
        alt_baro: s[7], track: s[10], gs: s[9], on_ground: s[8], squawk: s[14]
      })).filter(a => a.lat != null && a.lon != null);
    }
    return null;
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  function planeColor(alt) {
    if (alt > 35000) return Cesium.Color.fromCssColorString('#a5f3fc');
    if (alt > 20000) return Cesium.Color.fromCssColorString('#38bdf8');
    if (alt > 10000) return Cesium.Color.fromCssColorString('#34d399');
    return Cesium.Color.fromCssColorString('#fbbf24');
  }

  function updateEntityData(hex, p) {
    entityData.set(p.id, {
      title: p.callsign, sub: 'Aircraft · live',
      fields: [
        { k: 'Altitude', v: Math.round(p.alt).toLocaleString() + ' ft' },
        { k: 'Speed', v: Math.round(p.gs) + ' kt' },
        { k: 'Heading', v: Math.round(p.track) + '°' },
        { k: 'Squawk', v: p.squawk || '—' },
        { k: 'Registration', v: p.reg || '—' },
        { k: 'Type', v: p.type || '—' },
        { k: 'ICAO', v: hex.toUpperCase() },
        { k: 'Position', v: p.lat.toFixed(4) + ', ' + p.lon.toFixed(4), full: true }
      ]
    });
  }

  let lastAnim = performance.now();
  function animatePlanes(now) {
    if (!airOn) return;
    const dt = Math.min(0.1, (now - lastAnim) / 1000);
    lastAnim = now;
    if (dt <= 0) return;
    let moved = false;
    for (const p of planes.values()) {
      if (!p.ent || p.gs < 30) continue;
      const nm = p.gs * (dt / 3600);
      const rad = p.track * Math.PI / 180;
      const dLat = nm * Math.cos(rad) * NM_TO_DEG_LAT;
      const cosLat = Math.cos(p.lat * Math.PI / 180) || 0.01;
      const dLon = nm * Math.sin(rad) * NM_TO_DEG_LAT / cosLat;
      p.lat += dLat;
      p.lon += dLon;
      const h = Math.max(p.alt, 100) * 0.3048;
      p.ent.position = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, h);
      if (S.trails && p.trailPos) {
        p.trailPos.push(p.lon, p.lat, h);
        const maxPts = S.trailLen * 3;
        while (p.trailPos.length > maxPts) p.trailPos.splice(0, 3);
        if (p.trail && p.trail.polyline) {
          p.trail.polyline.positions = Cesium.Cartesian3.fromDegreesArrayHeights(p.trailPos);
        }
      }
      moved = true;
    }
    if (moved) viewer.scene.requestRender();
  }

  viewer.scene.preUpdate.addEventListener(function () {
    if (airOn) animatePlanes(performance.now());
  });

  let renderLoop = null;
  function startRenderLoop() {
    if (renderLoop) return;
    viewer.scene.requestRenderMode = false;
    renderLoop = true;
  }
  function stopRenderLoop() {
    renderLoop = null;
    viewer.scene.requestRenderMode = true;
    viewer.scene.requestRender();
  }

  async function loadAircraft() {
    if (!airOn) return;
    const b = getBBox();
    const dist = Math.min(250, Math.max(60, Math.round(Math.max(Math.abs(b.lamax - b.lamin), Math.abs(b.lomax - b.lomin)) * 30)));
    const lat = b.lat.toFixed(3), lon = b.lon.toFixed(3);
    let list = null;

    try {
      const local = await fetchJSON('data/aircraft.json?t=' + Date.now());
      list = parseAC(local);
      if (list && list.length) {
        const filtered = list.filter(a => {
          const la = Number(a.lat), lo = Number(a.lon);
          return la >= b.lamin - 4 && la <= b.lamax + 4 && lo >= b.lomin - 4 && lo <= b.lomax + 4;
        });
        if (filtered.length >= 3) list = filtered;
      }
    } catch (e) {}

    if (!list || !list.length) {
      const urls = [
        `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
        `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
        `https://api.airplanes.live/v2/point/${lat}/${lon}/${dist}`
      ];
      for (const u of urls) {
        try { list = parseAC(await fetchJSON(u)); if (list && list.length) break; } catch (e) {}
      }
      if (!list || !list.length) {
        for (const u of urls.slice(0, 2)) {
          for (const p of [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
            `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`
          ]) {
            try { list = parseAC(await fetchJSON(p)); if (list && list.length) break; } catch (e) {}
          }
          if (list && list.length) break;
        }
      }
    }

    if (!list || !list.length) {
      setDot('airDot', 'err');
      toast('No aircraft in view — try NYC / London / LA');
      return;
    }
    setDot('airDot', 'on');

    const cx = b.lat, cy = b.lon;
    list = list.map(a => {
      const la = Number(a.lat ?? a.latitude), lo = Number(a.lon ?? a.longitude);
      const alt = Number(a.alt_baro ?? a.alt_geom ?? 0);
      return { raw: a, la, lo, alt, dist: Math.abs(la - cx) + Math.abs(lo - cy) };
    }).filter(x => Number.isFinite(x.la) && Number.isFinite(x.lo) && x.alt >= S.minAlt && x.raw.on_ground !== true && x.raw.alt_baro !== 'ground')
      .sort((a, b) => a.dist - b.dist)
      .slice(0, S.maxPlanes);

    const seen = new Set();
    let count = 0;
    const now = performance.now();

    for (const item of list) {
      const ac = item.raw;
      const la = item.la, lo = item.lo, alt = item.alt;
      const hex = String(ac.hex || ac.icao24 || la + ',' + lo).toLowerCase().replace(/^~/, '');
      seen.add(hex);
      const callsign = String(ac.flight || ac.callsign || hex).trim() || hex;
      const track = Number(ac.track ?? ac.true_track) || 0;
      const gs = Number(ac.gs ?? ac.velocity) || 0;
      const height = Math.max(alt, 100) * 0.3048;
      const id = 'ac-' + hex;
      const col = planeColor(alt);

      let p = planes.get(hex);
      if (!p) {
        const trailPos = S.trails ? [lo, la, height] : null;
        const ent = viewer.entities.add({
          id, position: Cesium.Cartesian3.fromDegrees(lo, la, height),
          point: {
            pixelSize: 8, color: col, outlineColor: Cesium.Color.WHITE, outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(5e3, 1.6, 2.5e6, 0.3)
          },
          label: {
            text: callsign, font: 'bold 11px sans-serif',
            fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(5e3, 1, 6e5, 0.25),
            show: S.labels
          }
        });
        let trail = null;
        if (S.trails) {
          trail = viewer.entities.add({
            id: id + '-trail',
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights(trailPos),
              width: 1.5,
              material: new Cesium.ColorMaterialProperty(col.withAlpha(0.45)),
              clampToGround: false,
              arcType: Cesium.ArcType.NONE
            }
          });
        }
        p = { id, lat: la, lon: lo, alt, track, gs, callsign, reg: ac.r || ac.registration || '', type: ac.t || ac.type || '', squawk: ac.squawk || '', ent, trail, trailPos, t0: now };
        planes.set(hex, p);
      } else {
        p.lat = la; p.lon = lo; p.alt = alt; p.track = track; p.gs = gs;
        p.callsign = callsign; p.t0 = now;
        p.ent.position = Cesium.Cartesian3.fromDegrees(lo, la, height);
        if (p.ent.point) p.ent.point.color = col;
        if (p.ent.label) {
          p.ent.label.text = callsign;
          p.ent.label.show = S.labels;
        }
        if (S.trails && p.trailPos) {
          p.trailPos.push(lo, la, height);
          const maxPts = S.trailLen * 3;
          while (p.trailPos.length > maxPts) p.trailPos.splice(0, 3);
        }
      }
      updateEntityData(hex, p);
      count++;
    }

    for (const [hex, p] of planes) {
      if (!seen.has(hex)) {
        if (p.ent) viewer.entities.remove(p.ent);
        if (p.trail) viewer.entities.remove(p.trail);
        entityData.delete(p.id);
        planes.delete(hex);
      }
    }

    document.getElementById('planeCount').textContent = String(count);
    viewer.scene.requestRender();
  }

  function startAir() {
    airOn = true; setDot('airDot', 'warn'); toast('Live air traffic — planes glide between updates');
    startRenderLoop();
    const h = viewer.camera.positionCartographic ? viewer.camera.positionCartographic.height : 1e7;
    if (h > 4e5) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-74.0, 40.7, 160000), duration: 2, complete: loadAircraft });
    } else loadAircraft();
    airTimer = setInterval(loadAircraft, 20000);
  }
  function stopAir() {
    airOn = false;
    if (airTimer) clearInterval(airTimer); airTimer = null;
    clearPlanes(); setDot('airDot', '');
    stopRenderLoop();
  }

  let disasterOn = false, disasterTimer = null;
  const disasterEntities = [];
  function clearDisasters() {
    disasterEntities.forEach(e => { viewer.entities.remove(e); entityData.delete(e.id); });
    disasterEntities.length = 0;
    document.getElementById('disasterCount').textContent = '0';
    viewer.scene.requestRender();
  }
  const CAT_COLOR = {
    'Wildfires': '#f97316', 'Severe Storms': '#eab308', 'Volcanoes': '#ef4444',
    'Earthquakes': '#f43f5e', 'Floods': '#3b82f6', 'Landslides': '#a16207'
  };

  async function loadDisasters() {
    if (!disasterOn) return;
    clearDisasters();
    let count = 0;
    try {
      const eq = await fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
      (eq.features || []).forEach((f, i) => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const p = f.properties || {};
        const mag = p.mag;
        const id = 'eq-' + (p.code || i);
        const size = 6 + Math.min(16, (mag || 1) * 3);
        const ent = viewer.entities.add({
          id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: { pixelSize: size, color: Cesium.Color.fromCssColorString('#f43f5e'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: 'M' + (mag != null ? mag.toFixed(1) : '?'), font: 'bold 10px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -size - 2), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 3e6, 0.2), show: S.labels }
        });
        disasterEntities.push(ent);
        entityData.set(id, {
          title: 'Earthquake M' + (mag != null ? mag.toFixed(1) : '?'), sub: p.place || 'USGS',
          fields: [
            { k: 'Magnitude', v: mag }, { k: 'Depth', v: depth != null ? depth.toFixed(1) + ' km' : '—' },
            { k: 'Time', v: p.time ? new Date(p.time).toLocaleString() : '—' },
            { k: 'Location', v: lat.toFixed(3) + ', ' + lon.toFixed(3), full: true }
          ]
        });
        count++;
      });
    } catch (e) { console.warn('USGS', e); }
    try {
      const eo = await fetchJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60');
      (eo.events || []).forEach((ev, i) => {
        const cats = (ev.categories || []).map(c => c.title);
        const cat = cats[0] || 'Event';
        const geo = (ev.geometry || [])[ev.geometry.length - 1];
        if (!geo || !geo.coordinates) return;
        let lon, lat;
        if (geo.type === 'Point') { lon = geo.coordinates[0]; lat = geo.coordinates[1]; }
        else if (Array.isArray(geo.coordinates[0])) { lon = geo.coordinates[0][0]; lat = geo.coordinates[0][1]; }
        else return;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const color = CAT_COLOR[cat] || '#f97316';
        const id = 'eo-' + (ev.id || i);
        const ent = viewer.entities.add({
          id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(color), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: cat.split(' ')[0], font: '9px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 4e6, 0), show: S.labels }
        });
        disasterEntities.push(ent);
        entityData.set(id, {
          title: ev.title || cat, sub: cats.join(', ') || 'NASA EONET',
          fields: [
            { k: 'Category', v: cats.join(', ') },
            { k: 'Date', v: geo.date ? new Date(geo.date).toLocaleString() : '—' },
            { k: 'Location', v: lat.toFixed(3) + ', ' + lon.toFixed(3), full: true }
          ]
        });
        count++;
      });
    } catch (e) { console.warn('EONET', e); }
    document.getElementById('disasterCount').textContent = String(count);
    toast(count ? ('Disasters: ' + count) : 'No events');
    viewer.scene.requestRender();
  }
  function startDisasters() { disasterOn = true; loadDisasters(); disasterTimer = setInterval(loadDisasters, 5 * 60 * 1000); }
  function stopDisasters() { disasterOn = false; if (disasterTimer) clearInterval(disasterTimer); disasterTimer = null; clearDisasters(); }

  let weatherOn = false, weatherTimer = null;
  async function loadRadar() {
    if (!weatherOn) return;
    try {
      const maps = await fetchJSON('https://api.rainviewer.com/public/weather-maps.json');
      const frames = (maps.radar && maps.radar.past) || [];
      if (!frames.length) return;
      const frame = frames[frames.length - 1];
      const host = maps.host || 'https://tilecache.rainviewer.com';
      const url = host + frame.path + '/256/{z}/{x}/{y}/2/1_1.png';
      if (radarLayer) viewer.imageryLayers.remove(radarLayer, false);
      radarLayer = viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({ url, credit: 'RainViewer', maximumLevel: 7 }));
      radarLayer.alpha = 0.6;
      viewer.scene.requestRender();
    } catch (e) { toast('Radar unavailable'); }
  }
  async function fetchWeatherAt(lat, lon) {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=auto`;
      const d = await fetchJSON(u);
      const c = d.current || {};
      const codes = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 51: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 80: 'Showers', 95: 'Thunderstorm' };
      showInfo('Weather', lat.toFixed(2) + ', ' + lon.toFixed(2), [
        { k: 'Condition', v: codes[c.weather_code] || ('Code ' + c.weather_code) },
        { k: 'Temp', v: c.temperature_2m != null ? c.temperature_2m + '°C' : '—' },
        { k: 'Feels like', v: c.apparent_temperature != null ? c.apparent_temperature + '°C' : '—' },
        { k: 'Humidity', v: c.relative_humidity_2m != null ? c.relative_humidity_2m + '%' : '—' },
        { k: 'Precip', v: c.precipitation != null ? c.precipitation + ' mm' : '—' },
        { k: 'Clouds', v: c.cloud_cover != null ? c.cloud_cover + '%' : '—' },
        { k: 'Wind', v: c.wind_speed_10m != null ? c.wind_speed_10m + ' km/h' : '—' },
        { k: 'Wind dir', v: c.wind_direction_10m != null ? c.wind_direction_10m + '°' : '—' }
      ]);
    } catch (e) { toast('Weather failed'); }
  }
  function startWeather() { weatherOn = true; loadRadar(); weatherTimer = setInterval(loadRadar, 5 * 60 * 1000); toast('Radar on — click map for weather'); }
  function stopWeather() {
    weatherOn = false; if (weatherTimer) clearInterval(weatherTimer); weatherTimer = null;
    if (radarLayer) { viewer.imageryLayers.remove(radarLayer, false); radarLayer = null; }
    viewer.scene.requestRender();
  }

  let lightningOn = false, strikeCount = 0, ws = null;
  const strikeEntities = [];
  function decodeBlitz(b) {
    try {
      if (typeof b !== 'string') b = new TextDecoder().decode(b);
      const d = b.split('');
      let e = {}, c = d[0], f = c, g = [c], h = 256, o = h;
      for (let i = 1; i < d.length; i++) {
        const a = d[i].charCodeAt(0);
        const x = h > a ? d[i] : (e[a] !== undefined ? e[a] : f + c);
        g.push(x); c = x.charAt(0); e[o] = f + c; o++; f = x;
      }
      return g.join('');
    } catch (err) { return null; }
  }
  function addStrike(lat, lon, time) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const id = 'lt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const ent = viewer.entities.add({
      id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 6, color: Cesium.Color.fromCssColorString('#c084fc'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(5e3, 1.3, 2e6, 0.2) }
    });
    strikeEntities.push(ent);
    entityData.set(id, {
      title: 'Lightning', sub: 'Blitzortung',
      fields: [
        { k: 'Time', v: time ? new Date(time).toLocaleString() : new Date().toLocaleString() },
        { k: 'Position', v: lat.toFixed(4) + ', ' + lon.toFixed(4), full: true }
      ]
    });
    strikeCount++;
    document.getElementById('strikeCount').textContent = String(strikeCount);
    setTimeout(() => {
      viewer.entities.remove(ent); entityData.delete(id);
      const idx = strikeEntities.indexOf(ent); if (idx >= 0) strikeEntities.splice(idx, 1);
      viewer.scene.requestRender();
    }, 45000);
    while (strikeEntities.length > 250) {
      const old = strikeEntities.shift();
      viewer.entities.remove(old); entityData.delete(old.id);
    }
    viewer.scene.requestRender();
  }
  function startLightning() {
    lightningOn = true; strikeCount = 0;
    document.getElementById('strikeCount').textContent = '0';
    toast('Lightning connecting…');
    const hosts = ['wss://ws1.blitzortung.org', 'wss://ws2.blitzortung.org', 'wss://ws3.blitzortung.org'];
    let hi = 0;
    function connect() {
      if (!lightningOn) return;
      const host = hosts[hi % hosts.length]; hi++;
      try {
        ws = new WebSocket(host);
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => { try { ws.send(JSON.stringify({ a: 111 })); } catch (e) {} toast('Lightning live'); };
        ws.onmessage = (ev) => {
          if (!lightningOn) return;
          let text = typeof ev.data === 'string' ? ev.data : decodeBlitz(ev.data);
          if (!text) try { text = new TextDecoder().decode(ev.data); } catch (e) {}
          if (!text) return;
          try {
            const j = JSON.parse(text);
            const la = j.lat ?? j.latitude, lo = j.lon ?? j.lng ?? j.longitude;
            if (la != null && lo != null) addStrike(Number(la), Number(lo), j.time || j.timestamp);
          } catch (e) {}
        };
        ws.onclose = () => { if (lightningOn) setTimeout(connect, 3000); };
        ws.onerror = () => { try { ws.close(); } catch (e) {} };
      } catch (e) { if (lightningOn) setTimeout(connect, 4000); }
    }
    connect();
  }
  function stopLightning() {
    lightningOn = false;
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    strikeEntities.forEach(e => { viewer.entities.remove(e); entityData.delete(e.id); });
    strikeEntities.length = 0;
    document.getElementById('strikeCount').textContent = '0';
    viewer.scene.requestRender();
  }

  const PLACES = {
    'new york': [-74.006, 40.7128, 120000], 'nyc': [-74.006, 40.7128, 120000],
    'london': [-0.1276, 51.5074, 100000], 'tokyo': [139.6917, 35.6895, 120000],
    'paris': [2.3522, 48.8566, 90000], 'los angeles': [-118.2437, 34.0522, 150000],
    'la': [-118.2437, 34.0522, 150000], 'dubai': [55.2708, 25.2048, 100000],
    'chicago': [-87.6298, 41.8781, 100000], 'miami': [-80.1918, 25.7617, 90000],
    'toronto': [-79.3832, 43.6532, 100000], 'singapore': [103.8198, 1.3521, 80000]
  };
  function flyToQuery(q) {
    const key = (q || '').trim().toLowerCase();
    if (!key) return;
    const hit = PLACES[key];
    if (hit) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(hit[0], hit[1], hit[2]), duration: 2.2 });
      return;
    }
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=1', { headers: { Accept: 'application/json' } })
      .then(r => r.json()).then(arr => {
        if (!arr || !arr[0]) { toast('Place not found'); return; }
        viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(+arr[0].lon, +arr[0].lat, 90000), duration: 2.2 });
      }).catch(() => toast('Search failed'));
  }

  function initSettingsUI() {
    document.getElementById('setLabels').checked = S.labels;
    document.getElementById('setTrails').checked = S.trails;
    document.getElementById('setLighting').checked = S.lighting;
    document.getElementById('setMinAlt').value = S.minAlt;
    document.getElementById('minAltVal').textContent = S.minAlt + ' ft';
    document.getElementById('setMaxPlanes').value = S.maxPlanes;
    document.getElementById('maxPlanesVal').textContent = S.maxPlanes;
    document.getElementById('setTrailLen').value = S.trailLen;
    document.getElementById('trailLenVal').textContent = S.trailLen;
    document.getElementById('setQuality').value = S.quality;
    document.getElementById('setFps').checked = S.showFps;
    document.getElementById('fpsStat').style.display = S.showFps ? '' : 'none';

    document.getElementById('settingsToggle').onchange = e => {
      document.getElementById('settingsPanel').classList.toggle('open', e.target.checked);
    };
    document.getElementById('setLabels').onchange = e => {
      S.labels = e.target.checked; saveS();
      for (const p of planes.values()) { if (p.ent && p.ent.label) p.ent.label.show = S.labels; }
      disasterEntities.forEach(ent => { if (ent.label) ent.label.show = S.labels; });
      viewer.scene.requestRender();
    };
    document.getElementById('setTrails').onchange = e => {
      S.trails = e.target.checked; saveS();
      if (!S.trails) {
        for (const p of planes.values()) {
          if (p.trail) { viewer.entities.remove(p.trail); p.trail = null; p.trailPos = null; }
        }
      }
      viewer.scene.requestRender();
    };
    document.getElementById('setLighting').onchange = e => {
      S.lighting = e.target.checked; saveS();
      viewer.scene.globe.enableLighting = S.lighting;
      viewer.scene.requestRender();
    };
    document.getElementById('setMinAlt').oninput = e => {
      S.minAlt = +e.target.value; document.getElementById('minAltVal').textContent = S.minAlt + ' ft'; saveS();
    };
    document.getElementById('setMaxPlanes').oninput = e => {
      S.maxPlanes = +e.target.value; document.getElementById('maxPlanesVal').textContent = S.maxPlanes; saveS();
    };
    document.getElementById('setTrailLen').oninput = e => {
      S.trailLen = +e.target.value; document.getElementById('trailLenVal').textContent = S.trailLen; saveS();
    };
    document.getElementById('setQuality').onchange = e => {
      S.quality = e.target.value; saveS(); applyQuality(S.quality);
    };
    document.getElementById('setFps').onchange = e => {
      S.showFps = e.target.checked; saveS();
      document.getElementById('fpsStat').style.display = S.showFps ? '' : 'none';
    };
  }
  initSettingsUI();

  let frames = 0, fpsT = performance.now();
  viewer.scene.postRender.addEventListener(() => {
    if (!S.showFps) return;
    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) {
      document.getElementById('fpsVal').textContent = String(frames);
      frames = 0; fpsT = now;
    }
  });

  document.getElementById('airToggle').onchange = e => e.target.checked ? startAir() : stopAir();
  document.getElementById('disasterToggle').onchange = e => e.target.checked ? startDisasters() : stopDisasters();
  document.getElementById('weatherToggle').onchange = e => e.target.checked ? startWeather() : stopWeather();
  document.getElementById('lightningToggle').onchange = e => e.target.checked ? startLightning() : stopLightning();
  document.getElementById('trafficToggle').onchange = e => setStreetMode(e.target.checked);
  document.getElementById('flyBtn').onclick = () => flyToQuery(document.getElementById('searchBox').value);
  document.getElementById('searchBox').onkeydown = e => { if (e.key === 'Enter') flyToQuery(e.target.value); };
  document.getElementById('homeBtn').onclick = () => viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-40, 20, 18e6), duration: 1.5 });
  document.getElementById('myLocBtn').onclick = () => {
    if (!navigator.geolocation) { toast('No geolocation'); return; }
    navigator.geolocation.getCurrentPosition(p => {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(p.coords.longitude, p.coords.latitude, 80000), duration: 2 });
    }, () => toast('Location blocked'));
  };
  document.getElementById('backBtn').onclick = () => {
    const u = new URL(location.href);
    let p = u.pathname.replace(/\/games\/live-earth\/?.*$/i, '/');
    if (!p.endsWith('/')) p += '/';
    location.href = u.origin + p;
  };

  viewer.camera.moveEnd.addEventListener(() => {
    if (airOn) { clearTimeout(viewer._airReload); viewer._airReload = setTimeout(loadAircraft, 700); }
  });

  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(-40, 20, 18e6) });
  viewer.scene.postRender.addEventListener(function hideLoad() {
    document.getElementById('loading').classList.add('hide');
    viewer.scene.postRender.removeEventListener(hideLoad);
    toast('Live Earth ready');
  });
})();
