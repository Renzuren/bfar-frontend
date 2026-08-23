// src/components/report/PhilippineMap.jsx
// ============================================================
// PHILIPPINE DISTRIBUTION MAP (Report tab)
// Portrait-oriented, tile-free vector basemap. View is locked:
// fixed zoom level 6, zoom-out disabled below 6 and panning
// clamped to Philippine bounds [4..22 lat, 116..128 lng] so no
// neighboring country is ever visible. Circle markers sized by
// the active group metric with styled hover tooltips, group
// filtering (dimming) and external hover-focus sync.
// ============================================================

import React from 'react';
import { MapContainer, Polygon, CircleMarker, Tooltip as LeafletTooltip, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { findAreaKey, getCoordsForKey } from '@/lib/geoData';
import { PH_ISLANDS, PH_VIEW, PH_STYLE } from '@/lib/phIslandsGeo';

export const GROUP_COLORS = {
  Beneficiary: '#2563eb',
  'Non-Beneficiary': '#f97316',
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

const PhilippineMap = ({ points = [], activeType = 'All', focusKey = null, onFocusChange }) => {
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

  // Metric adapts to the active group filter so bubbles resize meaningfully
  const metricOf = (p) =>
    activeType === 'Beneficiary' ? p.b : activeType === 'Non-Beneficiary' ? p.nb : p.total;

  const totals = resolved.map(metricOf);
  const maxTotal = Math.max(...totals, 1);
  const minTotal = Math.min(...totals.filter((t) => t > 0), 1);

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
        {PH_ISLANDS.map((island) => (
          <Polygon
            key={island.name}
            positions={island.ring}
            pathOptions={{ fillColor: PH_STYLE.landFill, color: PH_STYLE.landStroke, weight: 1.4, fillOpacity: 1 }}
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

      {/* Bubble-size legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2 text-[10.5px] text-slate-500 shadow-sm">
        <div className="mb-1 font-bold uppercase tracking-wide text-slate-600">Bubble size</div>
        <div className="flex items-end gap-2">
          {[6, 10, 16].map((r, i) => (
            <span key={r} className="relative inline-flex items-center justify-center" style={{ width: r * 2, height: r * 2 }}>
              <span className="absolute inset-0 rounded-full border border-slate-300 bg-blue-400/25" />
              <span className="absolute inset-x-0 mx-auto block h-1.5 w-1.5 rounded-full bg-blue-600" />
            </span>
          ))}
        </div>
        <div className="mt-1">fewer → more respondents</div>
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
