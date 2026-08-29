"use client";

import { useEffect, useRef, useState } from "react";
import { Map, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

const CAMERA_TARGET: [number, number] = [-73.9571674, 40.7545844];
const LOOK_AT_TARGET: [number, number] = [-73.9550837, 40.7559414];

const CAMERA_DURATION = 9000;
const EYE_HEIGHT = 1.7;
const LOOK_AT_HEIGHT = 35;
const START_HEIGHT = 320;
const START_RADIUS = 1630;
const ORBIT_TURNS = 0.5;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
type StyleLayer = {
  id: string;
  type: string;
  source?: string;
  "source-layer"?: string;
};

function easeOut(progress: number) {
  return 1 - (1 - progress) ** 1.65;
}

function getCameraPosition(progress: number): [number, number] {
  const metersPerLongitudeDegree =
    METERS_PER_LATITUDE_DEGREE * Math.cos((LOOK_AT_TARGET[1] * Math.PI) / 180);
  const endEast =
    (CAMERA_TARGET[0] - LOOK_AT_TARGET[0]) * metersPerLongitudeDegree;
  const endNorth =
    (CAMERA_TARGET[1] - LOOK_AT_TARGET[1]) * METERS_PER_LATITUDE_DEGREE;
  const endRadius = Math.hypot(endEast, endNorth);
  const endAngle = Math.atan2(endNorth, endEast);
  const radius = START_RADIUS + (endRadius - START_RADIUS) * progress;
  const angle = endAngle - (1 - progress) * ORBIT_TURNS * Math.PI * 2;

  return [
    LOOK_AT_TARGET[0] +
      (Math.cos(angle) * radius) / metersPerLongitudeDegree,
    LOOK_AT_TARGET[1] +
      (Math.sin(angle) * radius) / METERS_PER_LATITUDE_DEGREE,
  ];
}

export function CampusMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapStatus, setMapStatus] = useState("loading");

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setWorkerUrl(maplibreWorkerUrl);

    const map = new Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: LOOK_AT_TARGET,
      zoom: 16,
      maxPitch: 180,
      centerClampedToGround: false,
      interactive: false,
      attributionControl: { compact: true },
    });
    let animationFrame: number | undefined;

    const getCameraView = (progress: number) => {
      const cameraPosition = getCameraPosition(progress);
      const eyeHeight = START_HEIGHT + (EYE_HEIGHT - START_HEIGHT) * progress;

      return map.calculateCameraOptionsFromTo(
        cameraPosition,
        eyeHeight,
        LOOK_AT_TARGET,
        LOOK_AT_HEIGHT,
      );
    };

    map.on("style.load", () => {
      const layers = (map.getStyle().layers ?? []) as StyleLayer[];
      const buildingLayer = layers.find(
        (layer) => layer["source-layer"] === "building" && layer.source,
      );

      if (!buildingLayer?.source) {
        setMapStatus("unavailable");
        return;
      }

      for (const layer of layers) {
        const isBaseLayer =
          layer.type === "background" ||
          layer["source-layer"] === "water" ||
          layer["source-layer"] === "waterway" ||
          layer["source-layer"] === "landcover" ||
          layer["source-layer"] === "landuse" ||
          layer["source-layer"] === "park";

        if (!isBaseLayer) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      map.addLayer({
        id: "ct-campus-grass",
        type: "fill",
        source: buildingLayer.source,
        "source-layer": "landcover",
        filter: [
          "any",
          ["in", "class", "grass", "wood"],
          ["==", "subclass", "recreation_ground"],
        ],
        paint: {
          "fill-color": "#d5e4a8",
          "fill-opacity": 0.88,
        },
      });

      map.addLayer({
        id: "ct-campus-grounds",
        type: "fill",
        source: buildingLayer.source,
        "source-layer": "landuse",
        filter: ["in", "class", "university", "pitch", "playground"],
        paint: {
          "fill-color": "#c8dda0",
          "fill-opacity": 0.84,
        },
      });

      map.addLayer({
        id: "ct-campus-paths",
        type: "line",
        source: buildingLayer.source,
        "source-layer": "transportation",
        filter: ["in", "class", "path", "track", "service", "minor"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f6f1df",
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 16, 1.4, 18, 2.8],
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "ct-campus-clay-buildings",
        type: "fill-extrusion",
        source: buildingLayer.source,
        "source-layer": "building",
        minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": [
            "match",
            ["id"],
            7003806092,
            "#e68267",
            5247278702,
            "#e7b75b",
            5247292842,
            "#76c7d0",
            9223151932,
            "#d6a7d8",
            [
              "match",
              ["%", ["to-number", ["id"], 0], 7],
              0,
              "#bedc45",
              1,
              "#e68267",
              2,
              "#76c7d0",
              3,
              "#d6a7d8",
              4,
              "#e7b75b",
              5,
              "#8dca9a",
              6,
              "#8eace5",
              "#bedc45",
            ],
          ],
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            ["get", "height"],
            8,
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            ["get", "min_height"],
            0,
          ],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": false,
        },
      });

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      map.once("render", () => {
        if (reducedMotion) {
          map.jumpTo(getCameraView(1));
        } else {
          const startedAt = performance.now();

          const animate = (now: number) => {
            const progress = Math.min((now - startedAt) / CAMERA_DURATION, 1);
            map.jumpTo(getCameraView(easeOut(progress)));

            if (progress < 1) {
              animationFrame = window.requestAnimationFrame(animate);
            }
          };

          animationFrame = window.requestAnimationFrame(animate);
        }

        setMapStatus("ready");
      });
    });

    map.on("error", () => {
      setMapStatus("unavailable");
    });

    return () => {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      map.remove();
    };
  }, []);

  return (
    <div className="map-wrap">
      <div className="map-canvas" ref={containerRef} />
      {mapStatus === "loading" && <p className="map-status">LOADING CAMPUS MASSING</p>}
      {mapStatus === "unavailable" && (
        <p className="map-status">MAP DATA UNAVAILABLE</p>
      )}
    </div>
  );
}
