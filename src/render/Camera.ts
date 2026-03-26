import * as THREE from "three";

export class CameraController {
  readonly camera: THREE.OrthographicCamera;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly baseViewHeight: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private aspect = 1;
  private zoom = 1;
  private centerX = 0;
  private centerY = 0;

  constructor(worldWidth: number, worldHeight: number, baseViewHeight = 18, minZoom = 0.45, maxZoom = 3.5) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.baseViewHeight = baseViewHeight;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.camera = new THREE.OrthographicCamera();
    this.applyProjection();
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    this.aspect = Math.max(viewportWidth / Math.max(viewportHeight, 1), 0.0001);
    this.clampCenter();
    this.applyProjection();
  }

  moveBy(dx: number, dy: number): void {
    this.centerX += dx;
    this.centerY += dy;
    this.clampCenter();
    this.applyProjection();
  }

  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.clampCenter();
    this.applyProjection();
  }

  zoomBy(multiplier: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * multiplier, this.minZoom, this.maxZoom);
    this.clampCenter();
    this.applyProjection();
  }

  getVisibleWorldWidth(): number {
    return this.baseViewHeight * this.aspect / this.zoom;
  }

  getVisibleWorldHeight(): number {
    return this.baseViewHeight / this.zoom;
  }

  getZoom(): number {
    return this.zoom;
  }

  private applyProjection(): void {
    const halfHeight = this.baseViewHeight / 2;
    const halfWidth = halfHeight * this.aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.zoom = this.zoom;
    this.camera.position.set(this.centerX, this.centerY, 20);
    this.camera.lookAt(this.centerX, this.centerY, 0);
    this.camera.updateProjectionMatrix();
  }

  private clampCenter(): void {
    const halfVisibleWidth = this.getVisibleWorldWidth() / 2;
    const halfVisibleHeight = this.getVisibleWorldHeight() / 2;
    const halfWorldWidth = this.worldWidth / 2;
    const halfWorldHeight = this.worldHeight / 2;

    const minX = -halfWorldWidth + halfVisibleWidth;
    const maxX = halfWorldWidth - halfVisibleWidth;
    const minY = -halfWorldHeight + halfVisibleHeight;
    const maxY = halfWorldHeight - halfVisibleHeight;

    this.centerX = minX <= maxX ? THREE.MathUtils.clamp(this.centerX, minX, maxX) : 0;
    this.centerY = minY <= maxY ? THREE.MathUtils.clamp(this.centerY, minY, maxY) : 0;
  }
}
