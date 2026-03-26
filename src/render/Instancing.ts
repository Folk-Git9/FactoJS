import * as THREE from "three";

export class InstancedBatch {
  readonly mesh: THREE.InstancedMesh;
  private nextIndex = 0;

  constructor(mesh: THREE.InstancedMesh) {
    this.mesh = mesh;
  }

  reset(): void {
    this.nextIndex = 0;
  }

  push(matrix: THREE.Matrix4): boolean {
    if (this.nextIndex >= this.mesh.count) {
      return false;
    }
    this.mesh.setMatrixAt(this.nextIndex, matrix);
    this.nextIndex += 1;
    return true;
  }

  commit(): void {
    this.mesh.count = this.nextIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
