"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  Map,
  MercatorCoordinate,
  setWorkerUrl,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import * as THREE from "three";
import { ROOSEVELT_ISLAND_TREE_POINTS } from "./rooseveltIslandTreePoints";

const CAMERA_TARGET: [number, number] = [-73.9571674, 40.7545844];
const LOOK_AT_TARGET: [number, number] = [-73.9550837, 40.7559414];

const CAMERA_DURATION = 9000;
const LOADING_HOLD_DURATION = 250;
const SNAPSHOT_SETTLE_DURATION = 500;
const EYE_HEIGHT = 1.7;
const LOOK_AT_HEIGHT = 35;
const START_HEIGHT = 320;
const START_RADIUS = 1630;
const ORBIT_TURNS = 0.5;
const FINAL_LEFT_YAW = 3;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const WATER_COLOR = "#67b7e1";
const TREE_CANOPY_COLORS = ["#679b52", "#76aa5d", "#568a47"] as const;
const TREE_POLYGON_SIDES = 6;
const BRIDGE_START: [number, number] = [-73.96072, 40.75953];
const BRIDGE_END: [number, number] = [-73.9489, 40.75443];
const BRIDGE_PYLON_POINTS: Array<[number, number]> = [
  [-73.9591299, 40.7588769],
  [-73.9554167, 40.7572668],
  [-73.9534525, 40.7564098],
  [-73.9503566, 40.7550719],
];
const BRIDGE_DECK_HEIGHT = 39;
const BRIDGE_PEAK_HEIGHT = 110;
const BRIDGE_APPROACH_LENGTH = 260;
const BRIDGE_STEEL_COLOR = "#737c78";
const BRIDGE_DECK_COLOR = "#5e6665";
const BRIDGE_PIER_COLOR = "#c3bcae";
const PANEL_CONTENT_VERTICAL_SPACE = 54;
const ACTIVE_TITLE_SAFE_INSET = 8;

type MarkerPosition = {
  x: number;
  y: number;
  panelShiftX: number;
  panelTitleOffsetX: number;
  horizontal: "left" | "center" | "right";
  vertical: "above" | "below";
};

type ScreenPoint = Pick<MarkerPosition, "x" | "y">;
type VisibleBuildingCenters = Array<ScreenPoint | null>;

type RgbColor = {
  hue: number;
  saturation: number;
};

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

type TreeExtrusionProperties = {
  base: number;
  color: string;
  height: number;
};

type CampaignSection = {
  title: string;
  copy: string | string[];
  summary?: string;
  panelWidth?: number;
  panelHeight?: number;
  mobilePanelHeight?: number;
  image?: {
    src: string;
    alt: string;
  };
};

const CAMPAIGN_SECTIONS: CampaignSection[] = [
  {
    title: "BIO",
    copy:
      "Maxime is an M.Eng. Computer Science student who is interested in practical technology and cross-disciplinary connection. He loves finding unique solutions to problems and making practical applications. He has attended and volunteered at many conferences, with significant student leadership experience from his undergraduate studies at Ball State.",
    image: {
      src: "/maxime-headshot.png",
      alt: "Maxime Hendryx-Parker",
    },
  },
  {
    title: "ROLE",
    summary:
      "The Technical Co-President is one of CTSG’s two co-presidents and a liaison to Cornell administration.",
    copy: [
      "Bridge communication between Cornell Tech representatives and broader Cornell administration.",
      "Keep CTSG aware of issues requiring Council action and of CTSG activities.",
      "Draft and propose CTSG meeting agendas and facilitate CTSG meetings.",
    ],
    panelWidth: 300,
    panelHeight: 260,
  },
  {
    title: "PRIORITIES",
    summary:
      "I want students to know they can raise a concern and be aware of how their problems are being handled.",
    copy: [
      "Listening to student feedback before deciding on changes.",
      "Be available for questions, concerns, and ideas outside of formal meetings.",
      "Keep students updated when an issue moves forward, stalls, or needs more work.",
    ],
    panelWidth: 300,
    panelHeight: 260,
  },
  {
    title: "COMMUNITY",
    copy:
      "One of Cornell Tech’s biggest strengths is how different its people are. Students take unconventional paths to get here, bringing different skill sets and ways of thinking. I want CTSG to bring our students into more conversations with people from other schools, alumni, and industry professionals.",
    panelWidth: 300,
    panelHeight: 220,
    mobilePanelHeight: 260,
  },
];

// The camera places buildings 3 and 4 at the top of the composition. Map the
// campaign sequence to that visual order: 1, 2 above 3, 4.
const SECTION_BUILDING_ORDER = [3, 2, 0, 1] as const;

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

function createTreeFootprint(
  point: readonly [number, number],
  radius: number,
) {
  const [longitude, latitude] = point;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeMetersPerDegree =
    METERS_PER_LATITUDE_DEGREE * Math.cos(latitudeRadians);

  return Array.from({ length: TREE_POLYGON_SIDES + 1 }, (_, index) => {
    const angle = index / TREE_POLYGON_SIDES * Math.PI * 2;

    return [
      longitude + Math.cos(angle) * radius / longitudeMetersPerDegree,
      latitude + Math.sin(angle) * radius / METERS_PER_LATITUDE_DEGREE,
    ];
  });
}

function createTreeExtrusion(
  point: readonly [number, number],
  radius: number,
  properties: TreeExtrusionProperties,
): Feature<Polygon, TreeExtrusionProperties> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [createTreeFootprint(point, radius)],
    },
  };
}

const ROOSEVELT_ISLAND_TREE_EXTRUSIONS: FeatureCollection<
  Polygon,
  TreeExtrusionProperties
