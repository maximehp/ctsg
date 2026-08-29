"use client";

import { useEffect, useRef, useState } from "react";
import { Map } from "maplibre-gl";

const CAMERA_TARGET: [number, number] = [-73.9571674, 40.7545844];
const LOOK_AT_TARGET: [number, number] = [-73.9550837, 40.7559414];

const CAMERA_DURATION = 9000;
const EYE_HEIGHT = 1.7;
const LOOK_AT_HEIGHT = 35;
const START_HEIGHT = 320;
const START_RADIUS = 1630;
const ORBIT_TURNS = 0.5;
const METERS_PER_LATITUDE_DEGREE = 111_320;

type MapStatus = "loading" | "launching" | "ready" | "unavailable";

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
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: LOOK_AT_TARGET,
      zoom: 16,
      maxPitch: 180,
      centerClampedToGround: false,
      interactive: false,
      attributionControl: { compact: true },
    });
    let animationFrame: number | undefined;
    let loaderReleaseTimeout: number | undefined;
    let hasLaunched = false;
    const loaderShownAt = performance.now();

    const startExperience = (onReady: () => void) => {
      if (hasLaunched) {
        return;
      }

      hasLaunched = true;
      loaderReleaseTimeout = window.setTimeout(() => {
        setMapStatus("launching");
        loaderReleaseTimeout = window.setTimeout(() => {
          setMapStatus("ready");
          onReady();
        }, 280);
      }, Math.max(0, 680 - (performance.now() - loaderShownAt)));
    };

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

    map.once("style.load", () => {
      const layers = (map.getStyle().layers ?? []) as StyleLayer[];
      const buildingLayer = layers.find(
        (layer) => layer["source-layer"] === "building" && layer.source,
      );
      const buildingSource = buildingLayer?.source;

      if (!buildingSource) {
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
        id: "ct-campus-clay-buildings",
        type: "fill-extrusion",
        source: buildingSource,
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
          startExperience(() => {
            map.jumpTo(getCameraView(1));
          });
          return;
        }

        startExperience(() => {
          const startedAt = performance.now();

          const animate = (now: number) => {
            const progress = Math.min((now - startedAt) / CAMERA_DURATION, 1);
            map.jumpTo(getCameraView(easeOut(progress)));

            if (progress < 1) {
              animationFrame = window.requestAnimationFrame(animate);
            }
          };

          animationFrame = window.requestAnimationFrame(animate);
        });
      });
    });

    return () => {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (loaderReleaseTimeout !== undefined) {
        window.clearTimeout(loaderReleaseTimeout);
      }
      map.remove();
    };
  }, []);

  return (
    <div className="map-wrap">
      <div className="map-canvas" ref={containerRef} />
      {mapStatus !== "ready" && mapStatus !== "unavailable" && (
        <div
          className={`map-loader${mapStatus === "launching" ? " map-loader--releasing" : ""}`}
          role="status"
          aria-live="polite"
        >
          <div className="map-loader-card">
            <p className="map-loader-kicker">CTSG / 2026</p>
            <p className="map-loader-title">LOADING CAMPUS STUDY</p>
            <div className="map-loader-track" aria-hidden="true">
              <span className="map-loader-fill" />
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
