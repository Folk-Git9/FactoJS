import * as THREE from "three";
import type { Direction } from "../core/types";
import { getItemDefinition, type ItemId, type ResourceItemId } from "../data/items";

const BELT_BASE_GEOMETRY = new THREE.PlaneGeometry(0.9, 0.9);
const BELT_ARROW_SHAPE = new THREE.Shape();
BELT_ARROW_SHAPE.moveTo(-0.18, -0.16);
BELT_ARROW_SHAPE.lineTo(0.08, -0.16);
BELT_ARROW_SHAPE.lineTo(0.08, -0.26);
BELT_ARROW_SHAPE.lineTo(0.28, 0);
BELT_ARROW_SHAPE.lineTo(0.08, 0.26);
BELT_ARROW_SHAPE.lineTo(0.08, 0.16);
BELT_ARROW_SHAPE.lineTo(-0.18, 0.16);
BELT_ARROW_SHAPE.lineTo(-0.18, -0.16);
const BELT_ARROW_GEOMETRY = new THREE.ShapeGeometry(BELT_ARROW_SHAPE);

const MACHINE_GEOMETRY = new THREE.PlaneGeometry(0.9, 0.9);
const MACHINE_PORT_GEOMETRY = new THREE.CircleGeometry(0.12, 18);
const ROUTER_BASE_GEOMETRY = new THREE.PlaneGeometry(0.9, 0.9);
const ROUTER_CORE_GEOMETRY = new THREE.CircleGeometry(0.16, 20);
const PLAYER_BODY_GEOMETRY = new THREE.CircleGeometry(0.28, 24);
const PLAYER_CORE_GEOMETRY = new THREE.CircleGeometry(0.13, 20);
const RESOURCE_GEOMETRY = new THREE.CircleGeometry(0.35, 10);
const RESOURCE_CORE_GEOMETRY = new THREE.CircleGeometry(0.26, 10);

const BELT_BASE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xf5a524 });
const BELT_ARROW_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x1f2329 });
const MACHINE_BASE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x4e6479 });
const MACHINE_PORT_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xe9edf2 });
const ROUTER_BASE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x17a2b8 });
const ROUTER_CORE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xe8f4f7 });
const PLAYER_BODY_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
const PLAYER_CORE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x082f49 });
const RESOURCE_OUTLINE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x1b222c });
const RESOURCE_CORE_MATERIALS: Record<ResourceItemId, THREE.MeshBasicMaterial> = {
  stone: new THREE.MeshBasicMaterial({ color: getItemDefinition("stone").color }),
  iron_ore: new THREE.MeshBasicMaterial({ color: getItemDefinition("iron_ore").color }),
  coal_ore: new THREE.MeshBasicMaterial({ color: getItemDefinition("coal_ore").color }),
};

const directionToRotationZ = (direction: Direction): number => {
  switch (direction) {
    case "right":
      return 0;
    case "down":
      return -Math.PI / 2;
    case "left":
      return Math.PI;
    case "up":
      return Math.PI / 2;
  }
};

export class MeshFactory {
  static createGrid(width: number, height: number): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    for (let x = -halfWidth; x <= halfWidth; x += 1) {
      points.push(new THREE.Vector3(x, -halfHeight, 0), new THREE.Vector3(x, halfHeight, 0));
    }

    for (let y = -halfHeight; y <= halfHeight; y += 1) {
      points.push(new THREE.Vector3(-halfWidth, y, 0), new THREE.Vector3(halfWidth, y, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x2d3642,
      transparent: true,
      opacity: 0.9,
    });

    return new THREE.LineSegments(geometry, material);
  }

  static createBelt(direction: Direction): THREE.Group {
    const group = new THREE.Group();

    const base = new THREE.Mesh(BELT_BASE_GEOMETRY, BELT_BASE_MATERIAL);
    base.position.set(0, 0, 0);
    group.add(base);

    const arrow = new THREE.Mesh(BELT_ARROW_GEOMETRY, BELT_ARROW_MATERIAL);
    arrow.name = "arrow";
    arrow.position.set(0, 0, 0.01);
    group.add(arrow);

    this.setBeltDirection(group, direction);
    return group;
  }

