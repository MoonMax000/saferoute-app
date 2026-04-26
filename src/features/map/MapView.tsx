"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { Crosshair } from "lucide-react";
import type { LatLng } from "@/shared/types";
import type { RouteOption } from "@/features/routing";
import {
  getCityRiskCells,
  effectiveRiskFill,
  effectiveRiskStroke,
} from "@/features/risk";
import type { RiskCell, RiskIncident } from "@/features/risk";
import type { Incident, IncidentPlacementMode } from "@/features/incidents";
import { INCIDENT_TYPES } from "@/features/incidents";
import { clientEnv } from "@/lib/env";
import { getDemoCity, useMapsApi } from "@/lib/google";
import { computeFormulaBreakdown } from "@/features/inspector/formula-breakdown";
import { renderFormulaBreakdownHtml } from "@/features/inspector/InspectorClickPopup";
import { inspectorLog } from "@/features/inspector/inspector-log";

const MAP_CONTAINER = { width: "100%", height: "100%" };
const MAP_ID = clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "";

export type PinMode = "origin" | "destination" | null;

/** Map effective risk score → user-facing category label. */
function riskCategory(effective: number): string {
  if (effective <= 3.2) return "Looks normal";
  if (effective <= 5.2) return "Use caution";
  if (effective <= 7) return "Higher-risk area";
  return "High-risk area";
}

/* ── Helper: create custom HTML pin element ── */
function createPinElement(opts: {
  color: string;
  glyphColor?: string;
  label?: string;
  scale?: number;
  draggable?: boolean;
}): HTMLElement {
  const { color, glyphColor = "#fff", label, scale = 1 } = opts;
  const size = Math.round(40 * scale);
  const wrapper = document.createElement("div");
  wrapper.style.cursor = opts.draggable ? "grab" : "pointer";
  wrapper.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));transition:transform 0.2s ease;">
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        background:${color};
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.2);
      ">
        <span style="
          transform:rotate(45deg);
          color:${glyphColor};
          font-weight:700;
          font-size:${Math.round(14 * scale)}px;
          font-family:system-ui,sans-serif;
          line-height:1;
        ">${label ?? ""}</span>
      </div>
      <div style="
        width:3px;height:${Math.round(8 * scale)}px;
        background:${color};
        border-radius:0 0 2px 2px;
        margin-top:-2px;
      "></div>
    </div>
  `;
  wrapper.addEventListener("mouseenter", () => {
    const inner = wrapper.firstElementChild as HTMLElement;
    if (inner) inner.style.transform = "scale(1.15)";
  });
  wrapper.addEventListener("mouseleave", () => {
    const inner = wrapper.firstElementChild as HTMLElement;
    if (inner) inner.style.transform = "scale(1)";
  });
  return wrapper;
}

/* ── Helper: create route endpoint marker (circle) ── */
function createRouteEndpointEl(color: string, label: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cursor = "grab";
  wrapper.innerHTML = `
    <div style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;
      border-radius:50%;
      background:${color};
      border:3px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
      transition:transform 0.15s ease;
      font-family:system-ui,sans-serif;
      font-weight:700;
      font-size:11px;
      color:#fff;
    ">${label}</div>
  `;
  wrapper.addEventListener("mouseenter", () => {
    const inner = wrapper.firstElementChild as HTMLElement;
    if (inner) inner.style.transform = "scale(1.2)";
  });
  wrapper.addEventListener("mouseleave", () => {
    const inner = wrapper.firstElementChild as HTMLElement;
    if (inner) inner.style.transform = "scale(1)";
  });
  return wrapper;
}

/* ── Helper: create simulation car marker ── */
function createSimMarkerEl(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div style="
      display:flex;align-items:center;justify-content:center;
      width:36px;height:36px;
      border-radius:50%;
      background:linear-gradient(135deg,#6366f1,#8b5cf6);
      border:3px solid #fff;
      box-shadow:0 0 20px rgba(99,102,241,0.5), 0 2px 10px rgba(0,0,0,0.3);
      animation:sim-pulse 2s ease-in-out infinite;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
      </svg>
    </div>
  `;
  // Add pulse animation style
  if (!document.getElementById("sim-pulse-style")) {
    const style = document.createElement("style");
    style.id = "sim-pulse-style";
    style.textContent = `
      @keyframes sim-pulse {
        0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.5), 0 2px 10px rgba(0,0,0,0.3); }
        50% { box-shadow: 0 0 35px rgba(99,102,241,0.7), 0 2px 15px rgba(0,0,0,0.3); }
      }
    `;
    document.head.appendChild(style);
  }
  return wrapper;
}

/* ── Helper: create user location marker ── */
function createUserLocationEl(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
      <div style="
        position:absolute;
        width:40px;height:40px;
        border-radius:50%;
        background:rgba(59,130,246,0.15);
        border:1px solid rgba(59,130,246,0.3);
        animation:user-pulse 3s ease-in-out infinite;
      "></div>
      <div style="
        width:16px;height:16px;
        border-radius:50%;
        background:#3b82f6;
        border:3px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        z-index:1;
      "></div>
    </div>
  `;
  if (!document.getElementById("user-pulse-style")) {
    const style = document.createElement("style");
    style.id = "user-pulse-style";
    style.textContent = `
      @keyframes user-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);
  }
  return wrapper;
}

