import * as THREE from "three";
import { DIRECTION_TO_WORLD_OFFSET, oppositeDirection, type Direction, type GridPosition } from "../core/types";
import { World } from "../core/World";
import { RESOURCE_ITEM_IDS, type ResourceItemId } from "../data/items";
import { isConveyorNode } from "../entities/Conveyor";
import { isDirectionalMachine } from "../entities/Machine";
import { Player } from "../entities/Player";
import { CameraController } from "./Camera";
import { InstancedBatch } from "./Instancing";
import { MeshFactory } from "./MeshFactory";

interface VisibleGridBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ResourceBatch {
  outline: InstancedBatch;
  core: InstancedBatch;
}

export interface PlacementPreviewState {
  x: number;
  y: number;
  kind: "belt" | "router" | "machine";
  direction: Direction;
  canPlace: boolean;
}

export interface RemotePlayerRenderState {
  id: string;
  x: number;
  y: number;
}

interface PreviewMaterialState {
  material: THREE.MeshBasicMaterial;
  baseColor: THREE.Color;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;

  private readonly scene: THREE.Scene;
  private readonly webgl: THREE.WebGLRenderer;
  private readonly cameraController: CameraController;

  private readonly staticLayer = new THREE.Group();
  private readonly resourceLayer = new THREE.Group();
  private readonly buildingLayer = new THREE.Group();
  private readonly previewLayer = new THREE.Group();
  private readonly itemLayer = new THREE.Group();
  private readonly playerLayer = new THREE.Group();

  private readonly resourceBatches = new Map<ResourceItemId, ResourceBatch>();
  private resourceBatchCapacity = 0;
  private readonly buildingNodes = new Map<string, THREE.Object3D>();
  private readonly buildingKinds = new Map<string, "belt" | "router" | "machine">();
  private readonly itemNodes = new Map<string, THREE.Mesh>();
  private readonly itemTypes = new Map<string, string>();
  private playerNode: THREE.Object3D | null = null;
  private readonly remotePlayerNodes = new Map<string, THREE.Object3D>();
  private placementPreview: PlacementPreviewState | null = null;
  private previewNode: THREE.Object3D | null = null;
  private previewKind: "belt" | "router" | "machine" | null = null;
  private previewMaterialStates: PreviewMaterialState[] = [];
  private readonly previewTile: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly previewTileBorder: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly previewValidColor = new THREE.Color(0x52d88a);
  private readonly previewInvalidColor = new THREE.Color(0xff6b6b);

