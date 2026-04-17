import { Belt } from "../entities/Belt";
import { Container } from "../entities/Container";
import { Drill } from "../entities/Drill";
import { isConveyorNode } from "../entities/Conveyor";
import { Furnace } from "../entities/Furnace";
import { Item } from "../entities/Item";
import { TestProducer, type Machine } from "../entities/Machine";
import { ProgrammableMachine } from "../entities/ProgrammableMachine";
import { Router } from "../entities/Router";
import { ShotTracer } from "../entities/ShotTracer";
import { Turret } from "../entities/Turret";
import { Unloader } from "../entities/Unloader";
import { Zombie } from "../entities/Zombie";
import { Grid } from "../grid/Grid";
import type { ResourceDeposit } from "../grid/Tile";
import type { Building } from "../grid/Tile";
import type { Direction, GridPosition } from "./types";
import { DIRECTION_TO_GRID_OFFSET, oppositeDirection } from "./types";
import type { ItemId, ResourceItemId } from "../data/items";

export class World {
  readonly grid: Grid;
  readonly zombies: Zombie[] = [];
  readonly tracers: ShotTracer[] = [];
  tick = 0;
  elapsedSeconds = 0;
  private readonly buildingHealth = new Map<string, { current: number; max: number }>();
  private nextZombieId = 1;
  private nextTracerId = 1;

  constructor(width: number, height: number) {
    this.grid = new Grid(width, height);
    this.generateResourcePatches();
  }

  get width(): number {
    return this.grid.width;
  }

  get height(): number {
    return this.grid.height;
  }

  advance(deltaSeconds: number): void {
    this.tick += 1;
    this.elapsedSeconds += deltaSeconds;
  }

  getTile(x: number, y: number) {
    return this.grid.get(x, y);
  }

  mineResourceAt(x: number, y: number, amount = 1): ResourceItemId | null {
    const tile = this.grid.get(x, y);
    if (!tile || !tile.resource || amount <= 0) {
      return null;
    }

    const resourceType = tile.resource.type;
    tile.resource.amount = Math.max(0, tile.resource.amount - amount);
    if (tile.resource.amount === 0) {
      tile.resource = null;
    }
    return resourceType;
  }

  getNeighborPosition(x: number, y: number, direction: Direction): GridPosition | null {
    const offset = DIRECTION_TO_GRID_OFFSET[direction];
    const nx = x + offset.x;
    const ny = y + offset.y;
    if (!this.grid.isInBounds(nx, ny)) {
      return null;
    }
    return { x: nx, y: ny };
  }