/* ── Helper: incident marker pill (icon + colour by type) ── */
function createIncidentEl(opts: {
  type: keyof typeof INCIDENT_TYPES;
}): HTMLElement {
  const cfg = INCIDENT_TYPES[opts.type];
  const wrapper = document.createElement("div");
  wrapper.style.cursor = "pointer";
  // Inline SVG glyph per incident type (kept small to bundle).
  const glyph =
    opts.type === "robbery"
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
      : opts.type === "police"
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8h4v12"/><path d="M15 20V8h4v12"/></svg>`;
  wrapper.innerHTML = `
    <div style="
      display:flex;align-items:center;justify-content:center;
      width:30px;height:30px;border-radius:50%;
      background:${cfg.stroke};
      border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,0.25);
    ">${glyph}</div>
  `;
  return wrapper;
}

/* ── Helper: build a colour-preserving SVG route overlay ──
 * Used in focus mode so the route stays vivid while the basemap canvas
 * gets desaturated by CSS `filter: grayscale(1)`. The SVG element lives
 * on the OverlayView pane (DOM, not canvas), so the filter doesn't reach
 * it.
 */
function makeFocusRouteOverlay(opts: {
  path: LatLng[];
  /** Inner stroke (the visible "river"). */
  color: string;
  weight: number;
  /** Outer halo for contrast on grayscale tiles. */
  outline: string;
  outlineWeight: number;
}): google.maps.OverlayView {
  const overlay = new google.maps.OverlayView();
  let svgEl: SVGSVGElement | null = null;
  let outlinePathEl: SVGPathElement | null = null;
  let strokePathEl: SVGPathElement | null = null;

  const updateGeometry = () => {
    const projection = overlay.getProjection();
    if (!projection || !svgEl || !outlinePathEl || !strokePathEl) return;
    if (opts.path.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const projected = opts.path.map((p) =>
      projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng)),
    );
    for (const point of projected) {
      if (!point) continue;
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    const padding = Math.max(opts.weight, opts.outlineWeight) + 8;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const offX = minX - padding;
    const offY = minY - padding;
    svgEl.style.left = `${offX}px`;
    svgEl.style.top = `${offY}px`;
    svgEl.style.width = `${width}px`;
    svgEl.style.height = `${height}px`;
    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const d = projected
      .map((p, i) => {
        const x = (p?.x ?? 0) - offX;
        const y = (p?.y ?? 0) - offY;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    outlinePathEl.setAttribute("d", d);
    strokePathEl.setAttribute("d", d);
  };

  overlay.onAdd = function () {
    const NS = "http://www.w3.org/2000/svg";
    svgEl = document.createElementNS(NS, "svg") as SVGSVGElement;
    svgEl.style.position = "absolute";
    svgEl.style.left = "0";
    svgEl.style.top = "0";
    svgEl.style.pointerEvents = "none";
    svgEl.style.overflow = "visible";

    outlinePathEl = document.createElementNS(NS, "path") as SVGPathElement;
    outlinePathEl.setAttribute("fill", "none");
    outlinePathEl.setAttribute("stroke", opts.outline);
    outlinePathEl.setAttribute("stroke-width", String(opts.outlineWeight));
    outlinePathEl.setAttribute("stroke-linecap", "round");
    outlinePathEl.setAttribute("stroke-linejoin", "round");
    svgEl.appendChild(outlinePathEl);

    strokePathEl = document.createElementNS(NS, "path") as SVGPathElement;
    strokePathEl.setAttribute("fill", "none");
    strokePathEl.setAttribute("stroke", opts.color);
    strokePathEl.setAttribute("stroke-width", String(opts.weight));
    strokePathEl.setAttribute("stroke-linecap", "round");
    strokePathEl.setAttribute("stroke-linejoin", "round");
    svgEl.appendChild(strokePathEl);

    const panes = overlay.getPanes();
    panes?.overlayLayer.appendChild(svgEl);
  };

  overlay.draw = updateGeometry;

  overlay.onRemove = function () {
    if (svgEl?.parentNode) svgEl.parentNode.removeChild(svgEl);
    svgEl = null;
    outlinePathEl = null;
    strokePathEl = null;
  };

  return overlay;
}

/* ── Helper: build a colour-preserving SVG overlay for the risk cells.
 * Same trick as the focus route overlay — DOM-rendered SVG sits in the
 * OverlayView pane and survives the canvas-only grayscale filter.
 */
function makeFocusZonesOverlay(
  cells: Array<{
    polygon: LatLng[];
    fill: string;
    stroke: string;
  }>,
): google.maps.OverlayView {
  const overlay = new google.maps.OverlayView();
  let svgEl: SVGSVGElement | null = null;
  const pathEls: SVGPathElement[] = [];

  overlay.onAdd = function () {
    const NS = "http://www.w3.org/2000/svg";
    svgEl = document.createElementNS(NS, "svg") as SVGSVGElement;
    svgEl.style.position = "absolute";
    svgEl.style.left = "0";
    svgEl.style.top = "0";
    svgEl.style.pointerEvents = "none";
    svgEl.style.overflow = "visible";

    cells.forEach((cell) => {
      const p = document.createElementNS(NS, "path") as SVGPathElement;
      p.setAttribute("fill", cell.fill);
      p.setAttribute("stroke", cell.stroke);
      p.setAttribute("stroke-width", "1.5");
      p.setAttribute("stroke-linejoin", "round");
      svgEl!.appendChild(p);
      pathEls.push(p);
    });

    const panes = overlay.getPanes();
    panes?.overlayLayer.appendChild(svgEl);
  };

  overlay.draw = function () {
    const projection = overlay.getProjection();
    if (!projection || !svgEl || cells.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const projectedCells = cells.map((cell) =>
      cell.polygon.map((p) =>
        projection.fromLatLngToDivPixel(
          new google.maps.LatLng(p.lat, p.lng),
        ),
      ),
    );
    for (const projected of projectedCells) {
      for (const point of projected) {
        if (!point) continue;
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      }
    }
    const padding = 24;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const offX = minX - padding;
    const offY = minY - padding;
    svgEl.style.left = `${offX}px`;
    svgEl.style.top = `${offY}px`;
    svgEl.style.width = `${width}px`;
    svgEl.style.height = `${height}px`;
    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);

    projectedCells.forEach((projected, i) => {
      if (!pathEls[i]) return;
      const d =
        projected
          .map((p, j) => {
            const x = (p?.x ?? 0) - offX;
            const y = (p?.y ?? 0) - offY;
            return `${j === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ") + " Z";
      pathEls[i].setAttribute("d", d);
    });
  };

  overlay.onRemove = function () {
    if (svgEl?.parentNode) svgEl.parentNode.removeChild(svgEl);
    svgEl = null;
    pathEls.length = 0;
  };

  return overlay;
}

/* ── Helper: extract lat/lng from AdvancedMarkerElement position ── */
function getPos(p: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined): { lat: number; lng: number } | null {
  if (!p) return null;
  const lat = typeof (p as google.maps.LatLng).lat === "function" ? (p as google.maps.LatLng).lat() : (p as google.maps.LatLngLiteral).lat;
  const lng = typeof (p as google.maps.LatLng).lng === "function" ? (p as google.maps.LatLng).lng() : (p as google.maps.LatLngLiteral).lng;
  return { lat, lng };
}

function getMarkerDragEndPos(
  event: google.maps.MapMouseEvent,
  marker: google.maps.marker.AdvancedMarkerElement | null | undefined,
): LatLng | null {
  return getPos(event.latLng) ?? getPos(marker?.position);
}

interface MapViewProps {
  routes: RouteOption[];
  showZones: boolean;
  showTraffic: boolean;
  pinMode: PinMode;
  nightMode: boolean;
  focusMode: boolean;
  simulationPoint: LatLng | null;
  simulationHeading: number;
  originCoords?: LatLng | null;
  destCoords?: LatLng | null;
  incidents: Incident[];
  incidentPlacementMode: IncidentPlacementMode;
  onMapPinDrop?: (latlng: LatLng, address: string, mode: PinMode) => void;
  onUserLocationChange?: (latlng: LatLng | null) => void;
  onMarkerDrag?: (latlng: LatLng, address: string, mode: "origin" | "destination") => void;
  onIncidentPlace?: (latlng: LatLng) => void;
  onIncidentRemove?: (id: string) => void;
  /* ── Inspector mode wiring ── */
  /** When provided, replaces the built-in city cells everywhere on the
   * map. Lets slider overrides + paint zones flow through to polygon
   * colors and the click-anywhere breakdown without re-fetching cells. */
  effectiveCells?: RiskCell[];
  /** Open the formula-breakdown InfoWindow on plain map clicks. */
  inspectorEnabled?: boolean;
  /** RiskIncident form of `incidents`, used inside the breakdown. */
  riskIncidents?: RiskIncident[];
  blockingIncidentWeight?: number;
  advisoryIncidentWeight?: number;
  /* ── Paint mode ── */
  paintModeActive?: boolean;
  paintCenter?: LatLng | null;
  paintRadius?: number;
  paintRisk?: number;
  onPaintMapClick?: (latlng: LatLng) => void;
  /** True while a fresh route search is in flight after a drag/repin.
   *  Used to dim the previous route polylines so the user sees the
   *  recalculation is happening. */
  isRebuilding?: boolean;
}

export function MapView({
  routes,
  showZones,
  showTraffic,
  pinMode,
  nightMode,
  focusMode,
  simulationPoint,
  simulationHeading,
  originCoords,
  destCoords,
  incidents,
  incidentPlacementMode,
  onMapPinDrop,
  onUserLocationChange,
  onMarkerDrag,
  onIncidentPlace,
  onIncidentRemove,
  effectiveCells,
  inspectorEnabled = false,
  riskIncidents = [],
  blockingIncidentWeight = 5.0,
  advisoryIncidentWeight = 2.5,
  paintModeActive = false,
  paintCenter = null,
  paintRadius = 250,
  paintRisk = 7,
  onPaintMapClick,
  isRebuilding = false,
}: MapViewProps) {
  const { isLoaded } = useMapsApi();
  const city = useMemo(
    () => getDemoCity(clientEnv.NEXT_PUBLIC_DEMO_CITY),
    [],
  );

  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originPreviewRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destPreviewRef = useRef<any>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const userLocationRef = useRef<LatLng | null>(null);
  const hadRoutesRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incidentMarkersRef = useRef<Map<string, any>>(new Map());
  const incidentCirclesRef = useRef<Map<string, google.maps.Circle>>(new Map());
  const incidentInfoRef = useRef<Map<string, google.maps.InfoWindow>>(
    new Map(),
  );
  const focusOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const focusZonesOverlayRef = useRef<google.maps.OverlayView | null>(null);
  /* Inspector mode refs */
  const inspectorInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const paintPreviewCircleRef = useRef<google.maps.Circle | null>(null);
  /**
   * Snapshot of which click-action modes are currently active.
   * Polygon click listeners (created once per cell) read this ref to
   * decide whether to swallow the click for an InfoWindow or forward
   * it through `handleMapClick` so the user can drop A/B pins,
   * incidents, paint zones, etc. on top of risk zones.
   */
  const interactionModeRef = useRef({
    pin: false,
    incident: false,
    paint: false,
    inspector: false,
  });
  /** Live ref to `handleMapClick` so polygon listeners always call the
   *  current handler instead of a stale closure. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapClickRef = useRef<(e: any) => void>(() => {});
  /**
   * Live snapshot of the camera. Updated on every map `idle` event so we
   * always know where the user is looking *without* triggering a React
   * re-render. Critical because the GoogleMap below uses
   * `key={nightMode ? "dark" : "light"}` to force a full remount on
   * day/night toggle (Google's `colorScheme` is init-only) — and a
   * remount would otherwise reset the camera to city defaults.
   */
  const mapPositionRef = useRef<{ center: LatLng; zoom: number }>({
    center: city.center,
    zoom: city.zoom,
  });
  const [mapInstanceId, setMapInstanceId] = useState(0);

  const reverseGeocode = useCallback(
    (lat: number, lng: number, mode: "origin" | "destination") => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const address =
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onMarkerDrag?.({ lat, lng }, address, mode);
      });
    },
    [onMarkerDrag]
  );

  const handleCenterOnMe = useCallback(() => {
    if (userLocationRef.current && mapRef.current) {
      mapRef.current.panTo(userLocationRef.current);
      mapRef.current.setZoom(15);
    }
  }, []);

  // Updated on every Google Maps `idle` event so we always remember the
  // user's current camera. Cheap (no React state, no re-render).
  const handleMapIdle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    if (c) {
      mapPositionRef.current.center = { lat: c.lat(), lng: c.lng() };
    }
    if (typeof z === "number") {
      mapPositionRef.current.zoom = z;
    }
  }, []);

  /**
   * Camera position to use for the *next* mount of `<GoogleMap>`.
   * Recomputed only on nightMode flips so the remount the day/night
   * toggle triggers can hand the new map the user's last position
   * instead of falling back to `city.center` / `city.zoom`.
   */
  const initialCamera = useMemo(
    () => ({
      center: mapPositionRef.current.center,
      zoom: mapPositionRef.current.zoom,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nightMode],
  );

  // Keep the polygon-listener-facing refs in sync with the live props
  // and the latest `handleMapClick` callback.
  useEffect(() => {
    interactionModeRef.current = {
      pin: !!pinMode,
      incident: !!incidentPlacementMode,
      paint: !!paintModeActive,
      inspector: !!inspectorEnabled,
    };
  }, [pinMode, incidentPlacementMode, paintModeActive, inspectorEnabled]);

  // User location tracking
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        // Don't auto-pan to the user's location: the demo is anchored
        // to a specific city (LA) and people reviewing it from
        // anywhere in the world shouldn't see the map jump to their
        // own continent. The "Center on me" button does this
        // explicitly when the user actually wants it.
        onUserLocationChange?.(loc);

        if (mapRef.current && google.maps.marker?.AdvancedMarkerElement) {
          const position = { lat: loc.lat, lng: loc.lng };
          if (!userMarkerRef.current) {
            userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
              position,
              map: mapRef.current,
              content: createUserLocationEl(),
              zIndex: 16,
              title: "Your location",
            });
          } else {
            userMarkerRef.current.position = position;
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onUserLocationChange, city.center]);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach((m) => {
      google.maps.event.clearInstanceListeners(m);
      m.map = null;
    });
    markersRef.current = [];
  }, []);

  const clearPolygons = useCallback(() => {
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];
    infoWindowsRef.current.forEach((w) => w.close());
    infoWindowsRef.current = [];
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const latlng = { lat, lng };

      // Paint mode wins — user is in the middle of placing a custom
      // risk zone. Single click sets the centre.
      if (paintModeActive && onPaintMapClick) {
        onPaintMapClick(latlng);
        return;
      }

      // Incident placement takes priority next.
      if (incidentPlacementMode && onIncidentPlace) {
        onIncidentPlace(latlng);
        return;
      }

      // Pin drop for origin/destination.
      if (pinMode && onMapPinDrop) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: latlng }, (results, status) => {
          const address =
            status === "OK" && results?.[0]
              ? results[0].formatted_address
              : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          onMapPinDrop(latlng, address, pinMode);
        });
        return;
      }

      // Inspector formula-breakdown popup (only on plain map clicks
      // when no other mode is active).
      if (inspectorEnabled && mapRef.current) {
        const cells = effectiveCells ?? getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY);
        const time: "day" | "night" = nightMode ? "night" : "day";
        const breakdown = computeFormulaBreakdown(
          latlng,
          cells,
          time,
          riskIncidents,
          blockingIncidentWeight,
          advisoryIncidentWeight,
        );
        const html = renderFormulaBreakdownHtml(breakdown);

        if (!inspectorInfoWindowRef.current) {
          inspectorInfoWindowRef.current = new google.maps.InfoWindow({});
        }
        inspectorInfoWindowRef.current.setContent(html);
        inspectorInfoWindowRef.current.setPosition(latlng);
        inspectorInfoWindowRef.current.open(mapRef.current);
      }
    },
    [
      pinMode,
      onMapPinDrop,
      incidentPlacementMode,
      onIncidentPlace,
      paintModeActive,
      onPaintMapClick,
      inspectorEnabled,
      effectiveCells,
      nightMode,
      riskIncidents,
      blockingIncidentWeight,
      advisoryIncidentWeight,
    ],
  );

  // Keep the ref pointed at the freshest `handleMapClick`. Polygon
  // click listeners read this ref so they don't need to be recreated
  // every time the callback changes (which would thrash the polygon
  // pool whenever a slider moves).
  useEffect(() => {
    handleMapClickRef.current = handleMapClick;
  }, [handleMapClick]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({
      draggableCursor:
        pinMode || incidentPlacementMode || paintModeActive
          ? "crosshair"
          : inspectorEnabled
            ? "help"
            : isRebuilding
              ? "wait"
              : undefined,
    });
  }, [
    pinMode,
    incidentPlacementMode,
    paintModeActive,
    inspectorEnabled,
    isRebuilding,
  ]);

  // Preview markers for origin/destination before route search
  useEffect(() => {
    if (!mapRef.current || !google.maps.marker?.AdvancedMarkerElement) return;
    const map = mapRef.current;
    const hasRoutes = routes.length > 0;
    const AME = google.maps.marker.AdvancedMarkerElement;

    // Origin preview marker
    if (originCoords && !hasRoutes) {
      const pos = { lat: originCoords.lat, lng: originCoords.lng };
      if (!originPreviewRef.current) {
        originPreviewRef.current = new AME({
          position: pos,
          map,
          gmpDraggable: true,
          content: createPinElement({ color: "#10b981", label: "A", draggable: true }),
          zIndex: 30,
          title: "Start (drag to move)",
        });
        originPreviewRef.current.addListener("dragend", (event: google.maps.MapMouseEvent) => {
          const p = getMarkerDragEndPos(event, originPreviewRef.current);
          if (p) reverseGeocode(p.lat, p.lng, "origin");
        });
      } else {
        originPreviewRef.current.position = pos;
        originPreviewRef.current.map = map;
      }
    } else {
      if (originPreviewRef.current) originPreviewRef.current.map = null;
      if (hasRoutes) originPreviewRef.current = null;
    }

    // Destination preview marker
    if (destCoords && !hasRoutes) {
      const pos = { lat: destCoords.lat, lng: destCoords.lng };
      if (!destPreviewRef.current) {
        destPreviewRef.current = new AME({
          position: pos,
          map,
          gmpDraggable: true,
          content: createPinElement({ color: "#f43f5e", label: "B", draggable: true }),
          zIndex: 30,
          title: "Destination (drag to move)",
        });
        destPreviewRef.current.addListener("dragend", (event: google.maps.MapMouseEvent) => {
          const p = getMarkerDragEndPos(event, destPreviewRef.current);
          if (p) reverseGeocode(p.lat, p.lng, "destination");
        });
      } else {
        destPreviewRef.current.position = pos;
        destPreviewRef.current.map = map;
      }
    } else {
      if (destPreviewRef.current) destPreviewRef.current.map = null;
      if (hasRoutes) destPreviewRef.current = null;
    }
  }, [originCoords, destCoords, routes, reverseGeocode, mapInstanceId]);

  // Draw routes
  useEffect(() => {
    if (!mapRef.current) return;
    clearPolylines();

    const map = mapRef.current;
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;
    const AME = google.maps.marker?.AdvancedMarkerElement;

    routes.forEach((option) => {
      const isSelected = option.selected;
      // In focus mode hide alternatives entirely; the selected route
      // gets drawn via a colour-preserving SVG overlay (see effect
      // below) so it stays vivid under the grayscale filter.
      if (focusMode && !isSelected) return;

      const opacity = isSelected ? 1 : 0.3;
      const zIndex = isSelected ? 10 : 1;
      const skipCanvasPolyline = focusMode && isSelected;

      option.route.segments.forEach((segment) => {
        const path = segment.path.map((p) => ({ lat: p.lat, lng: p.lng }));

        if (isSelected && !skipCanvasPolyline) {
          const shadow = new google.maps.Polyline({
            path,
            strokeColor: "#000000",
            strokeOpacity: 0.12,
            strokeWeight: 12,
            zIndex: zIndex - 1,
            map,
          });
          polylinesRef.current.push(shadow);
        }

        if (!skipCanvasPolyline) {
          const polyline = new google.maps.Polyline({
            path,
            strokeColor: segment.color,
            strokeOpacity: opacity,
            strokeWeight: isSelected ? 7 : 3,
            zIndex,
            map,
          });
          polylinesRef.current.push(polyline);
        }

        if (isSelected) {
          path.forEach((p) => bounds.extend(p));
          hasBounds = true;
        }
      });

      if (isSelected && option.route.polylinePath.length > 1 && AME) {
        const startPoint = option.route.polylinePath[0];
        const endPoint =
          option.route.polylinePath[option.route.polylinePath.length - 1];

        inspectorLog("event", "map: creating endpoint markers", {
          startPoint: { lat: Number(startPoint.lat.toFixed(5)), lng: Number(startPoint.lng.toFixed(5)) },
          endPoint: { lat: Number(endPoint.lat.toFixed(5)), lng: Number(endPoint.lng.toFixed(5)) },
          category: option.category,
        });

        // Find the map's first overlay child div — needed as fallback
        // attachment point for AME instances. On recent Google Maps
        // versions, AdvancedMarkerElement constructed with
        // `gmpDraggable: true` does NOT auto-attach to the overlay
        // layer (Maps regression — verified manually on production).
        // We force-append below if `.isConnected` stays false after
        // the `.map = map` setter.
        const overlayPane =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((map as any).getDiv?.() as HTMLElement | undefined)
            ?.querySelector(".gm-style")
            ?.querySelector(":scope > div > div") as HTMLElement | null;

        const attachMarker = (marker: google.maps.marker.AdvancedMarkerElement) => {
          marker.map = map;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(marker as any).isConnected && overlayPane) {
            overlayPane.appendChild(marker as unknown as Node);
          }
        };

        const startMarker = new AME({
          position: startPoint,
          gmpDraggable: true,
          content: createRouteEndpointEl("#10b981", "A"),
          zIndex: 20,
          title: "Start (drag to reroute)",
        });
        attachMarker(startMarker);
        startMarker.addListener("dragend", (event: google.maps.MapMouseEvent) => {
          const p = getMarkerDragEndPos(event, startMarker);
          inspectorLog("event", "map: A marker dragend", {
            coords: p ? { lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) } : null,
          });
          if (p) reverseGeocode(p.lat, p.lng, "origin");
        });

        const endMarker = new AME({
          position: endPoint,
          gmpDraggable: true,
          content: createRouteEndpointEl("#f43f5e", "B"),
          zIndex: 20,
          title: "Destination (drag to reroute)",
        });
        attachMarker(endMarker);
        endMarker.addListener("dragend", (event: google.maps.MapMouseEvent) => {
          const p = getMarkerDragEndPos(event, endMarker);
          inspectorLog("event", "map: B marker dragend", {
            coords: p ? { lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) } : null,
          });
          if (p) reverseGeocode(p.lat, p.lng, "destination");
        });

        markersRef.current.push(startMarker, endMarker);
      } else if (isSelected) {
        // Selected route is missing the marker condition — log why so we
        // know whether AME or polylinePath is the culprit on production.
        inspectorLog("warn", "map: skipping marker create for selected route", {
          hasAME: !!AME,
          pathLen: option.route.polylinePath.length,
          category: option.category,
        });
      }
    });

    // Only fitBounds on first route draw, not on drag-rebuild
    const isRebuild = hadRoutesRef.current;
    hadRoutesRef.current = routes.length > 0;

    if (hasBounds && !isRebuild) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [routes, focusMode, clearPolylines, reverseGeocode, mapInstanceId]);

  // ── Focus-mode SVG overlay for the selected route ─────────────────
  // Lives on the OverlayView pane (DOM), so the canvas-only grayscale
  // filter doesn't desaturate it — the route stays in colour while the
  // basemap goes monochrome.
  useEffect(() => {
    if (!mapRef.current) return;

    if (focusOverlayRef.current) {
      focusOverlayRef.current.setMap(null);
      focusOverlayRef.current = null;
    }

    if (!focusMode) return;

    const selected = routes.find((r) => r.selected);
    if (!selected || selected.route.polylinePath.length < 2) return;

    const overlay = makeFocusRouteOverlay({
      path: selected.route.polylinePath,
      // Vivid emerald against the desaturated tiles.
      color: "#22c55e",
      weight: 7,
      outline: "#0f172a",
      outlineWeight: 12,
    });
    overlay.setMap(mapRef.current);
    focusOverlayRef.current = overlay;

    return () => {
      if (focusOverlayRef.current) {
        focusOverlayRef.current.setMap(null);
        focusOverlayRef.current = null;
      }
    };
  }, [focusMode, routes, mapInstanceId]);

  // Draw risk overlay (cells from features/risk, day/night-aware).
  // In focus mode the canvas-based polygons are skipped — they would
  // get desaturated by the grayscale CSS filter; the colour-preserving
  // SVG overlay below renders them instead.
  useEffect(() => {
    if (!mapRef.current) return;
    clearPolygons();

    if (!showZones || focusMode) return;

    const map = mapRef.current;
    const cells =
      effectiveCells ?? getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY);
    const time: "day" | "night" = nightMode ? "night" : "day";

    cells.forEach((cell) => {
      const effective =
        cell.baseDayRisk * (time === "night" ? cell.nightMultiplier : 1);

      const polygon = new google.maps.Polygon({
        paths: cell.polygon.map((p) => ({ lat: p.lat, lng: p.lng })),
        fillColor: effectiveRiskFill(effective),
        fillOpacity: 1,
        strokeColor: effectiveRiskStroke(effective),
        strokeWeight: 1.5,
        strokeOpacity: 1,
        map,
        clickable: true,
        zIndex: 1,
      });

      // Categorical, no numeric scores leaked into the UI.
      const category = riskCategory(effective);
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding:8px 12px;font-family:system-ui,sans-serif;max-width:240px;">
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${cell.label}</div>
            <div style="font-size:12px;color:#555;">${category}</div>
          </div>
        `,
      });

      polygon.addListener("click", (e: google.maps.PolyMouseEvent) => {
        // When any click-action mode is active (drop A/B pin, place
        // incident, paint zone, inspector breakdown), forward the
        // click to the map handler so the polygon doesn't swallow it.
        // Without this, clicking on a risk zone while in pin mode
        // would just open the category InfoWindow and the user's pin
        // would never land.
        const m = interactionModeRef.current;
        if (m.pin || m.incident || m.paint || m.inspector) {
          handleMapClickRef.current(e);
          return;
        }
        infoWindowsRef.current.forEach((w) => w.close());
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });

      polygonsRef.current.push(polygon);
      infoWindowsRef.current.push(infoWindow);
    });
  }, [
    showZones,
    focusMode,
    clearPolygons,
    mapInstanceId,
    nightMode,
    effectiveCells,
  ]);

  // ── Focus-mode SVG overlay for the risk cells ─────────────────────
  // Mirrors the canvas polygons but rendered as DOM SVG, so the
  // grayscale filter on the basemap canvas leaves them in colour.
  useEffect(() => {
    if (!mapRef.current) return;

    if (focusZonesOverlayRef.current) {
      focusZonesOverlayRef.current.setMap(null);
      focusZonesOverlayRef.current = null;
    }

    if (!focusMode || !showZones) return;

    const cells =
      effectiveCells ?? getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY);
    const time: "day" | "night" = nightMode ? "night" : "day";
    const overlay = makeFocusZonesOverlay(
      cells.map((cell) => {
        const effective =
          cell.baseDayRisk *
          (time === "night" ? cell.nightMultiplier : 1);
        return {
          polygon: cell.polygon,
          fill: effectiveRiskFill(effective),
          stroke: effectiveRiskStroke(effective),
        };
      }),
    );
    overlay.setMap(mapRef.current);
    focusZonesOverlayRef.current = overlay;

    return () => {
      if (focusZonesOverlayRef.current) {
        focusZonesOverlayRef.current.setMap(null);
        focusZonesOverlayRef.current = null;
      }
    };
  }, [focusMode, showZones, nightMode, mapInstanceId, effectiveCells]);

  /* ── Paint mode: preview circle while user is placing a zone ── */
  useEffect(() => {
    if (!mapRef.current) return;

    if (!paintModeActive || !paintCenter) {
      if (paintPreviewCircleRef.current) {
        paintPreviewCircleRef.current.setMap(null);
        paintPreviewCircleRef.current = null;
      }
      return;
    }

    const map = mapRef.current;
    const fill = effectiveRiskFill(paintRisk);
    const stroke = effectiveRiskStroke(paintRisk);
    if (!paintPreviewCircleRef.current) {
      paintPreviewCircleRef.current = new google.maps.Circle({
        map,
        center: paintCenter,
        radius: paintRadius,
        fillColor: fill,
        fillOpacity: 0.35,
        strokeColor: stroke,
        strokeWeight: 2.5,
        strokeOpacity: 0.85,
        clickable: false,
        zIndex: 11,
      });
    } else {
      paintPreviewCircleRef.current.setCenter(paintCenter);
      paintPreviewCircleRef.current.setRadius(paintRadius);
      paintPreviewCircleRef.current.setOptions({
        fillColor: fill,
        strokeColor: stroke,
      });
      paintPreviewCircleRef.current.setMap(map);
    }
  }, [paintModeActive, paintCenter, paintRadius, paintRisk, mapInstanceId]);

  // Traffic layer
  useEffect(() => {
    if (!mapRef.current) return;
    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(mapRef.current);
    } else {
      trafficLayerRef.current?.setMap(null);
    }
  }, [showTraffic, mapInstanceId]);

  // Simulation marker
  useEffect(() => {
    if (!mapRef.current) return;
    const AME = google.maps.marker?.AdvancedMarkerElement;

    if (!simulationPoint) {
      if (simMarkerRef.current) simMarkerRef.current.map = null;
      simMarkerRef.current = null;
      return;
    }

    const pos = { lat: simulationPoint.lat, lng: simulationPoint.lng };

    if (!simMarkerRef.current && AME) {
      const el = createSimMarkerEl();
      simMarkerRef.current = new AME({
        position: pos,
        map: mapRef.current,
        content: el,
        zIndex: 26,
      });
    } else if (simMarkerRef.current) {
      simMarkerRef.current.position = pos;
      // Rotate the arrow SVG
      const svg = simMarkerRef.current.content?.querySelector?.("svg");
      if (svg) {
        svg.style.transform = `rotate(${simulationHeading}deg)`;
        svg.style.transition = "transform 0.3s ease";
      }
    }
  }, [simulationPoint, simulationHeading]);

  // ── Incident markers + radius circles ──
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const AME = google.maps.marker?.AdvancedMarkerElement;
    if (!AME) return;

    const incidentMap = incidentMarkersRef.current;
    const circleMap = incidentCirclesRef.current;
    const infoMap = incidentInfoRef.current;

    const seen = new Set<string>();

    incidents.forEach((incident) => {
      seen.add(incident.id);
      const cfg = INCIDENT_TYPES[incident.type];

      // Marker
      let marker = incidentMap.get(incident.id);
      if (!marker) {
        marker = new AME({
          position: incident.center,
          map,
          content: createIncidentEl({ type: incident.type }),
          zIndex: 22,
          title: cfg.label,
        });
        incidentMap.set(incident.id, marker);

        const info = new google.maps.InfoWindow({});
        infoMap.set(incident.id, info);
        marker.addEventListener("gmp-click", () => {
          infoMap.forEach((w) => w.close());
          info.setContent(`
            <div style="padding:6px 8px;font-family:system-ui,sans-serif;max-width:220px;">
              <div style="font-weight:600;font-size:13px;color:#0f172a;">${cfg.label}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">Reported in this area.</div>
              <button id="rm-${incident.id}" style="margin-top:6px;font-size:11px;font-weight:600;color:#be123c;background:none;border:none;cursor:pointer;padding:0;">
                Remove this report
              </button>
            </div>
          `);
          info.setPosition(incident.center);
          info.open(map);
          // Wire the remove button after the InfoWindow is in the DOM.
          google.maps.event.addListenerOnce(info, "domready", () => {
            const btn = document.getElementById(`rm-${incident.id}`);
            btn?.addEventListener("click", () => {
              info.close();
              onIncidentRemove?.(incident.id);
            });
          });
        });
      } else {
        marker.position = incident.center;
        marker.map = map;
      }

      // Radius circle — hidden in focus mode (only the colourful icon
      // remains). Circles are canvas-rendered and would otherwise show
      // up grayscale, polluting the focus look.
      let circle = circleMap.get(incident.id);
      const isFresh = !circle;
      if (!circle) {
        circle = new google.maps.Circle({
          map: focusMode ? null : map,
          center: incident.center,
          radius: incident.radius,
          fillColor: cfg.stroke,
          fillOpacity: 0.16,
          strokeColor: cfg.stroke,
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
          clickable: false,
          zIndex: 5,
        });
        circleMap.set(incident.id, circle);
      } else {
        circle.setCenter(incident.center);
        circle.setRadius(incident.radius);
        circle.setMap(focusMode ? null : map);
      }

      // Brief pulse when an incident first appears — draws the eye to
      // the new radius so investors immediately see what changed.
      if (isFresh && circle) {
        const baseRadius = incident.radius;
        let elapsed = 0;
        const ticks = 6;
        const intervalId = setInterval(() => {
          elapsed += 1;
          if (!circle || elapsed > ticks) {
            clearInterval(intervalId);
            circle?.setRadius(baseRadius);
            circle?.setOptions({ strokeWeight: 1.5 });
            return;
          }
          const phase = elapsed / ticks;
          const pulse = 1 + 0.18 * Math.sin(phase * Math.PI);
          circle.setRadius(baseRadius * pulse);
          circle.setOptions({ strokeWeight: 2.5 - phase });
        }, 120);
      }
    });

    // Drop anything no longer in the prop list.
    incidentMap.forEach((marker, id) => {
      if (seen.has(id)) return;
      marker.map = null;
      incidentMap.delete(id);
      circleMap.get(id)?.setMap(null);
      circleMap.delete(id);
      infoMap.get(id)?.close();
      infoMap.delete(id);
    });
  }, [incidents, focusMode, mapInstanceId, onIncidentRemove]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // Reset refs since map was recreated (e.g. night mode toggle)
    polylinesRef.current = [];
    markersRef.current = [];
    polygonsRef.current = [];
    infoWindowsRef.current = [];
    originPreviewRef.current = null;
    destPreviewRef.current = null;
    userMarkerRef.current = null;
    simMarkerRef.current = null;
    trafficLayerRef.current = null;
    incidentMarkersRef.current.forEach((m) => (m.map = null));
    incidentMarkersRef.current.clear();
    incidentCirclesRef.current.forEach((c) => c.setMap(null));
    incidentCirclesRef.current.clear();
    incidentInfoRef.current.forEach((w) => w.close());
    incidentInfoRef.current.clear();
    if (focusOverlayRef.current) {
      focusOverlayRef.current.setMap(null);
      focusOverlayRef.current = null;
    }
    if (focusZonesOverlayRef.current) {
      focusZonesOverlayRef.current.setMap(null);
      focusZonesOverlayRef.current = null;
    }
    hadRoutesRef.current = false;
    // Increment counter to re-trigger all drawing effects
    setMapInstanceId((prev) => prev + 1);
  }, []);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-slate-500 font-medium">
            Loading map...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Scoped style: applies the grayscale filter ONLY to the basemap
          canvas elements, not to DOM siblings (markers, OverlayView SVG)
          inside the same map container. That way the colour-preserving
          route overlay and AdvancedMarkerElement icons stay vivid. */}
      <style>{`
        .navshield-focus-canvas canvas {
          filter: grayscale(1) contrast(1.05);
          transition: filter 0.3s ease-out;
        }
      `}</style>
      <div
        className={`absolute inset-0 ${focusMode ? "navshield-focus-canvas" : ""}`}
      >
        <GoogleMap
          key={nightMode ? "dark" : "light"}
          mapContainerStyle={MAP_CONTAINER}
          center={initialCamera.center}
          zoom={initialCamera.zoom}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          onIdle={handleMapIdle}
          options={{
            mapId: MAP_ID,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            gestureHandling: "greedy",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colorScheme: nightMode ? "DARK" : "LIGHT" as any,
          }}
        />
      </div>
      <button
        onClick={handleCenterOnMe}
        className="absolute bottom-8 left-4 z-20 w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:shadow-xl transition-all active:scale-95"
        title="Center on my location"
      >
        <Crosshair className="w-5 h-5 text-slate-600" />
      </button>

      {pinMode && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-white/50 py-3.5 px-6 rounded-full flex items-center gap-3.5 animate-fade-in">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div
              className={`absolute inset-0 rounded-full animate-ping opacity-75 ${
                pinMode === "origin" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <div
              className={`relative w-3 h-3 rounded-full shadow-md ${
                pinMode === "origin" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </div>
          <span className="font-semibold text-slate-700 text-[15px]">
            Click on the map to set{" "}
            {pinMode === "origin" ? "starting point" : "destination"}
          </span>
        </div>
      )}

      {incidentPlacementMode && !pinMode && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-white/50 py-3.5 px-6 rounded-full flex items-center gap-3.5 animate-fade-in">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-75"
              style={{
                backgroundColor: INCIDENT_TYPES[incidentPlacementMode].stroke,
              }}
            />
            <div
              className="relative w-3 h-3 rounded-full shadow-md"
              style={{
                backgroundColor: INCIDENT_TYPES[incidentPlacementMode].stroke,
              }}
            />
          </div>
          <span className="font-semibold text-slate-700 text-[15px]">
            Click on the map to mark a{" "}
            {INCIDENT_TYPES[incidentPlacementMode].shortLabel.toLowerCase()}
          </span>
        </div>
      )}
    </>
  );
}
