// src/components/report/PhilippineMap.jsx
// ============================================================
// PHILIPPINE DISTRIBUTION MAP
// Real, survey-accurate provincial boundaries (PSA/NAMRIA-derived,
// bundled locally as phProvinces.geojson). Tile-free and fully
// offline so it renders inside html2canvas PDF exports. View is
// locked to the Philippines. Circle markers sized by the active
// group metric with styled hover tooltips, group filtering and
// external hover-focus sync. Provincial / regional boundary layers
// toggle with choropleth shading by respondent count.
// ============================================================

import React, { useMemo, useState } from 'react';
import { MapContainer, GeoJSON, CircleMarker, Tooltip as LeafletTooltip, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { findAreaKey, getCoordsForKey, normalizeProvinceName } from '@/lib/geoData';
import { PH_VIEW, PH_STYLE } from '@/lib/phIslandsGeo';
import phProvinces from '@/lib/phProvinces.json';

export const GROUP_COLORS = {
  Beneficiary: '#2563eb',
  'Non-Beneficiary': '#f97316',
};

const REGION_FILLS = {
  CAR: '#c7e0cc',
  'Region I': '#c9dcee',
  'Region II': '#d7cee4',
  NCR: '#f6d4c3',
  'Region III': '#c4e3d8',
  'Region IV-A': '#d1e3c9',
  MIMAROPA: '#e3dcc4',
  'Region V': '#dccce2',
  'Region VI': '#cadced',
  'Region VII': '#d8e4c9',
  'Region VIII': '#e6d3cf',
  'Region IX': '#c9cfec',
  'Region X': '#e0d0e0',
  'Region XI': '#cfe3d3',
  'Region XII': '#ecdcc6',
  'Region XIII': '#cdd6e6',
  BARMM: '#dde6ca',
};

const radiusFor = (total, minTotal, maxTotal) => {
  if (total <= 0) return 3;
  if (maxTotal <= minTotal) return 12;
  const t = (Math.sqrt(total) - Math.sqrt(minTotal)) / (Math.sqrt(maxTotal) - Math.sqrt(minTotal));
  return 7 + t * 19;
};

const TooltipCard = ({ point }) => (
  <div style={{ minWidth: 210, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 2 }}>{point.name}</div>
    <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 8 }}>{point.province} · {point.region}</div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {[
          ['Beneficiaries', point.b, GROUP_COLORS.Beneficiary],
          ['Non-Beneficiaries', point.nb, GROUP_COLORS['Non-Beneficiary']],
          ['Total Respondents', point.total, '#1e293b'],
        ].map(([label, value, color]) => (
          <tr key={label}>
            <td style={{ padding: '3px 0', color: '#94a3b8', whiteSpace: 'nowrap', paddingRight: 14 }}>{label}</td>
            <td style={{ padding: '3px 0', fontWeight: 700, color, textAlign: 'right' }}>{value.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #e2e8f0', fontSize: 10, color: '#94a3b8' }}>
      Bubble size = respondents{point.b + point.nb !== point.total ? '' : ' at this location'}
    </div>
  </div>
);

// ------------------------------------------------------------------
// Province choropleth shading (5-bin quantile-ish scale)
// ------------------------------------------------------------------
const PROVINCE_FILL_STOPS = ['#dfeef8', '#bcdcf0', '#8dc3e4', '#5fa7d6', '#3c87c2', '#2563a8'];

const PhilippineMap = ({ points = [], activeType = 'All', focusKey = null, onFocusChange }) => {
  const [layerType, setLayerType] = useState('province');

  const resolved = points
    .map((p) => {
      const areaKey = findAreaKey(p.name, p.province);
      const latlng =
        p.latlng ||
        getCoordsForKey(areaKey) ||
        getCoordsForKey(p.name) ||
        getCoordsForKey(`__PROVINCE__${String(p.province || '').toUpperCase()}`) ||
        null;
      return { ...p, latlng };
    })
    .filter((p) => p.latlng);

  const metricOf = (p) =>
    activeType === 'Beneficiary' ? p.b : activeType === 'Non-Beneficiary' ? p.nb : p.total;

  const totals = resolved.map(metricOf);
  const maxTotal = Math.max(...totals, 1);
  const minTotal = Math.min(...totals.filter((t) => t > 0), 1);

  // province (normalized name) -> metric total
  const { provinceTotals } = useMemo(() => {
    const pt = {};
    for (const p of resolved) {
      const key = normalizeProvinceName(p.province);
      if (!key || key === 'UNKNOWN') continue;
      pt[key] = (pt[key] || 0) + metricOf(p);
    }
    return { provinceTotals: pt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, activeType]);

  const fillForProvince = (normName) => {
    const total = provinceTotals[normName] || 0;
    if (total <= 0) return { fill: PH_STYLE.landFill, opacity: 1 };
    const idx = Math.min(
      PROVINCE_FILL_STOPS.length - 1,
      Math.max(1, Math.floor((Math.sqrt(total) / Math.sqrt(maxTotal)) * (PROVINCE_FILL_STOPS.length - 1)))
    );
    return { fill: PROVINCE_FILL_STOPS[idx], opacity: 0.9 };
  };

  const styleForFeature = (feature) => {
    const { province: name, region } = feature.properties || {};
    const normName = normalizeProvinceName(name);
    const isRegion = layerType === 'region';
    const fill = isRegion ? REGION_FILLS[region] || PH_STYLE.landFill : fillForProvince(normName).fill;
    return {
      fillColor: fill,
      fillOpacity: isRegion ? 0.85 : fillForProvince(normName).opacity,
      color: isRegion ? '#8aa6bf' : '#5f7d94',
      weight: isRegion ? 1.1 : 1.0,
      opacity: 0.9,
    };
  };

  // Bind a small hover tooltip showing the province name + region for realism.
  const onEachFeature = (feature, layer) => {
    const { province, region } = feature.properties || {};
    if (!province) return;
    layer.bindTooltip(
      `<div style="font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:700;color:#1e293b">${province}<div style="font-weight:500;color:#64748b;font-size:10px">${region || ''}</div></div>`,
      { sticky: true, direction: 'top', offset: [0, 0], opacity: 1 }
    );
  };

  // Region boundary layer — combine all province rings of a region into one
  // shape and draw a heavier outline so regional divisions are obvious.
  const regionFeatures = useMemo(() => {
    const map = {};
    for (const f of phProvinces.features) {
      const region = f.properties?.region;
      if (!region) continue;
      if (!map[region]) map[region] = { type: 'Feature', properties: { region }, geometry: { type: 'MultiPolygon', coordinates: [] } };
      const g = f.geometry;
      if (g.type === 'Polygon') map[region].geometry.coordinates.push(g.coordinates);
      else if (g.type === 'MultiPolygon') map[region].geometry.coordinates.push(...g.coordinates);
    }
    return Object.values(map);
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner"
      style={{ background: 'linear-gradient(180deg, #eef5fc 0%, #dfeefa 55%, #d2e6f6 100%)' }}
    >
      <MapContainer
        center={PH_VIEW.center}
        zoom={PH_VIEW.zoom}
        minZoom={PH_VIEW.minZoom}
        maxZoom={PH_VIEW.maxZoom}
        maxBounds={PH_VIEW.maxBounds}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        preferCanvas
        style={{ height: '100%', width: '100%', background: 'transparent' }}
      >
        <ZoomControl position="bottomright" />

        {/* Real provincial boundaries (choropleth / region shaded) */}
        <GeoJSON
          data={phProvinces}
          style={styleForFeature}
          onEachFeature={onEachFeature}
        />

        {/* Region boundary outline (drawn when regional view is active) */}
        {layerType === 'region' &&
          regionFeatures.map((rf) => (
            <GeoJSON
              key={rf.properties.region}
              data={rf}
              interactive={false}
              style={{
                fillColor: REGION_FILLS[rf.properties.region] || PH_STYLE.landFill,
                fillOpacity: 0.1,
                color: '#1e4e79',
                weight: 2.4,
                opacity: 0.85,
              }}
            />
          ))}

        {resolved.map((p) => {
          const val = metricOf(p);
          const isFocused = focusKey === p.key;
          const ghost = val === 0;
          const fill = activeType === 'All'
            ? GROUP_COLORS[p.b >= p.nb ? 'Beneficiary' : 'Non-Beneficiary']
            : GROUP_COLORS[activeType];
          const base = radiusFor(val, minTotal, maxTotal);
          return (
            <CircleMarker
              key={p.key}
              center={p.latlng}
              radius={Math.max(3, base * (isFocused ? 1.22 : 1))}
              eventHandlers={{
                mouseover: () => onFocusChange?.(p.key),
                mouseout: () => onFocusChange?.(null),
              }}
              pathOptions={{
                color: isFocused ? '#0369a1' : '#ffffff',
                weight: isFocused ? 2.6 : 1.6,
                fillColor: ghost ? '#cbd5e1' : fill,
                fillOpacity: ghost ? 0.35 : isFocused ? 0.95 : 0.8,
              }}
            >
              <LeafletTooltip direction="top" offset={[0, -6]} opacity={1}>
                <TooltipCard point={p} />
              </LeafletTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Layer toggle: provincial vs regional boundaries */}
      <div className="absolute left-3 top-3 z-[500] flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white/95 p-1 shadow-sm">
        {[
          { value: 'province', label: 'Provincial' },
          { value: 'region', label: 'Regional' },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setLayerType(t.value)}
            className={`rounded-md px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide transition ${
              layerType === t.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bubble-size legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2 text-[10.5px] text-slate-500 shadow-sm">
        <div className="mb-1 font-bold uppercase tracking-wide text-slate-600">Bubble size</div>
        <div className="flex items-end gap-2">
          {[6, 10, 16].map((r) => (
            <span key={r} className="relative inline-flex items-center justify-center" style={{ width: r * 2, height: r * 2 }}>
              <span className="absolute inset-0 rounded-full border border-slate-300 bg-blue-400/25" />
              <span className="absolute inset-x-0 mx-auto block h-1.5 w-1.5 rounded-full bg-blue-600" />
            </span>
          ))}
        </div>
        <div className="mt-1">fewer → more respondents</div>
        <div className="mt-0.5 text-[10px]">areas shaded by respondent count</div>
      </div>

      {!resolved.length && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/70">
          <p className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow">
            No geocodable municipalities in the current data
          </p>
        </div>
      )}
    </div>
  );
};

export default PhilippineMap;