  placeBelt(x: number, y: number, direction: Direction): Belt | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const previous = tile.building;
    const belt = new Belt(direction);
    if (isConveyorNode(previous) && previous.item) {
      belt.acceptItem(previous.item, previous.progress, previous.entryDirection);
    }
    this.setBuildingAt(x, y, belt);
    return belt;
  }

  placeRouter(x: number, y: number, direction: Direction): Router | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const previous = tile.building;
    const router = new Router(direction, () => ({
      tick: this.tick,
      time: this.elapsedSeconds,
    }));
    if (isConveyorNode(previous) && previous.item) {
      router.acceptItem(previous.item, previous.progress, previous.entryDirection);
    }
    this.setBuildingAt(x, y, router);
    return router;
  }

  placeMachine(x: number, y: number, outputItem: ItemId, direction: Direction): Machine | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const machine = new TestProducer(outputItem, direction);
    this.setBuildingAt(x, y, machine);
    return machine;
  }

  placeFurnace(x: number, y: number, direction: Direction): Furnace | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const furnace = new Furnace(direction);
    this.setBuildingAt(x, y, furnace);
    return furnace;
  }

  placeDrill(x: number, y: number, direction: Direction): Drill | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const initialResourceType = tile.resource?.type ?? null;
    const drill = new Drill(direction, () => this.mineResourceAt(x, y, 1), initialResourceType);
    this.setBuildingAt(x, y, drill);
    return drill;
  }

  placeContainer(x: number, y: number): Container | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const container = new Container();
    this.setBuildingAt(x, y, container);
    return container;
  }

  placeIronChest(x: number, y: number): Container | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const chest = new Container(36, 200, "iron_chest");
    this.setBuildingAt(x, y, chest);
    return chest;
  }

  placeUnloader(x: number, y: number, direction: Direction): Unloader | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    let unloader: Unloader;
    const getSourceContainer = (): Container | null => {
      const sourcePosition = this.getNeighborPosition(x, y, oppositeDirection(unloader.outputDirection));
      if (!sourcePosition) {
        return null;
      }

      const sourceTile = this.getTile(sourcePosition.x, sourcePosition.y);
      if (!sourceTile?.building || sourceTile.building.kind !== "machine") {
        return null;
      }

      if (!(sourceTile.building instanceof Container)) {
        return null;
      }

      return sourceTile.building as Container;
    };

    unloader = new Unloader(direction, getSourceContainer);
    this.setBuildingAt(x, y, unloader);
    return unloader;
  }

  placeProgrammableMachine(x: number, y: number, direction: Direction): ProgrammableMachine | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const machine = new ProgrammableMachine(direction, () => ({
      tick: this.tick,
      time: this.elapsedSeconds,
    }));
    this.setBuildingAt(x, y, machine);
    return machine;
  }

  placeTurret(x: number, y: number, direction: Direction): Turret | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const turret = new Turret(direction);
    this.setBuildingAt(x, y, turret);
    return turret;
  }

  clearBuilding(x: number, y: number): void {
    this.setBuildingAt(x, y, null);
  }

  spawnItemOnConveyor(x: number, y: number, itemType: ItemId, progress = 0): boolean {
    const tile = this.grid.get(x, y);
    if (!tile || !isConveyorNode(tile.building) || !tile.building.canAcceptItem()) {
      return false;
    }

    tile.building.acceptItem(new Item(itemType), progress, oppositeDirection(tile.building.direction));
    return true;
  }

  spawnItemOnBelt(x: number, y: number, itemType: ItemId, progress = 0): boolean {
    return this.spawnItemOnConveyor(x, y, itemType, progress);
  }

  countItemsOnConveyors(): number {
    let count = 0;
    this.grid.forEach((tile) => {
      if (isConveyorNode(tile.building) && tile.building.item) {
        count += 1;
      }
    })
    return count;
  }

  countItemsOnBelts(): number {
    return this.countItemsOnConveyors();
  }

  gridToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: x - this.width / 2 + 0.5,
      y: this.height / 2 - y - 0.5,
    };
  }

  clampWorldX(x: number): number {
    return Math.min(this.width / 2 - 0.5, Math.max(-this.width / 2 + 0.5, x));
  }

  clampWorldY(y: number): number {
    return Math.min(this.height / 2 - 0.5, Math.max(-this.height / 2 + 0.5, y));
  }

  getDefendedAreaCenter(fallbackX: number, fallbackY: number): { x: number; y: number } {
    const anchors = this.getBuildingAnchors();
    if (anchors.length <= 0) {
      return {
        x: this.clampWorldX(fallbackX),
        y: this.clampWorldY(fallbackY),
      };
    }

    let sumX = 0;
    let sumY = 0;
    for (const anchor of anchors) {
      sumX += anchor.x;
      sumY += anchor.y;
    }
    return {
      x: sumX / anchors.length,
      y: sumY / anchors.length,
    };
  }

  getBuildingAnchors(): Array<{ gridX: number; gridY: number; x: number; y: number }> {
    const anchors: Array<{ gridX: number; gridY: number; x: number; y: number }> = [];
    for (const key of this.buildingHealth.keys()) {
      const [rawX, rawY] = key.split(":");
      const gridX = Number(rawX);
      const gridY = Number(rawY);
      if (!Number.isInteger(gridX) || !Number.isInteger(gridY)) {
        continue;
      }
      const worldPosition = this.gridToWorld(gridX, gridY);
      anchors.push({
        gridX,
        gridY,
        x: worldPosition.x,
        y: worldPosition.y,
      });
    }
    return anchors;
  }

  damageBuilding(x: number, y: number, damage: number): boolean {
    const key = this.makeBuildingKey(x, y);
    const health = this.buildingHealth.get(key);
    if (!health) {
      return false;
    }

    health.current = Math.max(0, health.current - Math.max(0, damage));
    if (health.current > 0) {
      this.buildingHealth.set(key, health);
      return false;
    }

    this.clearBuilding(x, y);
    return true;
  }

  spawnZombie(
    x: number,
    y: number,
    maxHealth?: number,
    moveSpeedTilesPerSecond?: number,
    attackRange?: number,
    attackDamage?: number,
    attackCooldownSeconds?: number
  ): Zombie {
    const zombie = new Zombie(
      `z${this.nextZombieId++}`,
      x,
      y,
      maxHealth,
      moveSpeedTilesPerSecond,
      attackRange,
      attackDamage,
      attackCooldownSeconds
    );
    this.zombies.push(zombie);
    return zombie;
  }

  removeDeadZombies(): void {
    for (let i = this.zombies.length - 1; i >= 0; i -= 1) {
      if (this.zombies[i]?.health ?? 0 > 0) {
        continue;
      }
      this.zombies.splice(i, 1);
    }
  }

  spawnTracer(fromX: number, fromY: number, toX: number, toY: number, durationSeconds?: number): ShotTracer {
    const tracer = new ShotTracer(`t${this.nextTracerId++}`, fromX, fromY, toX, toY, durationSeconds);
    this.tracers.push(tracer);
    return tracer;
  }

  removeExpiredTracers(): void {
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      if ((this.tracers[i]?.remainingSeconds ?? 0) > 0) {
        continue;
      }
      this.tracers.splice(i, 1);
    }
  }

  seedDemoLayout(): void {
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    const startX = Math.max(2, centerX - 12);
    const row = Math.max(2, Math.min(this.height - 5, centerY));

    this.placeMachine(startX, row, "iron_ore", "right");

    const straightEndX = Math.min(this.width - 4, startX + 10);
    for (let x = startX + 1; x <= straightEndX; x += 1) {
      this.placeBelt(x, row, "right");
    }

    const turnX = Math.min(this.width - 4, straightEndX + 1);
    this.placeBelt(turnX, row, "down");
    this.placeBelt(turnX, row + 1, "down");
    this.placeBelt(turnX, row + 2, "down");
    this.placeBelt(turnX, row + 3, "right");

    const tailEndX = Math.min(this.width - 3, turnX + 6);
    for (let x = turnX + 1; x <= tailEndX; x += 1) {
      this.placeBelt(x, row + 3, "right");
    }

    this.placeRouter(Math.min(straightEndX, startX + 7), row, "right");
  }

  private generateResourcePatches(): void {
    const area = this.width * this.height;
    const rng = this.createRng((this.width * 73856093) ^ (this.height * 19349663));

    const amplifier = 100;

    const configs: Array<{
      type: ResourceItemId;
      patches: number;
      minRadius: number;
      maxRadius: number;
      minAmount: number;
      maxAmount: number;
    }> = [
      {
        type: "stone",
        patches: Math.max(10, Math.floor(area / 2400)),
        minRadius: 3,
        maxRadius: 8,
        minAmount: 10 * amplifier,
        maxAmount: 34 * amplifier,
      },
      {
        type: "iron_ore",
        patches: Math.max(14, Math.floor(area / 1800)),
        minRadius: 4,
        maxRadius: 10,
        minAmount: 14 * amplifier,
        maxAmount: 44 * amplifier,
      },
      {
        type: "coal_ore",
        patches: Math.max(10, Math.floor(area / 2200)),
        minRadius: 3,
        maxRadius: 9,
        minAmount: 12 * amplifier,
        maxAmount: 40 * amplifier,
      },
    ];

    for (const config of configs) {
      for (let i = 0; i < config.patches; i += 1) {
        const centerX = Math.floor(rng() * this.width);
        const centerY = Math.floor(rng() * this.height);
        const radius = config.minRadius + rng() * (config.maxRadius - config.minRadius);

        this.applyResourcePatch(centerX, centerY, radius, config.type, config.minAmount, config.maxAmount, rng);
      }
    }

    for (const config of configs) {
      if (!this.hasResourceType(config.type)) {
        const x = Math.floor(rng() * this.width);
        const y = Math.floor(rng() * this.height);
        this.applyResourcePatch(x, y, config.minRadius + 1, config.type, config.minAmount, config.maxAmount, rng);
      }
    }

    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    this.applyResourcePatch(centerX - 6, centerY + 2, 4, "stone", 12 * amplifier, 30 * amplifier, rng);
    this.applyResourcePatch(centerX + 4, centerY - 3, 4.5, "iron_ore", 14 * amplifier, 36 * amplifier, rng);
    this.applyResourcePatch(centerX + 8, centerY + 4, 4, "coal_ore", 12 * amplifier, 34 * amplifier, rng);
  }

  private applyResourcePatch(
    centerX: number,
    centerY: number,
    radius: number,
    type: ResourceItemId,
    minAmount: number,
    maxAmount: number,
    rng: () => number
  ): void {
    const r = Math.ceil(radius);

    for (let y = centerY - r; y <= centerY + r; y += 1) {
      for (let x = centerX - r; x <= centerX + r; x += 1) {
        const tile = this.grid.get(x, y);
        if (!tile) {
          continue;
        }

        const jitterX = (rng() - 0.5) * 0.6;
        const jitterY = (rng() - 0.5) * 0.6;
        const distance = Math.hypot(x + jitterX - centerX, y + jitterY - centerY);
        const threshold = radius * (0.82 + rng() * 0.25);
        if (distance > threshold) {
          continue;
        }

        const richness = 1 - Math.min(1, distance / Math.max(radius, 0.001));
        const amount = Math.max(2, Math.round(minAmount + (maxAmount - minAmount) * richness + rng() * 4));
        const deposit: ResourceDeposit = {
          type,
          amount,
          maxAmount: amount,
        };

        if (!tile.resource || deposit.amount > tile.resource.amount) {
          tile.resource = deposit;
        }
      }
    }
  }

  private hasResourceType(type: ResourceItemId): boolean {
    let found = false;
    this.grid.forEach((tile) => {
      if (!found && tile.resource?.type === type) {
        found = true;
      }
    });
    return found;
  }

  private createRng(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private setBuildingAt(x: number, y: number, building: Building | null): void {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return;
    }

    tile.building = building;
    const key = this.makeBuildingKey(x, y);
    if (!building) {
      this.buildingHealth.delete(key);
      return;
    }

    const maxHealth = this.getMaxBuildingHealth(building);
    this.buildingHealth.set(key, {
      current: maxHealth,
      max: maxHealth,
    });
  }

  private getMaxBuildingHealth(building: Building): number {
    if (building.kind === "belt") {
      return 24;
    }
    if (building.kind === "router") {
      return 32;
    }
    if (building.kind !== "machine") {
      return 48;
    }
    if (building.machineType === "container" || building.machineType === "iron_chest") {
      return 72;
    }
    if (building.machineType === "furnace" || building.machineType === "drill") {
      return 64;
    }
    if (building.machineType === "unloader" || building.machineType === "programmable_machine") {
      return 54;
    }
    if (building.machineType === "turret") {
      return 90;
    }
    return 48;
  }

  private makeBuildingKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
