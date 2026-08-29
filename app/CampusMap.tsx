"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Polygon } from "geojson";
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

type CampusBuildingProperties = {
  color: string;
  height: number;
};

const CORNELL_TECH_BUILDINGS: FeatureCollection<
  Polygon,
  CampusBuildingProperties
> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { color: "#ff5e42", height: 19 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.9564312, 40.755795], [-73.9559484, 40.7563111],
          [-73.9558947, 40.7562786], [-73.9558411, 40.7562542],
          [-73.9558786, 40.7562095], [-73.955884, 40.7562014],
          [-73.9558893, 40.7561892], [-73.9559376, 40.7559738],
          [-73.9559215, 40.7559007], [-73.9559162, 40.7558763],
          [-73.9559162, 40.7558641], [-73.9559698, 40.7557991],
          [-73.9559752, 40.7557828], [-73.9559913, 40.7554699],
          [-73.9559966, 40.7554537], [-73.9560074, 40.7554455],
          [-73.9560932, 40.7554293], [-73.9560932, 40.7554171],
          [-73.9561039, 40.755409], [-73.9562005, 40.7553765],
          [-73.9562166, 40.7553683], [-73.956297, 40.7552789],
          [-73.9563078, 40.7552667], [-73.9563346, 40.7552627],
          [-73.9565492, 40.7552789], [-73.9564312, 40.7553683],
          [-73.9566189, 40.7553399], [-73.9566511, 40.7553521],
          [-73.9566779, 40.7553724], [-73.9566833, 40.7553927],
          [-73.9567423, 40.7554008], [-73.9566779, 40.7554577],
          [-73.9566725, 40.7555431], [-73.9566618, 40.7555756],
          [-73.9566457, 40.7555959], [-73.9566243, 40.7556162],
          [-73.9564633, 40.7557137], [-73.9564526, 40.75573],
          [-73.9564419, 40.7557788], [-73.9564312, 40.755795],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { color: "#f5c84c", height: 19 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.9550686, 40.7554943], [-73.9549506, 40.7554943],
          [-73.9549667, 40.755474], [-73.9550686, 40.7553602],
          [-73.9552188, 40.7553399], [-73.9552242, 40.7552017],
          [-73.9551705, 40.7551773], [-73.9553529, 40.7549701],
          [-73.9553744, 40.7549498], [-73.9559591, 40.7549498],
          [-73.9559323, 40.7550148], [-73.9558464, 40.7550636],
          [-73.9557981, 40.755088], [-73.9557981, 40.7551286],
          [-73.9557928, 40.7552789], [-73.9558572, 40.7552708],
          [-73.955825, 40.755344], [-73.9557499, 40.7554984],
          [-73.9557123, 40.7554984], [-73.9556801, 40.7554984],
          [-73.9551705, 40.7554943], [-73.9551008, 40.7554943],
          [-73.9550793, 40.7554943], [-73.9550686, 40.7554943],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { color: "#56c8df", height: 83 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.9552456, 40.75573], [-73.9552456, 40.7558641],
          [-73.9551061, 40.7558641], [-73.9547199, 40.7558682],
          [-73.9547038, 40.7558682], [-73.9545697, 40.7558356],
          [-73.9545697, 40.7557788], [-73.9546555, 40.7556772],
          [-73.9549613, 40.7556772], [-73.9550847, 40.7557015],
          [-73.9550847, 40.7557178], [-73.9552456, 40.75573],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { color: "#b58bdd", height: 66 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.9556479, 40.7563964], [-73.9552885, 40.7562176],
          [-73.9552778, 40.7562054], [-73.9552671, 40.7561526],
          [-73.9552724, 40.7560551], [-73.9552993, 40.7560469],
          [-73.9553314, 40.7560469], [-73.9553529, 40.756051],
          [-73.9555031, 40.7561526], [-73.9556104, 40.7562298],
          [-73.9556372, 40.7562583], [-73.9556587, 40.7562989],
          [-73.9556909, 40.7563761], [-73.9556479, 40.7563964],
        ]],
      },
    },
  ],
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
        // The source combines the two low-rise campus buildings into one
        // feature. Exclude those base features before drawing their precise,
        // individually colored replacements below.
        filter: [
          "all",
          ["!=", ["get", "hide_3d"], true],
          [
            "!",
            [
              "in",
              ["id"],
              ["literal", [266199261, 524729284, 922315193]],
            ],
          ],
        ],
        paint: {
          "fill-extrusion-color": [
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
            "#8eace5",
            6,
            "#8dca9a",
            "#bedc45",
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

      map.addSource("ct-campus-buildings", {
        type: "geojson",
        data: CORNELL_TECH_BUILDINGS,
      });

      map.addLayer({
        id: "ct-campus-highlighted-buildings",
        type: "fill-extrusion",
        source: "ct-campus-buildings",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
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