> = {
  type: "FeatureCollection",
  features: ROOSEVELT_ISLAND_TREE_POINTS
    .filter((_, index) => index % 3 === 0)
    .flatMap((point, index) => {
      const variation = (index * 47 % 97) / 96;
      const trunkHeight = 2.3 + variation * 0.8;
      const canopyRadius = 1.35 + variation;
      const lowerCanopyHeight = 4.6 + variation * 1.4;
      const upperCanopyHeight = 6.3 + variation * 1.7;
      const canopyColor =
        TREE_CANOPY_COLORS[index % TREE_CANOPY_COLORS.length];

      return [
        createTreeExtrusion(point, 0.38 + variation * 0.12, {
          base: 0,
          color: "#76563a",
          height: trunkHeight,
        }),
        createTreeExtrusion(point, canopyRadius, {
          base: trunkHeight * 0.65,
          color: canopyColor,
          height: lowerCanopyHeight,
        }),
        createTreeExtrusion(point, canopyRadius * 0.62, {
          base: lowerCanopyHeight,
          color: canopyColor,
          height: upperCanopyHeight,
        }),
      ];
    }),
};

function createQueensboroBridgeLayer(): CustomLayerInterface {
  let renderer: THREE.WebGLRenderer | undefined;
  let scene: THREE.Scene | undefined;
  let camera: THREE.Camera | undefined;
  let modelMatrix: THREE.Matrix4 | undefined;

  return {
    id: "ct-queensboro-bridge",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      const center: [number, number] = [
        (BRIDGE_START[0] + BRIDGE_END[0]) / 2,
        (BRIDGE_START[1] + BRIDGE_END[1]) / 2,
      ];
      const averageLatitude = center[1];
      const longitudeMetersPerDegree =
        METERS_PER_LATITUDE_DEGREE * Math.cos(averageLatitude * Math.PI / 180);
      const east = (BRIDGE_END[0] - BRIDGE_START[0]) * longitudeMetersPerDegree;
      const north = (BRIDGE_END[1] - BRIDGE_START[1]) * METERS_PER_LATITUDE_DEGREE;
      const totalLength = Math.hypot(east, north);
      const bridgeAngle = Math.atan2(-north, east);
      const origin = MercatorCoordinate.fromLngLat(center, 0);
      const mercatorScale = origin.meterInMercatorCoordinateUnits();

      modelMatrix = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .scale(new THREE.Vector3(mercatorScale, mercatorScale, mercatorScale));
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      const bridge = new THREE.Group();
      bridge.rotation.z = bridgeAngle;
      scene.add(bridge);

      const steel = new THREE.MeshLambertMaterial({ color: BRIDGE_STEEL_COLOR });
      const deck = new THREE.MeshLambertMaterial({ color: BRIDGE_DECK_COLOR });
      const roadway = new THREE.MeshLambertMaterial({ color: 0x414747 });
      const stone = new THREE.MeshLambertMaterial({ color: BRIDGE_PIER_COLOR });

      const addBox = (
        length: number,
        width: number,
        height: number,
        x: number,
        y: number,
        z: number,
        material: THREE.Material,
      ) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(length, width, height),
          material,
        );
        mesh.position.set(x, y, z);
        bridge.add(mesh);
      };

      const addSlopedBox = (
        from: [number, number, number],
        to: [number, number, number],
        width: number,
        height: number,
        material: THREE.Material,
      ) => {
        const start = new THREE.Vector3(...from);
        const end = new THREE.Vector3(...to);
        const direction = end.clone().sub(start);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(direction.length(), width, height),
          material,
        );
        mesh.position.copy(start).add(end).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(1, 0, 0),
          direction.normalize(),
        );
        bridge.add(mesh);
      };

      const addBeam = (
        from: [number, number, number],
        to: [number, number, number],
        thickness: number,
      ) => addSlopedBox(from, to, thickness, thickness, steel);

      const startOffset = -totalLength / 2;
      const endOffset = totalLength / 2;
      const trussSide = 9.15;
      const supportPositions = BRIDGE_PYLON_POINTS.map(([longitude, latitude]) => {
        const pointEast = (longitude - BRIDGE_START[0]) * longitudeMetersPerDegree;
        const pointNorth = (latitude - BRIDGE_START[1]) * METERS_PER_LATITUDE_DEGREE;
        return startOffset + (pointEast * east + pointNorth * north) / totalLength;
      });
      const spanBoundaries = [startOffset, ...supportPositions, endOffset];

      // Two decks and the outer lower roadways are among the bridge's most
      // visible signatures. The trusses are 60 feet apart in the 1908 plans.
      addBox(totalLength, 26.2, 4.2, 0, 0, BRIDGE_DECK_HEIGHT - 2.1, deck);
      addBox(totalLength, 24.8, 0.7, 0, 0, BRIDGE_DECK_HEIGHT + 0.35, roadway);
      addBox(totalLength, 18.3, 1.1, 0, 0, BRIDGE_DECK_HEIGHT + 7.4, roadway);
      for (const side of [-trussSide, trussSide]) {
        addBox(
          totalLength,
          2.1,
          2.1,
          0,
          side,
          BRIDGE_DECK_HEIGHT + 1.2,
          steel,
        );
      }

      // Replace the first draft's two guessed blocks with the four mapped
      // pylon footprints that define the original five-span elevation.
      for (const support of supportPositions) {
        addBox(18, 26, 6, support, 0, 3, stone);
        addBox(11, 20, BRIDGE_DECK_HEIGHT - 10, support, 0,
          6 + (BRIDGE_DECK_HEIGHT - 10) / 2, stone);
        addBox(16, 23, 4, support, 0, BRIDGE_DECK_HEIGHT - 6, stone);

        for (const side of [-trussSide, trussSide]) {
          addBeam(
            [support, side, BRIDGE_DECK_HEIGHT - 1],
            [support, side, BRIDGE_PEAK_HEIGHT],
            3.4,
          );
          addBeam(
            [support, side, BRIDGE_PEAK_HEIGHT],
            [support, side, BRIDGE_PEAK_HEIGHT + 5],
            1.7,
          );
        }

        addBeam(
          [support, -trussSide, BRIDGE_PEAK_HEIGHT - 4],
          [support, trussSide, BRIDGE_PEAK_HEIGHT - 4],
          3.2,
        );
        addBeam(
          [support, -trussSide, BRIDGE_DECK_HEIGHT + 10],
          [support, trussSide, BRIDGE_PEAK_HEIGHT - 7],
          1.8,
        );
        addBeam(
          [support, trussSide, BRIDGE_DECK_HEIGHT + 10],
          [support, -trussSide, BRIDGE_PEAK_HEIGHT - 7],
          1.8,
        );
      }

      for (const anchorage of [startOffset, endOffset]) {
        addBox(13, 22, BRIDGE_DECK_HEIGHT - 1, anchorage, 0,
          (BRIDGE_DECK_HEIGHT - 1) / 2, stone);
        addBox(17, 25, 4, anchorage, 0, BRIDGE_DECK_HEIGHT - 3, stone);
      }

      // Descending, supported viaducts connect the anchor piers back to the
      // city. Segmenting the approaches keeps their deck, roadway and side
      // girders aligned while the columns visibly shorten toward the ground.
      const approachDrop = BRIDGE_DECK_HEIGHT - 4;
      const approachSegments = 6;

      for (const direction of [-1, 1]) {
        const anchor = direction < 0 ? startOffset : endOffset;
        const farEnd = anchor + direction * BRIDGE_APPROACH_LENGTH;

        for (let segment = 0; segment < approachSegments; segment += 1) {
          const startProgress = segment / approachSegments;
          const endProgress = (segment + 1) / approachSegments;
          const segmentStart = anchor + (farEnd - anchor) * startProgress;
          const segmentEnd = anchor + (farEnd - anchor) * endProgress;
          const startHeight = BRIDGE_DECK_HEIGHT - approachDrop * startProgress;
          const endHeight = BRIDGE_DECK_HEIGHT - approachDrop * endProgress;

          addSlopedBox(
            [segmentStart, 0, startHeight - 2.1],
            [segmentEnd, 0, endHeight - 2.1],
            26.2,
            4.2,
            deck,
          );
          addSlopedBox(
            [segmentStart, 0, startHeight + 0.35],
            [segmentEnd, 0, endHeight + 0.35],
            24.8,
            0.7,
            roadway,
          );
          addSlopedBox(
            [segmentStart, 0, startHeight + 7.4],
            [segmentEnd, 0, endHeight + 7.4],
            18.3,
            1.1,
            roadway,
          );

          for (const side of [-trussSide, trussSide]) {
            addSlopedBox(
              [segmentStart, side, startHeight + 1.2],
              [segmentEnd, side, endHeight + 1.2],
              2.1,
              2.1,
              steel,
            );
            addSlopedBox(
              [segmentStart, side, startHeight + 8.2],
              [segmentEnd, side, endHeight + 8.2],
              2.2,
              3.2,
              steel,
            );
          }

          if (segment < approachSegments - 1) {
            const columnTop = endHeight - 4;
            for (const side of [-trussSide, trussSide]) {
              addBeam(
                [segmentEnd, side, 1.5],
                [segmentEnd, side, columnTop],
                2.6,
              );
            }
            addBeam(
              [segmentEnd, -trussSide, columnTop],
              [segmentEnd, trussSide, columnTop],
              2.4,
            );
          }
        }

        addBox(24, 30, 8, farEnd, 0, 4, stone);
      }

      const profilePoints: Array<[number, number]> = [
        [spanBoundaries[0], 52],
        [supportPositions[0], BRIDGE_PEAK_HEIGHT],
        [(supportPositions[0] + supportPositions[1]) / 2, 55],
        [supportPositions[1], BRIDGE_PEAK_HEIGHT],
        [(supportPositions[1] + supportPositions[2]) / 2, 72],
        [supportPositions[2], BRIDGE_PEAK_HEIGHT],
        [(supportPositions[2] + supportPositions[3]) / 2, 55],
        [supportPositions[3], BRIDGE_PEAK_HEIGHT],
        [spanBoundaries[5], 52],
      ];

      const topHeightAt = (position: number) => {
        const nextIndex = profilePoints.findIndex(([x]) => x >= position);
        if (nextIndex <= 0) {
          return profilePoints[0][1];
        }

        const [previousX, previousHeight] = profilePoints[nextIndex - 1];
        const [nextX, nextHeight] = profilePoints[nextIndex];
        const progress = (position - previousX) / (nextX - previousX);
        return previousHeight + (nextHeight - previousHeight) * progress;
      };
      const panelPositions: number[] = [];
      for (let spanIndex = 0; spanIndex < spanBoundaries.length - 1; spanIndex += 1) {
        const spanStart = spanBoundaries[spanIndex];
        const spanEnd = spanBoundaries[spanIndex + 1];
        const panelCount = Math.max(3, Math.round((spanEnd - spanStart) / 20));

        for (let panel = 0; panel < panelCount; panel += 1) {
          panelPositions.push(
            spanStart + (spanEnd - spanStart) * panel / panelCount,
          );
        }
      }
      panelPositions.push(endOffset);

      for (let panelIndex = 0; panelIndex < panelPositions.length - 1; panelIndex += 1) {
        const position = panelPositions[panelIndex];
        const nextPosition = panelPositions[panelIndex + 1];
        const top = topHeightAt(position);
        const nextTop = topHeightAt(nextPosition);

        for (const side of [-trussSide, trussSide]) {
          addBeam(
            [position, side, BRIDGE_DECK_HEIGHT + 1],
            [position, side, top],
            supportPositions.includes(position) ? 3.4 : 1.8,
          );
          addBeam([position, side, top], [nextPosition, side, nextTop], 2.5);

          if (nextPosition > position + 4) {
            const slopesUp = panelIndex % 2 === 0;
            addBeam(slopesUp
              ? [position, side, BRIDGE_DECK_HEIGHT + 2]
              : [position, side, top - 1], slopesUp
              ? [nextPosition, side, nextTop - 1]
              : [nextPosition, side, BRIDGE_DECK_HEIGHT + 2], 1.8);
          }
        }
      }

      scene.add(new THREE.HemisphereLight(0xeaf7fa, 0x6d736d, 0.75));
      const sunlight = new THREE.DirectionalLight(0xffffff, 0.65);
      sunlight.position.set(-200, -300, 600);
      scene.add(sunlight);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render(_gl, options: CustomRenderMethodInput) {
      if (!renderer || !scene || !camera || !modelMatrix) {
        return;
      }

      camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(options.defaultProjectionData.mainMatrix)
        .multiply(modelMatrix);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      renderer?.dispose();
    },
  };
}

