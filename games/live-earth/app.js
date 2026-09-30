(function () {
  Cesium.Ion.defaultAccessToken = undefined;

  const satelliteProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Tiles © Esri', maximumLevel: 19
  });

  const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    fullscreenButton: true, infoBox: false, selectionIndicator: false,
    terrainProvider: undefined, imageryProvider: false,
    skyBox: false, skyAtmosphere: new Cesium.SkyAtmosphere()
  });
  viewer.imageryLayers.removeAll();
  const satelliteLayer = viewer.imageryLayers.addImageryProvider(satelliteProvider);
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a2744');
  viewer.scene.fog.enabled = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a12');

  let osmLayer = null, radarLayer = null;
  const entityData = new Map();

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._id);
    toast._id = setTimeout(() => t.classList.remove('show'), 3200);
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
      if (d) { showInfo(d.title, d.sub, d.fields); return; }
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
  }

  let airOn = false, airTimer = null;
  const planeEntities = new Map();

  function setDot(id, state) {
    const d = document.getElementById(id);
    if (d) d.className = 'status-dot' + (state ? ' ' + state : '');
  }

  function clearPlanes() {
    for (const e of planeEntities.values()) { viewer.entities.remove(e); entityData.delete(e.id); }
    planeEntities.clear();
    document.getElementById('planeCount').textContent = '0';
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
      return data.states.map(s => ({ hex: s[0], flight: s[1], lat: s[6], lon: s[5], alt_baro: s[7], track: s[10], gs: s[9], on_ground: s[8], squawk: s[14] }))
        .filter(a => a.lat != null && a.lon != null);
    }
    return null;
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  async function loadAircraft() {
    if (!airOn) return;
    const b = getBBox();
    const dist = Math.min(250, Math.max(60, Math.round(Math.max(Math.abs(b.lamax - b.lamin), Math.abs(b.lomax - b.lomin)) * 30)));
    const lat = b.lat.toFixed(3), lon = b.lon.toFixed(3);
    let list = null;

    // Same-origin feed (GitHub Action updates every ~15 min) — no CORS
    try {
      const local = await fetchJSON('data/aircraft.json?t=' + Date.now());
      list = parseAC(local);
      if (list && list.length) {
        const filtered = list.filter(a => {
          const la = Number(a.lat), lo = Number(a.lon);
          return la >= b.lamin - 3 && la <= b.lamax + 3 && lo >= b.lomin - 3 && lo <= b.lomax + 3;
        });
        if (filtered.length >= 3) list = filtered;
      }
    } catch (e) {}

    if (!list || !list.length) {
      const urls = [
        `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
        `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
        `https://api.airplanes.live/v2/point/${lat}/${lon}/${dist}`,
        `https://opensky-network.org/api/states/all?lamin=${b.lamin.toFixed(2)}&lomin=${b.lomin.toFixed(2)}&lamax=${b.lamax.toFixed(2)}&lomax=${b.lomax.toFixed(2)}`
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
      toast('No aircraft data yet — refreshes every 15 min via GitHub.');
      return;
    }
    setDot('airDot', 'on');
    const seen = new Set();
    let count = 0;
    for (const ac of list) {
      const la = Number(ac.lat ?? ac.latitude), lo = Number(ac.lon ?? ac.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
      if (ac.on_ground === true || ac.alt_baro === 'ground') continue;
      let alt = Number(ac.alt_baro ?? ac.alt_geom ?? ac.baro_altitude);
      if (!Number.isFinite(alt) || alt < 100) continue;
      const hex = String(ac.hex || ac.icao24 || la + ',' + lo).toLowerCase().replace(/^~/, '');
      seen.add(hex);
      const callsign = String(ac.flight || ac.callsign || hex).trim() || hex;
      const track = Number(ac.track ?? ac.true_track) || 0;
      const gs = Number(ac.gs ?? ac.velocity) || 0;
      const height = Math.max(alt, 100) * 0.3048;
      const id = 'ac-' + hex;
      const pos = Cesium.Cartesian3.fromDegrees(lo, la, height);
      let ent = planeEntities.get(hex);
      if (!ent) {
        ent = viewer.entities.add({
          id, position: pos,
          point: { pixelSize: 9, color: Cesium.Color.fromCssColorString('#38bdf8'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(5e3, 1.5, 2e6, 0.35) },
          label: { text: callsign, font: 'bold 11px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(5e3, 1, 8e5, 0.3) }
        });
        planeEntities.set(hex, ent);
      } else {
        ent.position = pos;
        if (ent.label) ent.label.text = callsign;
      }
      entityData.set(id, {
        title: callsign, sub: 'Aircraft',
        fields: [
          { k: 'Altitude', v: Math.round(alt).toLocaleString() + ' ft' },
          { k: 'Speed', v: Math.round(gs) + ' kt' },
          { k: 'Heading', v: Math.round(track) + '°' },
          { k: 'Squawk', v: ac.squawk || '—' },
          { k: 'Registration', v: ac.r || ac.registration || '—' },
          { k: 'Type', v: ac.t || ac.type || '—' },
          { k: 'ICAO', v: hex.toUpperCase() },
          { k: 'Position', v: la.toFixed(4) + ', ' + lo.toFixed(4), full: true }
        ]
      });
      count++;
    }
    for (const [hex, ent] of planeEntities) {
      if (!seen.has(hex)) { viewer.entities.remove(ent); planeEntities.delete(hex); entityData.delete(ent.id); }
    }
    document.getElementById('planeCount').textContent = String(count);
  }

  function startAir() {
    airOn = true; setDot('airDot', 'warn'); toast('Loading air traffic…');
    const h = viewer.camera.positionCartographic ? viewer.camera.positionCartographic.height : 1e7;
    if (h > 4e5) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-74.0, 40.7, 160000), duration: 2, complete: loadAircraft });
    } else loadAircraft();
    airTimer = setInterval(loadAircraft, 15000);
  }
  function stopAir() { airOn = false; if (airTimer) clearInterval(airTimer); airTimer = null; clearPlanes(); setDot('airDot', ''); }

  let disasterOn = false, disasterTimer = null;
  const disasterEntities = [];
  function clearDisasters() {
    disasterEntities.forEach(e => { viewer.entities.remove(e); entityData.delete(e.id); });
    disasterEntities.length = 0;
    document.getElementById('disasterCount').textContent = '0';
  }
  const CAT_COLOR = {
    'Wildfires': '#f97316', 'Severe Storms': '#eab308', 'Volcanoes': '#ef4444',
    'Earthquakes': '#f43f5e', 'Floods': '#3b82f6', 'Landslides': '#a16207',
    'Sea and Lake Ice': '#67e8f9', 'Dust and Haze': '#a3a3a3'
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
        const size = 6 + Math.min(18, (mag || 1) * 3);
        const ent = viewer.entities.add({
          id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: { pixelSize: size, color: Cesium.Color.fromCssColorString('#f43f5e'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: 'M' + (mag != null ? mag.toFixed(1) : '?'), font: 'bold 10px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -size - 2), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 3e6, 0.2) }
        });
        disasterEntities.push(ent);
        entityData.set(id, {
          title: 'Earthquake M' + (mag != null ? mag.toFixed(1) : '?'), sub: p.place || 'USGS',
          fields: [
            { k: 'Magnitude', v: mag }, { k: 'Depth', v: depth != null ? depth.toFixed(1) + ' km' : '—' },
            { k: 'Time', v: p.time ? new Date(p.time).toLocaleString() : '—' },
            { k: 'Felt', v: p.felt != null ? p.felt + ' reports' : '—' },
            { k: 'Location', v: lat.toFixed(3) + ', ' + lon.toFixed(3), full: true },
            { k: 'More', v: p.url || '—', full: true }
          ]
        });
        count++;
      });
    } catch (e) { console.warn('USGS', e); }
    try {
      const eo = await fetchJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80');
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
          point: { pixelSize: 11, color: Cesium.Color.fromCssColorString(color), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: cat.split(' ')[0], font: '9px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 4e6, 0) }
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
    toast(count ? ('Disasters: ' + count + ' events') : 'No disaster events');
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
      radarLayer.alpha = 0.65;
    } catch (e) { console.warn('Radar', e); toast('Weather radar unavailable'); }
  }
  async function fetchWeatherAt(lat, lon) {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=auto`;
      const d = await fetchJSON(u);
      const c = d.current || {};
      const codes = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',51:'Drizzle',61:'Rain',63:'Rain',65:'Heavy rain',71:'Snow',80:'Showers',95:'Thunderstorm'};
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
    } catch (e) { toast('Weather lookup failed'); }
  }
  function startWeather() { weatherOn = true; loadRadar(); weatherTimer = setInterval(loadRadar, 5 * 60 * 1000); toast('Weather radar on — click map for local weather'); }
  function stopWeather() { weatherOn = false; if (weatherTimer) clearInterval(weatherTimer); weatherTimer = null; if (radarLayer) { viewer.imageryLayers.remove(radarLayer, false); radarLayer = null; } }

  let lightningOn = false, strikeCount = 0;
  const strikeEntities = [];
  let ws = null;
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
    const id = 'lt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const ent = viewer.entities.add({
      id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 7, color: Cesium.Color.fromCssColorString('#c084fc'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(5e3, 1.4, 2e6, 0.25) }
    });
    strikeEntities.push(ent);
    entityData.set(id, {
      title: 'Lightning strike', sub: 'Blitzortung network',
      fields: [
        { k: 'Time', v: time ? new Date(time).toLocaleString() : new Date().toLocaleString() },
        { k: 'Latitude', v: lat.toFixed(4) }, { k: 'Longitude', v: lon.toFixed(4) },
        { k: 'Position', v: lat.toFixed(4) + ', ' + lon.toFixed(4), full: true }
      ]
    });
    strikeCount++;
    document.getElementById('strikeCount').textContent = String(strikeCount);
    setTimeout(() => { viewer.entities.remove(ent); entityData.delete(id); const idx = strikeEntities.indexOf(ent); if (idx >= 0) strikeEntities.splice(idx, 1); }, 60000);
    while (strikeEntities.length > 400) { const old = strikeEntities.shift(); viewer.entities.remove(old); entityData.delete(old.id); }
  }
  function startLightning() {
    lightningOn = true; strikeCount = 0;
    document.getElementById('strikeCount').textContent = '0';
    toast('Connecting to lightning network…');
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
  }

  const PLACES = {
    'new york':[-74.006,40.7128,120000],'nyc':[-74.006,40.7128,120000],
    'london':[-0.1276,51.5074,100000],'tokyo':[139.6917,35.6895,120000],
    'paris':[2.3522,48.8566,90000],'los angeles':[-118.2437,34.0522,150000],
    'la':[-118.2437,34.0522,150000],'dubai':[55.2708,25.2048,100000],
    'chicago':[-87.6298,41.8781,100000],'miami':[-80.1918,25.7617,90000],
    'toronto':[-79.3832,43.6532,100000]
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
    if (airOn) { clearTimeout(viewer._airReload); viewer._airReload = setTimeout(loadAircraft, 900); }
  });
  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(-40, 20, 18e6) });
  viewer.scene.postRender.addEventListener(function hideLoad() {
    document.getElementById('loading').classList.add('hide');
    viewer.scene.postRender.removeEventListener(hideLoad);
    toast('Live Earth ready');
  });
})();