  private readonly world: World;
  private readonly matrixPosition = new THREE.Vector3();
  private readonly matrixScale = new THREE.Vector3(1, 1, 1);
  private readonly matrixQuaternion = new THREE.Quaternion();
  private readonly matrix = new THREE.Matrix4();

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    this.cameraController.zoomBy(zoomFactor);
  };

  constructor(host: HTMLElement, world: World, initialViewHeight = 20) {
    this.world = world;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x161b22);
    this.scene.add(this.staticLayer, this.resourceLayer, this.buildingLayer, this.previewLayer, this.itemLayer, this.playerLayer);
    this.staticLayer.add(MeshFactory.createGrid(world.width, world.height));
    this.rebuildResourceBatches(256);

    this.previewTile = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96),
      new THREE.MeshBasicMaterial({
        color: this.previewValidColor,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    this.previewTile.position.set(0, 0, 0.03);
    this.previewTile.visible = false;
    this.previewLayer.add(this.previewTile);

    const previewBorderGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.48, -0.48, 0),
      new THREE.Vector3(0.48, -0.48, 0),
      new THREE.Vector3(0.48, 0.48, 0),
      new THREE.Vector3(-0.48, 0.48, 0),
    ]);
    this.previewTileBorder = new THREE.LineLoop(
      previewBorderGeometry,
      new THREE.LineBasicMaterial({
        color: this.previewValidColor,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    this.previewTileBorder.position.set(0, 0, 0.035);
    this.previewTileBorder.visible = false;
    this.previewLayer.add(this.previewTileBorder);

    this.cameraController = new CameraController(world.width, world.height, initialViewHeight);

    this.webgl = new THREE.WebGLRenderer({ antialias: true });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.webgl.domElement;
    host.appendChild(this.canvas);

    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  resize(width: number, height: number): void {
    this.webgl.setSize(width, height);
    this.cameraController.resize(width, height);
  }

  render(world: World, player?: Player, remotePlayers: RemotePlayerRenderState[] = []): void {
    const visibleBounds = this.getVisibleGridBounds(1);
    this.syncResources(world, visibleBounds);
    this.syncBuildings(world, visibleBounds);
    this.syncPlacementPreview();
    this.syncItems(world, visibleBounds);
    this.syncPlayer(player);
    this.syncRemotePlayers(remotePlayers);
    this.webgl.render(this.scene, this.cameraController.camera);
  }

  dispose(): void {
    this.clearPlacementPreviewNode();
    this.previewTile.geometry.dispose();
    this.previewTile.material.dispose();
    this.previewTileBorder.geometry.dispose();
    this.previewTileBorder.material.dispose();
    this.canvas.removeEventListener("wheel", this.onWheel);
    for (const node of this.remotePlayerNodes.values()) {
      this.playerLayer.remove(node);
    }
    this.remotePlayerNodes.clear();
    this.webgl.dispose();
    this.canvas.remove();
  }

  setPlacementPreview(preview: PlacementPreviewState | null): void {
    this.placementPreview = preview;
  }

  zoomCamera(multiplier: number): void {
    this.cameraController.zoomBy(multiplier);
  }

  getCameraZoom(): number {
    return this.cameraController.getZoom();
  }

  centerCameraOn(x: number, y: number): void {
    this.cameraController.setCenter(x, y);
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

  private syncResources(world: World, bounds: VisibleGridBounds): void {
    const visibleTileCount = this.visibleTileCount(bounds);
    this.ensureResourceBatchCapacity(visibleTileCount);

    for (const batch of this.resourceBatches.values()) {
      batch.outline.reset();
      batch.core.reset();
    }

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const tile = world.getTile(x, y);
        const resource = tile?.resource;
        if (!resource || resource.amount <= 0) {
          continue;
        }

        const batch = this.resourceBatches.get(resource.type);
        if (!batch) {
          continue;
        }

        const worldPosition = this.gridToWorld(x, y);
        const richness = resource.maxAmount > 0 ? resource.amount / resource.maxAmount : 0;
        const scale = THREE.MathUtils.lerp(0.34, 1, Math.min(Math.max(richness, 0), 1));

        this.matrixPosition.set(worldPosition.x, worldPosition.y, -0.01);
        this.matrixScale.set(scale, scale, 1);
        this.matrix.compose(this.matrixPosition, this.matrixQuaternion, this.matrixScale);
        batch.outline.push(this.matrix);

        this.matrixPosition.set(worldPosition.x, worldPosition.y, -0.008);
        this.matrix.compose(this.matrixPosition, this.matrixQuaternion, this.matrixScale);
        batch.core.push(this.matrix);
      }
    }

    for (const batch of this.resourceBatches.values()) {
      batch.outline.commit();
      batch.core.commit();
    }
  }

  private syncBuildings(world: World, bounds: VisibleGridBounds): void {
    const seenKeys = new Set<string>();

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const tile = world.getTile(x, y);
        if (!tile?.building) {
          continue;
        }

        const key = this.makeKey(x, y);
        seenKeys.add(key);

        const requiredKind = tile.building.kind;
        const currentNode = this.buildingNodes.get(key);
        const currentKind = this.buildingKinds.get(key);

        if (!currentNode || currentKind !== requiredKind) {
          if (currentNode) {
            this.buildingLayer.remove(currentNode);
          }

          const created = requiredKind === "machine"
            ? MeshFactory.createMachine(
              isDirectionalMachine(tile.building) ? tile.building.outputDirection : "right",
              tile.building.machineType
            )
            : requiredKind === "router"
              ? MeshFactory.createRouter(tile.building.direction)
              : MeshFactory.createBelt(tile.building.direction);

          this.buildingNodes.set(key, created);
          this.buildingKinds.set(key, requiredKind);
          this.buildingLayer.add(created);
        }

        const node = this.buildingNodes.get(key);
        if (!node) {
          continue;
        }

        const worldPosition = this.gridToWorld(x, y);
        node.position.set(worldPosition.x, worldPosition.y, 0);

        if (isConveyorNode(tile.building) && tile.building.kind === "belt") {
          MeshFactory.setBeltDirection(node, tile.building.direction);
        }
        if (isConveyorNode(tile.building) && tile.building.kind === "router") {
          MeshFactory.setRouterDirection(node, tile.building.direction);
        }
        if (tile.building.kind === "machine" && isDirectionalMachine(tile.building)) {
          MeshFactory.setMachineDirection(node, tile.building.outputDirection);
        }
      }
    }

    for (const [key, node] of this.buildingNodes.entries()) {
      if (!seenKeys.has(key)) {
        this.buildingLayer.remove(node);
        this.buildingNodes.delete(key);
        this.buildingKinds.delete(key);
      }
    }
  }

  private syncPlacementPreview(): void {
    const preview = this.placementPreview;
    if (!preview) {
      this.previewTile.visible = false;
      this.previewTileBorder.visible = false;
      if (this.previewNode) {
        this.previewNode.visible = false;
      }
      return;
    }

    if (!this.previewNode || this.previewKind !== preview.kind) {
      this.clearPlacementPreviewNode();
      this.previewNode = this.createPlacementPreviewNode(preview.kind, preview.direction);
      this.previewKind = preview.kind;
      this.preparePreviewMaterials(this.previewNode);
      this.previewLayer.add(this.previewNode);
    }

    if (!this.previewNode) {
      return;
    }

    const worldPosition = this.gridToWorld(preview.x, preview.y);
    this.previewNode.visible = true;
    this.previewNode.position.set(worldPosition.x, worldPosition.y, 0.04);

    if (preview.kind === "belt") {
      MeshFactory.setBeltDirection(this.previewNode, preview.direction);
    } else if (preview.kind === "router") {
      MeshFactory.setRouterDirection(this.previewNode, preview.direction);
    } else {
      MeshFactory.setMachineDirection(this.previewNode, preview.direction);
    }

    const tint = preview.canPlace ? this.previewValidColor : this.previewInvalidColor;
    this.applyPreviewTint(tint);

    this.previewTile.visible = true;
    this.previewTile.position.set(worldPosition.x, worldPosition.y, 0.03);
    this.previewTile.material.color.copy(tint);
    this.previewTile.material.opacity = preview.canPlace ? 0.2 : 0.28;

    this.previewTileBorder.visible = true;
    this.previewTileBorder.position.set(worldPosition.x, worldPosition.y, 0.035);
    this.previewTileBorder.material.color.copy(tint);
    this.previewTileBorder.material.opacity = preview.canPlace ? 0.82 : 0.9;
  }

  private syncItems(world: World, bounds: VisibleGridBounds): void {
    const seenUids = new Set<string>();

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const tile = world.getTile(x, y);
        if (!tile || !isConveyorNode(tile.building) || !tile.building.item) {
          continue;
        }

        const conveyor = tile.building;
        const item = conveyor.item;
        if (!item) {
          continue;
        }
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
      }
    }

    for (const [uid, mesh] of this.itemNodes.entries()) {
      if (!seenUids.has(uid)) {
        this.itemLayer.remove(mesh);
        this.itemNodes.delete(uid);
        this.itemTypes.delete(uid);
      }
    }
  }

  private createPlacementPreviewNode(
    kind: "belt" | "router" | "machine",
    direction: Direction
  ): THREE.Object3D {
    if (kind === "belt") {
      return MeshFactory.createBelt(direction);
    }
    if (kind === "router") {
      return MeshFactory.createRouter(direction);
    }
    return MeshFactory.createMachine(direction);
  }

  private preparePreviewMaterials(node: THREE.Object3D): void {
    this.previewMaterialStates = [];
    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => this.clonePreviewMaterial(material));
        return;
      }

      child.material = this.clonePreviewMaterial(child.material);
    });
  }

  private clonePreviewMaterial(material: THREE.Material): THREE.Material {
    const cloned = material.clone();
    if (cloned instanceof THREE.MeshBasicMaterial) {
      cloned.transparent = true;
      cloned.opacity = 0.74;
      cloned.depthWrite = false;
      this.previewMaterialStates.push({
        material: cloned,
        baseColor: cloned.color.clone(),
      });
    }
    return cloned;
  }

  private applyPreviewTint(tint: THREE.Color): void {
    for (const state of this.previewMaterialStates) {
      state.material.color.copy(state.baseColor).lerp(tint, 0.58);
      state.material.needsUpdate = true;
    }
  }

  private clearPlacementPreviewNode(): void {
    if (!this.previewNode) {
      this.previewKind = null;
      this.previewMaterialStates = [];
      return;
    }

    this.previewLayer.remove(this.previewNode);
    this.disposePreviewNodeMaterials(this.previewNode);
    this.previewNode = null;
    this.previewKind = null;
    this.previewMaterialStates = [];
  }

  private disposePreviewNodeMaterials(node: THREE.Object3D): void {
    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.dispose();
      }
    });
  }

  private syncPlayer(player: Player | undefined): void {
    if (!player) {
      if (this.playerNode) {
        this.playerLayer.remove(this.playerNode);
        this.playerNode = null;
      }
      return;
    }

    if (!this.playerNode) {
      this.playerNode = MeshFactory.createPlayer();
      this.playerLayer.add(this.playerNode);
    }

    this.playerNode.position.set(player.x, player.y, 0.09);
  }

  private syncRemotePlayers(remotePlayers: RemotePlayerRenderState[]): void {
    const seenIds = new Set<string>();
    for (const remotePlayer of remotePlayers) {
      seenIds.add(remotePlayer.id);

      let node = this.remotePlayerNodes.get(remotePlayer.id);
      if (!node) {
        node = MeshFactory.createPlayer(0xf6c177, 0x4a2b0f);
        this.remotePlayerNodes.set(remotePlayer.id, node);
        this.playerLayer.add(node);
      }

      node.position.set(remotePlayer.x, remotePlayer.y, 0.085);
    }

    for (const [id, node] of this.remotePlayerNodes.entries()) {
      if (seenIds.has(id)) {
        continue;
      }
      this.playerLayer.remove(node);
      this.remotePlayerNodes.delete(id);
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

  private visibleTileCount(bounds: VisibleGridBounds): number {
    const width = Math.max(0, bounds.maxX - bounds.minX + 1);
    const height = Math.max(0, bounds.maxY - bounds.minY + 1);
    return Math.max(1, width * height);
  }

  private ensureResourceBatchCapacity(requiredCount: number): void {
    if (requiredCount <= this.resourceBatchCapacity) {
      return;
    }

    let nextCapacity = Math.max(256, this.resourceBatchCapacity);
    while (nextCapacity < requiredCount) {
      nextCapacity *= 2;
    }
    this.rebuildResourceBatches(nextCapacity);
  }

  private rebuildResourceBatches(capacity: number): void {
    for (const batch of this.resourceBatches.values()) {
      this.resourceLayer.remove(batch.outline.mesh, batch.core.mesh);
    }
    this.resourceBatches.clear();

    for (const resourceType of RESOURCE_ITEM_IDS) {
      const outlineMesh = MeshFactory.createResourceOutlineInstanced(capacity);
      outlineMesh.frustumCulled = false;
      outlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const coreMesh = MeshFactory.createResourceCoreInstanced(resourceType, capacity);
      coreMesh.frustumCulled = false;
      coreMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      this.resourceLayer.add(outlineMesh, coreMesh);
      this.resourceBatches.set(resourceType, {
        outline: new InstancedBatch(outlineMesh),
        core: new InstancedBatch(coreMesh),
      });
    }

    this.resourceBatchCapacity = capacity;
  }

  private getVisibleGridBounds(marginTiles = 0): VisibleGridBounds {
    const camera = this.cameraController.camera;
    const halfVisibleWidth = (camera.right - camera.left) * 0.5 / camera.zoom;
    const halfVisibleHeight = (camera.top - camera.bottom) * 0.5 / camera.zoom;

    const minWorldX = camera.position.x - halfVisibleWidth - marginTiles;
    const maxWorldX = camera.position.x + halfVisibleWidth + marginTiles;
    const minWorldY = camera.position.y - halfVisibleHeight - marginTiles;
    const maxWorldY = camera.position.y + halfVisibleHeight + marginTiles;

    const minX = Math.max(0, Math.floor(minWorldX + this.world.width / 2));
    const maxX = Math.min(this.world.width - 1, Math.floor(maxWorldX + this.world.width / 2));

    const minY = Math.max(0, Math.floor(this.world.height / 2 - maxWorldY));
    const maxY = Math.min(this.world.height - 1, Math.floor(this.world.height / 2 - minWorldY));

    if (minX > maxX || minY > maxY) {
      return { minX: 0, maxX: -1, minY: 0, maxY: -1 };
    }

    return { minX, maxX, minY, maxY };
  }
}