function getHue(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;

  if (chroma === 0) {
    return 0;
  }

  if (maximum === red) {
    return (60 * ((green - blue) / chroma) + 360) % 360;
  }

  if (maximum === green) {
    return 60 * ((blue - red) / chroma + 2);
  }

  return 60 * ((red - green) / chroma + 4);
}

function getRgbColor(hex: string): RgbColor {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const maximum = Math.max(red, green, blue);

  return {
    hue: getHue(red, green, blue),
    saturation:
      maximum === 0 ? 0 : (maximum - Math.min(red, green, blue)) / maximum,
  };
}

const HIGHLIGHTED_BUILDING_COLORS = CORNELL_TECH_BUILDINGS.features.map(
  (building) => getRgbColor(building.properties.color),
);

function getHueDifference(first: number, second: number) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function isBuildingPixel(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  color: RgbColor,
) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);

  if (alpha < 220 || maximum < 28 || maximum === minimum) {
    return false;
  }

  const saturation = (maximum - minimum) / maximum;
  // The extrusion's lighting changes brightness but keeps each building's hue
  // and saturation distinct from the pastel base map buildings.
  return (
    saturation >= Math.max(color.saturation - 0.08, 0.3) &&
    getHueDifference(getHue(red, green, blue), color.hue) < 14
  );
}

