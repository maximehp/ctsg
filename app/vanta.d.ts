declare module "vanta/dist/vanta.rings.min" {
  import type * as THREE from "three";

  export type VantaRingsEffect = {
    destroy: () => void;
    resize: () => void;
  };

  type VantaRingsOptions = {
    el: HTMLElement;
    THREE: typeof THREE;
    backgroundAlpha?: number;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
  };

  const RINGS: (options: VantaRingsOptions) => VantaRingsEffect;

  export default RINGS;
}
