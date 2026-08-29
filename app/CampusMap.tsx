"use client";

import { useEffect, useRef, useState } from "react";
import { Map, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

const CAMERA_TARGET: [number, number] = [-73.9571674, 40.7545844];
const LOOK_AT_TARGET: [number, number] = [-73.9550837, 40.7559414];

const CAMERA_DURATION = 9000;
const LOADING_HOLD_DURATION = 250;
const EYE_HEIGHT = 1.7;
const LOOK_AT_HEIGHT = 35;
const START_HEIGHT = 320;
const START_RADIUS = 1630;
const ORBIT_TURNS = 0.5;
const FINAL_LEFT_YAW = 3;
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
  const finalEast =
    (CAMERA_TARGET[0] - LOOK_AT_TARGET[0]) * metersPerLongitudeDegree;
  const finalNorth =
    (CAMERA_TARGET[1] - LOOK_AT_TARGET[1]) * METERS_PER_LATITUDE_DEGREE;
  const endRadius = Math.hypot(finalEast, finalNorth);
  const endAngle = Math.atan2(finalNorth, finalEast);
  const radius = START_RADIUS + (endRadius - START_RADIUS) * progress;
  const angle = endAngle - (1 - progress) * ORBIT_TURNS * Math.PI * 2;
  return [
    LOOK_AT_TARGET[0] +
      (Math.cos(angle) * radius) / metersPerLongitudeDegree,
    LOOK_AT_TARGET[1] +
      (Math.sin(angle) * radius) / METERS_PER_LATITUDE_DEGREE,
  ];
}

function getYawAdjustedTarget(
  cameraPosition: [number, number],
  leftYaw: number,
): [number, number] {
  const metersPerLongitudeDegree =
    METERS_PER_LATITUDE_DEGREE *
    Math.cos((cameraPosition[1] * Math.PI) / 180);
  const east =
    (LOOK_AT_TARGET[0] - cameraPosition[0]) * metersPerLongitudeDegree;
  const north =
    (LOOK_AT_TARGET[1] - cameraPosition[1]) * METERS_PER_LATITUDE_DEGREE;
  const yawRadians = (leftYaw * Math.PI) / 180;
  const adjustedEast =
    east * Math.cos(yawRadians) - north * Math.sin(yawRadians);
  const adjustedNorth =
    east * Math.sin(yawRadians) + north * Math.cos(yawRadians);

  return [
    cameraPosition[0] + adjustedEast / metersPerLongitudeDegree,
    cameraPosition[1] + adjustedNorth / METERS_PER_LATITUDE_DEGREE,
  ];
}

export function CampusMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapStatus, setMapStatus] = useState("loading");
  const [loadingScreenPhase, setLoadingScreenPhase] = useState<
    "visible" | "leaving" | "hidden"
  >("visible");

  useEffect(() => {
    if (mapStatus === "unavailable") {
      setLoadingScreenPhase("hidden");
      return;
    }

    if (mapStatus !== "ready") {
      return;
    }

    setLoadingScreenPhase("leaving");
    const timeout = window.setTimeout(() => {
      setLoadingScreenPhase("hidden");
    }, 420);

    return () => window.clearTimeout(timeout);
  }, [mapStatus]);

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
    let cameraStartTimeout: number | undefined;

    const getCameraView = (progress: number) => {
      const cameraPosition = getCameraPosition(progress);
      const eyeHeight = START_HEIGHT + (EYE_HEIGHT - START_HEIGHT) * progress;
      const lookAtTarget = getYawAdjustedTarget(
        cameraPosition,
        FINAL_LEFT_YAW * progress,
      );

      return map.calculateCameraOptionsFromTo(
        cameraPosition,
        eyeHeight,
        lookAtTarget,
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
            "#ff5e42",
            5247278702,
            "#f5c84c",
            5247292842,
            "#56c8df",
            9223151932,
            "#b58bdd",
            "#b9b5aa",
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

      // `idle` means the style, source data, and layers have settled. Waiting
      // here prevents an unfinished map frame from appearing before the intro.
      map.once("idle", () => {
        cameraStartTimeout = window.setTimeout(() => {
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
        }, LOADING_HOLD_DURATION);
      });
    });

    map.on("error", () => {
      setMapStatus("unavailable");
    });

    return () => {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (cameraStartTimeout !== undefined) {
        window.clearTimeout(cameraStartTimeout);
      }
      map.remove();
    };
  }, []);

  return (
    <div className="map-wrap">
      <div className="map-canvas" ref={containerRef} />
      {loadingScreenPhase !== "hidden" && (
        <div
          className={`loading-screen loading-screen--${loadingScreenPhase}`}
          aria-live="polite"
          aria-label="Loading campus world"
        >
          <div className="loading-screen__content">
            <p>LOADING WORLD</p>
            <div className="loading-screen__track" aria-hidden="true">
              <span className="loading-screen__bar" />
            </div>
          </div>
        </div>
      )}
      {mapStatus === "unavailable" && (
        <p className="map-status">MAP DATA UNAVAILABLE</p>
      )}
    </div>
  );
}
