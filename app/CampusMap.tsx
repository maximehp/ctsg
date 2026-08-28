"use client";

import { useEffect, useRef, useState } from "react";
import { Map } from "maplibre-gl";
import type {
  VantaRingsEffect,
  VantaRingsFactory,
} from "vanta/dist/vanta.rings.min";

const CAMERA_TARGET: [number, number] = [-73.9571674, 40.7545844];
const LOOK_AT_TARGET: [number, number] = [-73.9550837, 40.7559414];

const CAMERA_DURATION = 9000;
const EYE_HEIGHT = 1.7;
const LOOK_AT_HEIGHT = 35;
const START_HEIGHT = 320;
const START_RADIUS = 1630;
const ORBIT_TURNS = 0.5;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const RINGS_ANCHOR: [number, number] = LOOK_AT_TARGET;

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
  const ringsRef = useRef<HTMLDivElement | null>(null);
  const [mapStatus, setMapStatus] = useState("loading");

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
    let ringsEffect: VantaRingsEffect | undefined;
    let syncRingsToScene: (() => void) | undefined;
    let isDisposed = false;

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

    map.on("load", () => {
      const layers = (map.getStyle().layers ?? []) as StyleLayer[];
      const buildingLayer = layers.find(
        (layer) => layer["source-layer"] === "building" && layer.source,
      );
      const backgroundLayer = layers.find((layer) => layer.type === "background");

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

      if (backgroundLayer) {
        map.setPaintProperty(backgroundLayer.id, "background-opacity", 0);
      }

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

      const ringsHost = ringsRef.current;
      if (ringsHost) {
        void Promise.all([
          import("three"),
          import("vanta/dist/vanta.rings.min"),
        ]).then(([THREE, vantaModule]) => {
          if (isDisposed) {
            return;
          }

          const RINGS = (
            vantaModule.default as unknown as {
              default: VantaRingsFactory;
            }
          ).default;

          ringsEffect = RINGS({
            el: ringsHost,
            THREE,
            backgroundAlpha: 0,
            mouseControls: false,
            touchControls: false,
            gyroControls: false,
            minHeight: 280,
            minWidth: 320,
            scale: 1.6,
            scaleMobile: 2.1,
          });

          const initialAnchor = map.project(RINGS_ANCHOR);
          const initialBearing = map.getBearing();
          const initialZoom = map.getZoom();

          syncRingsToScene = () => {
            const anchor = map.project(RINGS_ANCHOR);
            const x = (anchor.x - initialAnchor.x) * 0.12;
            const y = (anchor.y - initialAnchor.y) * 0.12;
            const rotation = (map.getBearing() - initialBearing) * 0.08;
            const scale = Math.pow(2, (map.getZoom() - initialZoom) * 0.035);

            ringsHost.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scale})`;
          };

          map.on("render", syncRingsToScene);
          syncRingsToScene();
        });
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reducedMotion) {
        map.jumpTo(getCameraView(1));
      } else {
        map.once("idle", () => {
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
      }

      setMapStatus("ready");
    });

    map.on("error", () => {
      setMapStatus("unavailable");
    });

    return () => {
      isDisposed = true;
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (syncRingsToScene) {
        map.off("render", syncRingsToScene);
      }
      ringsEffect?.destroy();
      map.remove();
    };
  }, []);

  return (
    <div className="map-wrap">
      <div className="map-canvas" ref={containerRef} />
      <div className="map-sky-rings" ref={ringsRef} aria-hidden="true" />
      {mapStatus === "loading" && <p className="map-status">LOADING CAMPUS MASSING</p>}
      {mapStatus === "unavailable" && (
        <p className="map-status">MAP DATA UNAVAILABLE</p>
      )}
    </div>
  );
}
