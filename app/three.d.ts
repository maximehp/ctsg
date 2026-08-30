declare module "three" {
  export class Material {}

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    add(vector: Vector3): this;
    clone(): Vector3;
    copy(vector: Vector3): this;
    length(): number;
    multiplyScalar(scalar: number): this;
    normalize(): this;
    set(x: number, y: number, z: number): this;
    sub(vector: Vector3): this;
  }

  export class Quaternion {
    setFromUnitVectors(from: Vector3, to: Vector3): this;
  }

  export class Object3D {
    position: Vector3;
    quaternion: Quaternion;
    rotation: { z: number };
    add(...objects: Object3D[]): this;
  }

  export class Group extends Object3D {}
  export class Scene extends Object3D {}

  export class Camera extends Object3D {
    projectionMatrix: Matrix4;
  }

  export class Matrix4 {
    fromArray(array: ArrayLike<number>): this;
    makeTranslation(x: number, y: number, z: number): this;
    multiply(matrix: Matrix4): this;
    scale(vector: Vector3): this;
  }

  export class BoxGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export class MeshLambertMaterial extends Material {
    constructor(parameters?: { color?: number | string });
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BoxGeometry, material?: Material);
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor?: number, groundColor?: number, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }

  export class WebGLRenderer {
    constructor(parameters?: {
      antialias?: boolean;
      canvas?: HTMLCanvasElement;
      context?: WebGL2RenderingContext;
    });
    autoClear: boolean;
    dispose(): void;
    render(scene: Scene, camera: Camera): void;
    resetState(): void;
  }
}
