import * as THREE from "three";
import { DIRECTION_TO_WORLD_OFFSET, oppositeDirection, type GridPosition } from "../core/types";
import { World } from "../core/World";
import { isConveyorNode } from "../entities/Conveyor";
import { Machine } from "../entities/Machine";
import { CameraController } from "./Camera";
import { MeshFactory } from "./MeshFactory";

export class Renderer {
  readonly canvas: HTMLCanvasElement;

  private readonly scene: THREE.Scene;
  private readonly webgl: THREE.WebGLRenderer;
  private readonly cameraController: CameraController;

  private readonly staticLayer = new THREE.Group();
  private readonly buildingLayer = new THREE.Group();
  private readonly itemLayer = new THREE.Group();

  private readonly buildingNodes = new Map<string, THREE.Object3D>();
  private readonly buildingKinds = new Map<string, "belt" | "router" | "machine">();
  private readonly itemNodes = new Map<string, THREE.Mesh>();
  private readonly itemTypes = new Map<string, string>();

  private readonly world: World;
  private isMiddlePanning = false;
  private lastPanClientX = 0;
  private lastPanClientY = 0;

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    this.cameraController.zoomBy(zoomFactor);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    this.isMiddlePanning = true;
    this.lastPanClientX = event.clientX;
    this.lastPanClientY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isMiddlePanning) {
      return;
    }
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const dxPixels = event.clientX - this.lastPanClientX;
    const dyPixels = event.clientY - this.lastPanClientY;
    this.lastPanClientX = event.clientX;
    this.lastPanClientY = event.clientY;

    const worldPerPixelX = this.cameraController.getVisibleWorldWidth() / rect.width;
    const worldPerPixelY = this.cameraController.getVisibleWorldHeight() / rect.height;
    this.cameraController.moveBy(-dxPixels * worldPerPixelX, dyPixels * worldPerPixelY);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 1) {
      return;
    }
    this.isMiddlePanning = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  constructor(host: HTMLElement, world: World, initialViewHeight = 20) {
    this.world = world;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x161b22);
    this.scene.add(this.staticLayer, this.buildingLayer, this.itemLayer);
    this.staticLayer.add(MeshFactory.createGrid(world.width, world.height));

    this.cameraController = new CameraController(world.width, world.height, initialViewHeight);

    this.webgl = new THREE.WebGLRenderer({ antialias: true });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.webgl.domElement;
    host.appendChild(this.canvas);

    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  resize(width: number, height: number): void {
    this.webgl.setSize(width, height);
    this.cameraController.resize(width, height);
  }

  render(world: World): void {
    this.syncBuildings(world);
    this.syncItems(world);
    this.webgl.render(this.scene, this.cameraController.camera);
  }

  dispose(): void {
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.webgl.dispose();
    this.canvas.remove();
  }

  panCamera(dx: number, dy: number): void {
    this.cameraController.moveBy(dx, dy);
  }

  zoomCamera(multiplier: number): void {
    this.cameraController.zoomBy(multiplier);
  }

  getCameraZoom(): number {
    return this.cameraController.getZoom();
  }

  screenToGrid(clientX: number, clientY: number): GridPosition | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const point = new THREE.Vector3(ndcX, ndcY, 0);
    point.unproject(this.cameraController.camera);

    const gridX = Math.floor(point.x + this.world.width / 2);
    const gridY = Math.floor(this.world.height / 2 - point.y);
    if (!this.world.grid.isInBounds(gridX, gridY)) {
      return null;
    }
    return { x: gridX, y: gridY };
  }

  private syncBuildings(world: World): void {
    const seenKeys = new Set<string>();

    world.grid.forEach((tile, x, y) => {
      if (!tile.building) {
        return;
      }

      const key = this.makeKey(x, y);
      seenKeys.add(key);

      const requiredKind = tile.building instanceof Machine ? "machine" : tile.building.kind;
      const currentNode = this.buildingNodes.get(key);
      const currentKind = this.buildingKinds.get(key);

      if (!currentNode || currentKind !== requiredKind) {
        if (currentNode) {
          this.buildingLayer.remove(currentNode);
        }

        const created = tile.building instanceof Machine
          ? MeshFactory.createMachine(tile.building.outputDirection)
          : tile.building.kind === "router"
            ? MeshFactory.createRouter(tile.building.direction)
            : MeshFactory.createBelt(tile.building.direction);

        this.buildingNodes.set(key, created);
        this.buildingKinds.set(key, requiredKind);
        this.buildingLayer.add(created);
      }

      const node = this.buildingNodes.get(key);
      if (!node) {
        return;
      }

      const worldPosition = this.gridToWorld(x, y);
      node.position.set(worldPosition.x, worldPosition.y, 0);

      if (isConveyorNode(tile.building) && tile.building.kind === "belt") {
        MeshFactory.setBeltDirection(node, tile.building.direction);
      }
      if (isConveyorNode(tile.building) && tile.building.kind === "router") {
        MeshFactory.setRouterDirection(node, tile.building.direction);
      }
      if (tile.building instanceof Machine) {
        MeshFactory.setMachineDirection(node, tile.building.outputDirection);
      }
    });

    for (const [key, node] of this.buildingNodes.entries()) {
      if (!seenKeys.has(key)) {
        this.buildingLayer.remove(node);
        this.buildingNodes.delete(key);
        this.buildingKinds.delete(key);
      }
    }
  }

  private syncItems(world: World): void {
    const seenUids = new Set<string>();

    world.grid.forEach((tile, x, y) => {
      if (!isConveyorNode(tile.building) || !tile.building.item) {
        return;
      }

      const conveyor = tile.building;
      if (!conveyor.item) {
        return;
      }
      const item = conveyor.item;
      const uid = item.uid;
      seenUids.add(uid);

      let mesh = this.itemNodes.get(uid);
      const knownType = this.itemTypes.get(uid);
      if (!mesh || knownType !== item.type) {
        if (mesh) {
          this.itemLayer.remove(mesh);
        }
        mesh = MeshFactory.createItem(item.type);
        this.itemNodes.set(uid, mesh);
        this.itemTypes.set(uid, item.type);
        this.itemLayer.add(mesh);
      }

      const base = this.gridToWorld(x, y);
      const progress = Math.min(Math.max(conveyor.progress, 0), 1);
      const entryOffset = DIRECTION_TO_WORLD_OFFSET[conveyor.entryDirection ?? oppositeDirection(conveyor.direction)];
      const exitOffset = DIRECTION_TO_WORLD_OFFSET[conveyor.direction];

      const startX = -entryOffset.x * 0.5;
      const startY = -entryOffset.y * 0.5;
      const endX = exitOffset.x * 0.5;
      const endY = exitOffset.y * 0.5;

      mesh.position.set(
        base.x + THREE.MathUtils.lerp(startX, endX, progress),
        base.y + THREE.MathUtils.lerp(startY, endY, progress),
        0.05
      );
    });

    for (const [uid, mesh] of this.itemNodes.entries()) {
      if (!seenUids.has(uid)) {
        this.itemLayer.remove(mesh);
        this.itemNodes.delete(uid);
        this.itemTypes.delete(uid);
      }
    }
  }

  private gridToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: x - this.world.width / 2 + 0.5,
      y: this.world.height / 2 - y - 0.5,
    };
  }

  private makeKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