function getLargestVisibleBuildingCenter(
  image: ImageData,
  color: RgbColor,
): ScreenPoint | null {
  const { data, width, height } = image;
  const size = width * height;
  const componentIds = new Int32Array(size);
  const queue = new Int32Array(size);
  let nextComponentId = 0;
  let largestComponentId = 0;
  let largestComponentSize = 0;

  const matchesColor = (index: number) => {
    const offset = index * 4;
    return isBuildingPixel(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3],
      color,
    );
  };

  for (let start = 0; start < size; start += 1) {
    if (componentIds[start] !== 0 || !matchesColor(start)) {
      continue;
    }

    nextComponentId += 1;
    componentIds[start] = nextComponentId;
    let head = 0;
    let tail = 1;
    queue[0] = start;

    while (head < tail) {
      const current = queue[head];
      head += 1;
      const x = current % width;
      const y = Math.floor(current / width);

      for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
        for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
          if (xOffset === 0 && yOffset === 0) {
            continue;
          }

          const nextX = x + xOffset;
          const nextY = y + yOffset;
          const next = nextY * width + nextX;

          if (
            nextX >= 0 &&
            nextX < width &&
            nextY >= 0 &&
            nextY < height &&
            componentIds[next] === 0 &&
            matchesColor(next)
          ) {
            componentIds[next] = nextComponentId;
            queue[tail] = next;
            tail += 1;
          }
        }
      }
    }

    if (tail > largestComponentSize) {
      largestComponentSize = tail;
      largestComponentId = nextComponentId;
    }
  }

  if (largestComponentId === 0 || largestComponentSize < 96) {
    return null;
  }

  // Start at the outline of the visible shape, then travel inward. The final
  // point is the image-space incenter: safely within the rendered façade and
  // visually centered even when only part of a building is visible.
  const distances = new Int32Array(size);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < size; index += 1) {
    if (componentIds[index] !== largestComponentId) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    let isEdge = false;

    for (let yOffset = -1; yOffset <= 1 && !isEdge; yOffset += 1) {
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }

        const nextX = x + xOffset;
        const nextY = y + yOffset;
        if (
          nextX < 0 ||
          nextX >= width ||
          nextY < 0 ||
          nextY >= height ||
          componentIds[nextY * width + nextX] !== largestComponentId
        ) {
          isEdge = true;
          break;
        }
      }
    }

    if (isEdge) {
      distances[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  }

  let centerIndex = queue[0];
  while (head < tail) {
    const current = queue[head];
    head += 1;
    if (distances[current] > distances[centerIndex]) {
      centerIndex = current;
    }

    const x = current % width;
    const y = Math.floor(current / width);
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }

        const nextX = x + xOffset;
        const nextY = y + yOffset;
        const next = nextY * width + nextX;
        if (
          nextX >= 0 &&
          nextX < width &&
          nextY >= 0 &&
          nextY < height &&
          componentIds[next] === largestComponentId &&
          distances[next] === 0
        ) {
          distances[next] = distances[current] + 1;
          queue[tail] = next;
          tail += 1;
        }
      }
    }
  }

  return {
    x: centerIndex % width,
    y: Math.floor(centerIndex / width),
  };
}