  static setBeltDirection(group: THREE.Object3D, direction: Direction): void {
    const arrow = group.getObjectByName("arrow");
    if (!arrow) {
      return;
    }
    arrow.rotation.z = directionToRotationZ(direction);
  }

  static createMachine(direction: Direction): THREE.Group {
    const group = new THREE.Group();

    const base = new THREE.Mesh(MACHINE_GEOMETRY, MACHINE_BASE_MATERIAL);
    base.position.set(0, 0, 0);
    group.add(base);

    const port = new THREE.Mesh(MACHINE_PORT_GEOMETRY, MACHINE_PORT_MATERIAL);
    port.name = "port";
    port.position.set(0.25, 0, 0.01);
    group.add(port);

    this.setMachineDirection(group, direction);
    return group;
  }

  static setMachineDirection(group: THREE.Object3D, direction: Direction): void {
    const port = group.getObjectByName("port");
    if (!port) {
      return;
    }
    const rotation = directionToRotationZ(direction);
    port.position.set(Math.cos(rotation) * 0.25, Math.sin(rotation) * 0.25, 0.01);
  }

  static createRouter(direction: Direction): THREE.Group {
    const group = new THREE.Group();

    const base = new THREE.Mesh(ROUTER_BASE_GEOMETRY, ROUTER_BASE_MATERIAL);
    base.position.set(0, 0, 0);
    group.add(base);

    const arrow = new THREE.Mesh(BELT_ARROW_GEOMETRY, BELT_ARROW_MATERIAL);
    arrow.name = "arrow";
    arrow.position.set(0, 0.18, 0.01);
    arrow.scale.set(0.85, 0.85, 1);
    group.add(arrow);

    const core = new THREE.Mesh(ROUTER_CORE_GEOMETRY, ROUTER_CORE_MATERIAL);
    core.position.set(0, -0.08, 0.01);
    group.add(core);

    this.setRouterDirection(group, direction);
    return group;
  }

  static setRouterDirection(group: THREE.Object3D, direction: Direction): void {
    const arrow = group.getObjectByName("arrow");
    if (!arrow) {
      return;
    }
    arrow.rotation.z = directionToRotationZ(direction);
  }

  static createItem(itemType: ItemId): THREE.Mesh {
    const definition = getItemDefinition(itemType);
    const geometry = new THREE.CircleGeometry(0.12, 18);
    const material = new THREE.MeshBasicMaterial({ color: definition.color });
    return new THREE.Mesh(geometry, material);
  }

  static createPlayer(): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(PLAYER_BODY_GEOMETRY, PLAYER_BODY_MATERIAL);
    body.position.set(0, 0, 0);
    group.add(body);

    const core = new THREE.Mesh(PLAYER_CORE_GEOMETRY, PLAYER_CORE_MATERIAL);
    core.position.set(0, 0, 0.02);
    group.add(core);

    return group;
  }

  static createResourceDeposit(resource: ResourceItemId): THREE.Group {
    const group = new THREE.Group();

    const outline = new THREE.Mesh(RESOURCE_GEOMETRY, RESOURCE_OUTLINE_MATERIAL);
    outline.position.set(0, 0, 0);
    group.add(outline);

    const core = new THREE.Mesh(RESOURCE_CORE_GEOMETRY, RESOURCE_CORE_MATERIALS[resource]);
    core.position.set(0, 0, 0.01);
    group.add(core);

    return group;
  }

  static createResourceOutlineInstanced(capacity: number): THREE.InstancedMesh {
    return new THREE.InstancedMesh(RESOURCE_GEOMETRY, RESOURCE_OUTLINE_MATERIAL, capacity);
  }

  static createResourceCoreInstanced(resource: ResourceItemId, capacity: number): THREE.InstancedMesh {
    return new THREE.InstancedMesh(RESOURCE_CORE_GEOMETRY, RESOURCE_CORE_MATERIALS[resource], capacity);
  }
}
