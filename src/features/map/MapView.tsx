"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { Crosshair } from "lucide-react";
import type { LatLng } from "@/shared/types";
import type { RouteOption } from "@/features/routing";
import {
  getZones,
  getZoneFillColor,
  getZoneStrokeColor,
  getRiskColor,
} from "@/features/zones";

const MAP_CONTAINER = { width: "100%", height: "100%" };
const DEFAULT_CENTER = { lat: 40.7484, lng: -73.9857 };
const DEFAULT_ZOOM = 13;

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

const DAY_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e4" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#f0f0f0" }] },
];

const NIGHT_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a4e" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5568" }] },
];

export type PinMode = "origin" | "destination" | null;

interface MapViewProps {
  routes: RouteOption[];
  showZones: boolean;
  pinMode: PinMode;
  nightMode: boolean;
  simulationPoint: LatLng | null;
  simulationHeading: number;
  originCoords?: LatLng | null;
  destCoords?: LatLng | null;
  onMapPinDrop?: (latlng: LatLng, address: string, mode: PinMode) => void;
  onUserLocationChange?: (latlng: LatLng | null) => void;
}

export function MapView({
  routes,
  showZones,
  pinMode,
  nightMode,
  simulationPoint,
  simulationHeading,
  originCoords,
  destCoords,
  onMapPinDrop,
  onUserLocationChange,
}: MapViewProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const userPulseRef = useRef<google.maps.Marker | null>(null);
  const simMarkerRef = useRef<google.maps.Marker | null>(null);
  const simPulseRef = useRef<google.maps.Marker | null>(null);
  const originPreviewRef = useRef<google.maps.Marker | null>(null);
  const destPreviewRef = useRef<google.maps.Marker | null>(null);
  const userLocationRef = useRef<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapReady, setMapReady] = useState(false);

  const handleCenterOnMe = useCallback(() => {
    if (userLocationRef.current && mapRef.current) {
      mapRef.current.panTo(userLocationRef.current);
      mapRef.current.setZoom(15);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        setMapCenter((prev) => {
          if (prev === DEFAULT_CENTER) return loc;
          return prev;
        });
        onUserLocationChange?.(loc);

        if (mapRef.current) {
          const position = new google.maps.LatLng(loc.lat, loc.lng);
          if (!userMarkerRef.current) {
            userPulseRef.current = new google.maps.Marker({
              position,
              map: mapRef.current,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 20,
                fillColor: "#3b82f6",
                fillOpacity: 0.15,
                strokeColor: "#3b82f6",
                strokeOpacity: 0.3,
                strokeWeight: 1,
              },
              zIndex: 15,
              clickable: false,
            });
            userMarkerRef.current = new google.maps.Marker({
              position,
              map: mapRef.current,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#3b82f6",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              },
              zIndex: 16,
              title: "Your location",
            });
          } else {
            userMarkerRef.current.setPosition(position);
            userPulseRef.current?.setPosition(position);
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onUserLocationChange]);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
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
      if (!pinMode || !e.latLng || !onMapPinDrop) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const address =
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onMapPinDrop({ lat, lng }, address, pinMode);
      });
    },
    [pinMode, onMapPinDrop]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({
      draggableCursor: pinMode ? "crosshair" : undefined,
    });
  }, [pinMode]);

  // Preview markers for origin/destination before route search
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const hasRoutes = routes.length > 0;

    // Origin preview marker
    if (originCoords && !hasRoutes) {
      const pos = new google.maps.LatLng(originCoords.lat, originCoords.lng);
      if (!originPreviewRef.current) {
        originPreviewRef.current = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 2,
            anchor: new google.maps.Point(12, 24),
          },
          zIndex: 30,
          title: "Start",
          animation: google.maps.Animation.DROP,
        });
      } else {
        originPreviewRef.current.setPosition(pos);
        originPreviewRef.current.setMap(map);
      }
    } else {
      originPreviewRef.current?.setMap(null);
      if (hasRoutes) originPreviewRef.current = null;
    }

    // Destination preview marker
    if (destCoords && !hasRoutes) {
      const pos = new google.maps.LatLng(destCoords.lat, destCoords.lng);
      if (!destPreviewRef.current) {
        destPreviewRef.current = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
            fillColor: "#f43f5e",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 2,
            anchor: new google.maps.Point(12, 24),
          },
          zIndex: 30,
          title: "Destination",
          animation: google.maps.Animation.DROP,
        });
      } else {
        destPreviewRef.current.setPosition(pos);
        destPreviewRef.current.setMap(map);
      }
    } else {
      destPreviewRef.current?.setMap(null);
      if (hasRoutes) destPreviewRef.current = null;
    }
  }, [originCoords, destCoords, routes]);

  // Draw routes
  useEffect(() => {
    if (!mapRef.current) return;
    clearPolylines();

    const map = mapRef.current;
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

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

      if (isSelected && option.route.polylinePath.length > 1) {
        const startPoint = option.route.polylinePath[0];
        const endPoint =
          option.route.polylinePath[option.route.polylinePath.length - 1];

        const startMarker = new google.maps.Marker({
          position: startPoint,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          zIndex: 20,
          title: "Start",
        });

        const endMarker = new google.maps.Marker({
          position: endPoint,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#f43f5e",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          zIndex: 20,
          title: "Destination",
        });

        markersRef.current.push(startMarker, endMarker);
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [routes, clearPolylines]);

  // Draw risk zone polygons
  useEffect(() => {
    if (!mapRef.current) return;
    clearPolygons();

    if (!showZones) return;

    const map = mapRef.current;
    const zones = getZones();

    zones.forEach((zone) => {
      if (!zone.polygon) return;

      const polygon = new google.maps.Polygon({
        paths: zone.polygon.map((p) => ({ lat: p.lat, lng: p.lng })),
        fillColor: getZoneFillColor(zone.riskLevel),
        fillOpacity: 1,
        strokeColor: getZoneStrokeColor(zone.riskLevel),
        strokeWeight: 2,
        strokeOpacity: 1,
        map,
        clickable: true,
        zIndex: 1,
      });

      const riskColor = getRiskColor(zone.riskLevel);
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding:8px 12px;font-family:system-ui,sans-serif;">
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${zone.label}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${riskColor}"></span>
              <span style="font-size:13px;color:#555">Risk: ${zone.riskLevel}/10</span>
            </div>
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
  }, [showZones, clearPolygons, mapReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: nightMode ? NIGHT_STYLES : DAY_STYLES });
  }, [nightMode]);

  // Simulation marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (!simulationPoint) {
      simMarkerRef.current?.setMap(null);
      simPulseRef.current?.setMap(null);
      simMarkerRef.current = null;
      simPulseRef.current = null;
      return;
    }

    const pos = new google.maps.LatLng(simulationPoint.lat, simulationPoint.lng);

    if (!simMarkerRef.current) {
      simPulseRef.current = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 24,
          fillColor: "#6366f1",
          fillOpacity: 0.2,
          strokeColor: "#6366f1",
          strokeOpacity: 0.4,
          strokeWeight: 2,
        },
        zIndex: 25,
        clickable: false,
      });
      simMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#6366f1",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          rotation: simulationHeading,
        },
        zIndex: 26,
      });
    } else {
      simMarkerRef.current.setPosition(pos);
      simPulseRef.current?.setPosition(pos);
      const icon = simMarkerRef.current.getIcon() as google.maps.Symbol;
      if (icon) {
        simMarkerRef.current.setIcon({ ...icon, rotation: simulationHeading });
      }
    }
  }, [simulationPoint, simulationHeading]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
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
        mapContainerStyle={MAP_CONTAINER}
        center={mapCenter}
        zoom={DEFAULT_ZOOM}
        onLoad={onMapLoad}
        onClick={handleMapClick}
        options={{
          styles: nightMode ? NIGHT_STYLES : DAY_STYLES,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
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
    </>
  );
}
