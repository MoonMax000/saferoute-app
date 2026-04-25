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
import type { Incident, IncidentPlacementMode } from "@/features/incidents";
import { INCIDENT_TYPES } from "@/features/incidents";
import { clientEnv } from "@/lib/env";
import { getDemoCity, useMapsApi } from "@/lib/google";

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

/* ── Helper: extract lat/lng from AdvancedMarkerElement position ── */
function getPos(p: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined): { lat: number; lng: number } | null {
  if (!p) return null;
  const lat = typeof (p as google.maps.LatLng).lat === "function" ? (p as google.maps.LatLng).lat() : (p as google.maps.LatLngLiteral).lat;
  const lng = typeof (p as google.maps.LatLng).lng === "function" ? (p as google.maps.LatLng).lng() : (p as google.maps.LatLngLiteral).lng;
  return { lat, lng };
}

interface MapViewProps {
  routes: RouteOption[];
  showZones: boolean;
  showTraffic: boolean;
  pinMode: PinMode;
  nightMode: boolean;
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
}

export function MapView({
  routes,
  showZones,
  showTraffic,
  pinMode,
  nightMode,
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
  const [mapCenter, setMapCenter] = useState<LatLng>(city.center);
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

  // User location tracking
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        setMapCenter((prev) => {
          if (prev === city.center) return loc;
          return prev;
        });
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
    markersRef.current.forEach((m) => { m.map = null; });
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

      // Incident placement takes priority — once active the user is
      // committed to either placing or cancelling.
      if (incidentPlacementMode && onIncidentPlace) {
        onIncidentPlace({ lat, lng });
        return;
      }

      if (!pinMode || !onMapPinDrop) return;

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const address =
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onMapPinDrop({ lat, lng }, address, pinMode);
      });
    },
    [pinMode, onMapPinDrop, incidentPlacementMode, onIncidentPlace],
  );

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({
      draggableCursor:
        pinMode || incidentPlacementMode ? "crosshair" : undefined,
    });
  }, [pinMode, incidentPlacementMode]);

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
        originPreviewRef.current.addEventListener("gmp-dragend", () => {
          const p = getPos(originPreviewRef.current?.position);
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
        destPreviewRef.current.addEventListener("gmp-dragend", () => {
          const p = getPos(destPreviewRef.current?.position);
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
      const opacity = isSelected ? 1 : 0.3;
      const zIndex = isSelected ? 10 : 1;

      option.route.segments.forEach((segment) => {
        const path = segment.path.map((p) => ({ lat: p.lat, lng: p.lng }));

        if (isSelected) {
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

        const polyline = new google.maps.Polyline({
          path,
          strokeColor: segment.color,
          strokeOpacity: opacity,
          strokeWeight: isSelected ? 7 : 3,
          zIndex,
          map,
        });
        polylinesRef.current.push(polyline);

        if (isSelected) {
          path.forEach((p) => bounds.extend(p));
          hasBounds = true;
        }
      });

      if (isSelected && option.route.polylinePath.length > 1 && AME) {
        const startPoint = option.route.polylinePath[0];
        const endPoint =
          option.route.polylinePath[option.route.polylinePath.length - 1];

        const startMarker = new AME({
          position: startPoint,
          map,
          gmpDraggable: true,
          content: createRouteEndpointEl("#10b981", "A"),
          zIndex: 20,
          title: "Start (drag to reroute)",
        });
        startMarker.addEventListener("gmp-dragend", () => {
          const p = getPos(startMarker.position);
          if (p) reverseGeocode(p.lat, p.lng, "origin");
        });

        const endMarker = new AME({
          position: endPoint,
          map,
          gmpDraggable: true,
          content: createRouteEndpointEl("#f43f5e", "B"),
          zIndex: 20,
          title: "Destination (drag to reroute)",
        });
        endMarker.addEventListener("gmp-dragend", () => {
          const p = getPos(endMarker.position);
          if (p) reverseGeocode(p.lat, p.lng, "destination");
        });

        markersRef.current.push(startMarker, endMarker);
      }
    });

    // Only fitBounds on first route draw, not on drag-rebuild
    const isRebuild = hadRoutesRef.current;
    hadRoutesRef.current = routes.length > 0;

    if (hasBounds && !isRebuild) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [routes, clearPolylines, reverseGeocode, mapInstanceId]);

  // Draw risk overlay (cells from features/risk, day/night-aware)
  useEffect(() => {
    if (!mapRef.current) return;
    clearPolygons();

    if (!showZones) return;

    const map = mapRef.current;
    const cells = getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY);
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
        infoWindowsRef.current.forEach((w) => w.close());
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });

      polygonsRef.current.push(polygon);
      infoWindowsRef.current.push(infoWindow);
    });
  }, [showZones, clearPolygons, mapInstanceId, nightMode]);

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

      // Radius circle
      let circle = circleMap.get(incident.id);
      if (!circle) {
        circle = new google.maps.Circle({
          map,
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
        circle.setMap(map);
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
  }, [incidents, mapInstanceId, onIncidentRemove]);

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
      <GoogleMap
        key={nightMode ? "dark" : "light"}
        mapContainerStyle={MAP_CONTAINER}
        center={mapCenter}
        zoom={city.zoom}
        onLoad={onMapLoad}
        onClick={handleMapClick}
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