function getVisibleBuildingCenters(
  source: CanvasImageSource,
  width: number,
  height: number,
): VisibleBuildingCenters | null {
  if (width === 0 || height === 0) {
    return null;
  }

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = width;
  captureCanvas.height = height;
  const context = captureCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    return null;
  }

  try {
    context.drawImage(source, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return HIGHLIGHTED_BUILDING_COLORS.map((color) =>
      getLargestVisibleBuildingCenter(image, color),
    );
  } catch {
    return null;
  }
}

function getVisibleBuildingCentersFromCanvas(
  canvas: HTMLCanvasElement,
): VisibleBuildingCenters | null {
  return getVisibleBuildingCenters(canvas, canvas.clientWidth, canvas.clientHeight);
}

function getAssetUrl(path: string) {
  if (typeof document === "undefined" || !path.startsWith("/")) {
    return path;
  }

  const assetBase = document.documentElement.dataset.assetBase;
  return assetBase ? `${assetBase}${path.slice(1)}` : path;
}

function getFootprintCenter(coordinates: number[][]) {
  const vertices = coordinates.slice(0, -1);
  return vertices.reduce(
    (center, coordinate) => ({
      lng: center.lng + coordinate[0] / vertices.length,
      lat: center.lat + coordinate[1] / vertices.length,
    }),
    { lng: 0, lat: 0 },
  );
}

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
  const snapshotRef = useRef<HTMLImageElement | null>(null);
  const removeMapRef = useRef<(() => void) | null>(null);
  const snapshotHandoffScheduledRef = useRef(false);
  const isStaticMapInPlaceRef = useRef(false);
  const shouldSkipCameraAnimationRef = useRef(false);
  const shouldSkipTourRevealRef = useRef(false);
  const initialPanelTimeoutRef = useRef<number | undefined>(undefined);
  const snapshotUrlRef = useRef<string | undefined>(undefined);
  const visibleBuildingCentersRef = useRef<VisibleBuildingCenters | null>(null);
  const panelContentRefs = useRef(new globalThis.Map<number, HTMLDivElement>());
  const updateMarkerPositionsRef = useRef<
    ((visibleBuildingCenters: VisibleBuildingCenters | null) => void) | null
  >(null);
  const revealTourRef = useRef<(() => void) | null>(null);
  const [mapStatus, setMapStatus] = useState("loading");
  const [isTourVisible, setIsTourVisible] = useState(false);
  const [activeStop, setActiveStop] = useState<number | null>(null);
  const [markerPositions, setMarkerPositions] = useState<MarkerPosition[]>([]);
  const [panelContentHeights, setPanelContentHeights] = useState<
    Record<number, number>
  >({});
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);
  const [mapGeneration, setMapGeneration] = useState(0);
  const [loadingScreenPhase, setLoadingScreenPhase] = useState<
    "visible" | "leaving" | "hidden"
  >("visible");

  const measurePanelHeight = useCallback((index: number) => {
    const content = panelContentRefs.current.get(index);
    if (!content) {
      return;
    }

    const marker = content.closest<HTMLElement>(".building-marker");
    if (!marker) {
      return;
    }

    // Measure an off-screen copy with the active-panel styles applied. The
    // visible surface is never resized or stripped of its transition, so its
    // opening animation can run uninterrupted.
    const measurementRoot = document.createElement("div");
    measurementRoot.className = `${marker.className} building-marker--active`;
    measurementRoot.setAttribute("aria-hidden", "true");
    measurementRoot.style.cssText = marker.style.cssText;
    measurementRoot.style.position = "fixed";
    measurementRoot.style.top = "0";
    measurementRoot.style.left = "-10000px";
    measurementRoot.style.opacity = "0";
    measurementRoot.style.pointerEvents = "none";
    measurementRoot.style.visibility = "hidden";
    measurementRoot.style.animation = "none";
    measurementRoot.style.transform = "none";

    const contentCopy = content.cloneNode(true) as HTMLDivElement;
    contentCopy.style.position = "fixed";
    contentCopy.style.inset = "auto";
    contentCopy.style.top = "0";
    contentCopy.style.left = "-10000px";
    contentCopy.style.width = `${content.getBoundingClientRect().width}px`;
    contentCopy.style.height = "auto";
    contentCopy.style.opacity = "0";
    contentCopy.style.transition = "none";
    contentCopy.style.transform = "none";

    measurementRoot.appendChild(contentCopy);
    document.body.appendChild(measurementRoot);
    const height = Math.ceil(
      contentCopy.getBoundingClientRect().height + PANEL_CONTENT_VERTICAL_SPACE,
    );
    measurementRoot.remove();

    setPanelContentHeights((current) =>
      current[index] === height ? current : { ...current, [index]: height },
    );
  }, []);

  const openPanel = useCallback(
    (index: number) => {
      // Content keeps its expanded width while clipped inside the closed pill,
      // so its exact height is available before the opening transition starts.
      measurePanelHeight(index);
      setActiveStop(index);
    },
    [measurePanelHeight],
  );

  useLayoutEffect(() => {
    if (activeStop === null) {
      return;
    }

    const content = panelContentRefs.current.get(activeStop);
    if (!content) {
      return;
    }

    measurePanelHeight(activeStop);
    const observer = new ResizeObserver(() => measurePanelHeight(activeStop));
    observer.observe(content);
    let isCancelled = false;
    void document.fonts.ready.then(() => {
      if (!isCancelled) {
        measurePanelHeight(activeStop);
      }
    });

    return () => {
      isCancelled = true;
      observer.disconnect();
    };
  }, [activeStop, measurePanelHeight]);

  useEffect(() => {
    if (mapStatus === "unavailable") {
      const timeout = window.setTimeout(() => {
        setLoadingScreenPhase("hidden");
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    if (mapStatus !== "ready") {
      return;
    }

    let hideTimeout: number | undefined;
    const leaveTimeout = window.setTimeout(() => {
      setLoadingScreenPhase("leaving");
      hideTimeout = window.setTimeout(() => {
        setLoadingScreenPhase("hidden");
      }, 420);
    }, 0);

    return () => {
      window.clearTimeout(leaveTimeout);
      if (hideTimeout !== undefined) {
        window.clearTimeout(hideTimeout);
      }
    };
  }, [mapStatus]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setWorkerUrl(maplibreWorkerUrl);
    const shouldSkipCameraAnimation = shouldSkipCameraAnimationRef.current;
    shouldSkipCameraAnimationRef.current = false;

    const map = new Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: LOOK_AT_TARGET,
      zoom: 16,
      maxPitch: 180,
      centerClampedToGround: false,
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    let animationFrame: number | undefined;
    let cameraStartTimeout: number | undefined;
    let resizeRefreshTimeout: number | undefined;
    let snapshotSettleTimeout: number | undefined;
    let mapRemoved = false;
    let isDisposed = false;

    const refreshStaticMapAfterResize = () => {
      // Once MapLibre has been replaced with the static image, the image can
      // only stretch to fit a new viewport. Capture a new final frame at the
      // new size instead of leaving that stretched image in place.
      if (!isStaticMapInPlaceRef.current || isDisposed) {
        return;
      }

      if (resizeRefreshTimeout !== undefined) {
        window.clearTimeout(resizeRefreshTimeout);
      }

      resizeRefreshTimeout = window.setTimeout(() => {
        if (isStaticMapInPlaceRef.current && !isDisposed) {
          isStaticMapInPlaceRef.current = false;
          snapshotHandoffScheduledRef.current = false;
          shouldSkipCameraAnimationRef.current = true;
          shouldSkipTourRevealRef.current = true;
          setStaticMapUrl(null);
          setMapGeneration((generation) => generation + 1);
        }
      }, 75);
    };

    window.addEventListener("resize", refreshStaticMapAfterResize);

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

    const updateMarkerPositions = (
      visibleBuildingCenters: VisibleBuildingCenters | null =
        visibleBuildingCentersRef.current,
    ) => {
      const viewport = containerRef.current ?? map.getCanvas();
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const horizontalInset = isMobile ? 28 : 0;
      const verticalInset = isMobile ? 58 : 0;
      const panelEdgeInset = isMobile ? 20 : 24;

      setMarkerPositions(
        CORNELL_TECH_BUILDINGS.features.map((building, index) => {
          const section = CAMPAIGN_SECTIONS[
            SECTION_BUILDING_ORDER.indexOf(index)
          ];
          const requestedPanelWidth = section?.panelWidth ?? (section?.image ? 300 : 250);
          const expandedPanelWidth = isMobile
            ? Math.min(280, viewport.clientWidth - 40)
            : Math.min(requestedPanelWidth, viewport.clientWidth - 44);
          const footprintCenter = getFootprintCenter(building.geometry.coordinates[0]);
          const point = visibleBuildingCenters?.[index] ?? map.project([
            footprintCenter.lng,
            footprintCenter.lat,
          ]);

          const x = Math.min(
            Math.max(point.x, horizontalInset),
            viewport.clientWidth - horizontalInset,
          );
          const y = Math.min(
            Math.max(point.y, verticalInset),
            viewport.clientHeight - verticalInset,
          );
          const panelShiftX =
            Math.max(panelEdgeInset - (x - expandedPanelWidth / 2), 0) -
            Math.max(
              x + expandedPanelWidth / 2 - (viewport.clientWidth - panelEdgeInset),
              0,
            );
          const activeTitle = `${String(
            SECTION_BUILDING_ORDER.indexOf(index) + 1,
          ).padStart(2, "0")} / ${section?.title ?? ""}`;
          const activeTitleWidth = activeTitle.length * 6 + 20;
          const maxTitleOffset = Math.max(
            0,
            expandedPanelWidth / 2 - activeTitleWidth / 2 - ACTIVE_TITLE_SAFE_INSET,
          );
          const panelTitleOffsetX = Math.min(
            Math.max(-panelShiftX, -maxTitleOffset),
            maxTitleOffset,
          );

          return {
            x,
            y,
            panelShiftX,
            panelTitleOffsetX,
            horizontal: point.x < viewport.clientWidth * 0.3
              ? "left"
            : point.x > viewport.clientWidth * 0.7
                ? "right"
                : "center",
            vertical: point.y > viewport.clientHeight * 0.62 ? "above" : "below",
          };
        }),
      );
    };

    const removeMap = () => {
      if (mapRemoved) {
        return;
      }

      map.off("resize", updateMarkerPositions);
      map.remove();
      mapRemoved = true;
    };
    removeMapRef.current = removeMap;

    const freezeMap = () => {
      if (isDisposed || mapRemoved) {
        return;
      }

      try {
        map.getCanvas().toBlob((snapshot) => {
          if (isDisposed || !snapshot) {
            return;
          }

          const url = URL.createObjectURL(snapshot);
          snapshotUrlRef.current = url;
          setStaticMapUrl(url);
        }, "image/webp", 0.92);
      } catch {
        // Keep the live map visible if a browser blocks canvas snapshots.
      }
    };

    const freezeMapWhenSettled = () => {
      // The final camera position can request tiles that were not visible
      // during the intro. Keep the live map until those tiles settle, then
      // give its final frame a moment to commit before capturing it.
      map.once("idle", () => {
        snapshotSettleTimeout = window.setTimeout(() => {
          if (isDisposed || mapRemoved) {
            return;
          }

          map.once("render", freezeMap);
          map.triggerRepaint();
        }, SNAPSHOT_SETTLE_DURATION);
      });
    };

    const revealTour = () => {
      window.requestAnimationFrame(() => {
        updateMarkerPositions();
        setIsTourVisible(true);
        initialPanelTimeoutRef.current = window.setTimeout(() => {
          openPanel(SECTION_BUILDING_ORDER[0]);
          initialPanelTimeoutRef.current = undefined;
        }, 120);
      });
    };

    const revealTourAfterCamera = () => {
      const shouldRevealTour = !shouldSkipTourRevealRef.current;

      // Wait for the final camera frame to settle so the controls use the
      // highlighted building centers from the completed view, rather than
      // appearing at projected coordinates and shifting after the handoff.
      map.once("idle", () => {
        if (isDisposed) {
          return;
        }

        // Measure highlighted buildings in a dedicated tree-free frame. The
        // trees remain in the visual snapshot, but can never occlude pixels or
        // move the calculated campaign anchors.
        map.setLayoutProperty("ct-island-trees", "visibility", "none");
        map.once("render", () => {
          const finalCenters = getVisibleBuildingCentersFromCanvas(map.getCanvas());
          map.setLayoutProperty("ct-island-trees", "visibility", "visible");
          map.triggerRepaint();

          if (!finalCenters) {
            return;
          }

          visibleBuildingCentersRef.current = finalCenters;
          updateMarkerPositions(finalCenters);

          if (shouldRevealTour) {
            // The static-map handoff below keeps this overlay in place rather
            // than recalculating its coordinates after it becomes visible.
            shouldSkipTourRevealRef.current = true;
            revealTour();
          }
        });
        map.triggerRepaint();
      });
    };

    updateMarkerPositionsRef.current = updateMarkerPositions;
    revealTourRef.current = revealTour;

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

        if (
          layer["source-layer"] === "water" &&
          layer.type === "fill" &&
          !layer.id.includes("shadow")
        ) {
          map.setPaintProperty(layer.id, "fill-color", WATER_COLOR);
        }

        if (layer["source-layer"] === "waterway" && layer.type === "line") {
          map.setPaintProperty(layer.id, "line-color", WATER_COLOR);
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

      map.addLayer(createQueensboroBridgeLayer());

      map.addSource("ct-island-trees", {
        type: "geojson",
        data: ROOSEVELT_ISLAND_TREE_EXTRUSIONS,
      });

      map.addLayer({
        id: "ct-island-trees",
        type: "fill-extrusion",
        source: "ct-island-trees",
        minzoom: 12,
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.93,
          "fill-extrusion-vertical-gradient": false,
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
              [
                "literal",
                [
                  266199261,
                  524729284,
                  922315193,
                  1016487154,
                  1016487155,
                  1016487157,
                  1016487159,
                ],
              ],
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
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false,
        },
      });

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      map.on("resize", updateMarkerPositions);

      // `idle` means the style, source data, and layers have settled. Waiting
      // here prevents an unfinished map frame from appearing before the intro.
      map.once("idle", () => {
        cameraStartTimeout = window.setTimeout(() => {
          if (reducedMotion || shouldSkipCameraAnimation) {
            map.jumpTo(getCameraView(1));
            revealTourAfterCamera();
            freezeMapWhenSettled();
          } else {
            const startedAt = performance.now();

            const animate = (now: number) => {
              const progress = Math.min((now - startedAt) / CAMERA_DURATION, 1);
              if (progress < 1) {
                map.jumpTo(getCameraView(easeOut(progress)));
                animationFrame = window.requestAnimationFrame(animate);
              } else {
                map.jumpTo(getCameraView(1));
                revealTourAfterCamera();
                freezeMapWhenSettled();
              }
            };

            animationFrame = window.requestAnimationFrame(animate);
          }

          setMapStatus("ready");
        }, shouldSkipCameraAnimation ? 0 : LOADING_HOLD_DURATION);
      });
    });

    map.on("error", () => {
      setMapStatus("unavailable");
    });

    return () => {
      isDisposed = true;
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (cameraStartTimeout !== undefined) {
        window.clearTimeout(cameraStartTimeout);
      }
      if (resizeRefreshTimeout !== undefined) {
        window.clearTimeout(resizeRefreshTimeout);
      }
      if (snapshotSettleTimeout !== undefined) {
        window.clearTimeout(snapshotSettleTimeout);
      }
      window.removeEventListener("resize", refreshStaticMapAfterResize);
      if (initialPanelTimeoutRef.current !== undefined) {
        window.clearTimeout(initialPanelTimeoutRef.current);
      }
      if (snapshotUrlRef.current !== undefined) {
        URL.revokeObjectURL(snapshotUrlRef.current);
        snapshotUrlRef.current = undefined;
      }
      updateMarkerPositionsRef.current = null;
      revealTourRef.current = null;
      removeMapRef.current = null;
      removeMap();
    };
  }, [mapGeneration, openPanel]);

  const handleSnapshotLoad = () => {
    if (snapshotHandoffScheduledRef.current) {
      return;
    }

    snapshotHandoffScheduledRef.current = true;
    const revealAfterSnapshotPaints = () => {
      const shouldRevealTour = !shouldSkipTourRevealRef.current;
      shouldSkipTourRevealRef.current = false;
      updateMarkerPositionsRef.current?.(visibleBuildingCentersRef.current);

      if (shouldRevealTour) {
        revealTourRef.current?.();
      }

      // The first frame commits the loaded image above the live canvas; the
      // second confirms it has painted before releasing MapLibre's WebGL state.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          isStaticMapInPlaceRef.current = true;
          removeMapRef.current?.();
        });
      });
    };
    const snapshot = snapshotRef.current;

    if (snapshot && "decode" in snapshot) {
      void snapshot.decode().catch(() => undefined).then(revealAfterSnapshotPaints);
      return;
    }

    revealAfterSnapshotPaints();
  };

  return (
    <div className="map-wrap">
      <div className="map-canvas" ref={containerRef} />
      {staticMapUrl !== null && (
        <>
          <img
            className="map-snapshot"
            ref={snapshotRef}
            src={staticMapUrl}
            alt=""
            onLoad={handleSnapshotLoad}
          />
        </>
      )}
      {isTourVisible && markerPositions.length === CORNELL_TECH_BUILDINGS.features.length && (
        <div
          className="building-tour"
          aria-label="Campaign sections"
          onClick={() => setActiveStop(null)}
        >
          {CORNELL_TECH_BUILDINGS.features.map((_, index) => {
            const position = markerPositions[index];
            const isActive = activeStop === index;
            const sectionIndex = SECTION_BUILDING_ORDER.indexOf(index);
            const section = CAMPAIGN_SECTIONS[sectionIndex];
            const isFinalSection = sectionIndex === CAMPAIGN_SECTIONS.length - 1;
            const nextSection = CAMPAIGN_SECTIONS[sectionIndex + 1];

            const activateStop = () => {
              if (initialPanelTimeoutRef.current !== undefined) {
                window.clearTimeout(initialPanelTimeoutRef.current);
                initialPanelTimeoutRef.current = undefined;
              }
              openPanel(index);
            };

            return (
              <div
                className={`building-marker building-marker--${position.horizontal} building-marker--${position.vertical}${section.image ? " building-marker--with-image" : ""}${section.summary ? " building-marker--with-details" : ""}${isActive ? " building-marker--active" : ""}`}
                key={index}
                onClick={(event) => event.stopPropagation()}
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  "--marker-delay": `${sectionIndex * 70}ms`,
                  "--marker-label-width": `${section.title.length * 6 + 20}px`,
                  "--panel-width": `${section.panelWidth ?? (section.image ? 300 : 250)}px`,
                  "--panel-height": `${section.panelHeight ?? (section.image ? 235 : 150)}px`,
                  "--panel-mobile-height": `${section.mobilePanelHeight ?? section.panelHeight ?? (section.image ? 235 : 150)}px`,
                  "--panel-content-height": panelContentHeights[index]
                    ? `${panelContentHeights[index]}px`
                    : undefined,
                  "--panel-shift-x": `${position.panelShiftX}px`,
                  "--panel-title-offset-x": `${position.panelTitleOffsetX}px`,
                } as React.CSSProperties}
              >
                <section
                  className="building-marker__surface"
                  aria-label={`${section.title} campaign section`}
                >
                  <button
                    className="building-marker__button"
                    type="button"
                    aria-label={`Open ${section.title}`}
                    aria-pressed={isActive}
                    onClick={activateStop}
                  >
                    {isActive
                      ? `${String(sectionIndex + 1).padStart(2, "0")} / ${section.title}`
                      : section.title}
                  </button>
                  <div
                    className="building-marker__content"
                    aria-hidden={!isActive}
                    ref={(element) => {
                      if (element) {
                        panelContentRefs.current.set(index, element);
                      } else {
                        panelContentRefs.current.delete(index);
                      }
                    }}
                  >
                    {section.image && (
                      <img
                        className="building-marker__image"
                        src={getAssetUrl(section.image.src)}
                        alt={section.image.alt}
                        onLoad={() => measurePanelHeight(index)}
                      />
                    )}
                    {section.summary && (
                      <p className="building-marker__summary">{section.summary}</p>
                    )}
                    {Array.isArray(section.copy) ? (
                      <ul className="building-marker__details">
                        {section.copy.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{section.copy}</p>
                    )}
                    <button
                      className="building-marker__next"
                      type="button"
                      onClick={() => {
                        if (isFinalSection) {
                          setActiveStop(null);
                        } else {
                          openPanel(SECTION_BUILDING_ORDER[sectionIndex + 1]);
                        }
                      }}
                      aria-label={
                        isFinalSection ? "Close campaign sections" : `Open ${nextSection.title}`
                      }
                      tabIndex={isActive ? 0 : -1}
                    >
                      <span>
                        {isFinalSection
                          ? "CLOSE"
                          : `NEXT (${sectionIndex + 2}/${CAMPAIGN_SECTIONS.length})`}
                      </span>
                      {!isFinalSection && <span aria-hidden="true">→</span>}
                    </button>
                  </div>
                </section>
              </div>
            );
          })}
        </div>
      )}
      {loadingScreenPhase !== "hidden" && (
        <div
          className={`loading-screen loading-screen--${loadingScreenPhase}`}
          aria-live="polite"
          aria-label="Loading campus world"
        >
          <div className="loading-screen__content">
            <p>LOADING ASSETS</p>
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
