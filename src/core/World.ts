import { Belt } from "../entities/Belt";
import { Container } from "../entities/Container";
import { Drill } from "../entities/Drill";
import { isConveyorNode } from "../entities/Conveyor";
import { Furnace } from "../entities/Furnace";
import { Item } from "../entities/Item";
import { TestProducer, type Machine } from "../entities/Machine";
import { Router } from "../entities/Router";
import { Unloader } from "../entities/Unloader";
import { Grid } from "../grid/Grid";
import type { ResourceDeposit } from "../grid/Tile";
import type { Direction, GridPosition } from "./types";
import { DIRECTION_TO_GRID_OFFSET, oppositeDirection } from "./types";
import type { ItemId, ResourceItemId } from "../data/items";

export class World {
  readonly grid: Grid;
  tick = 0;
  elapsedSeconds = 0;

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
    tile.building = belt;
    return belt;
  }

  placeRouter(x: number, y: number, direction: Direction): Router | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const previous = tile.building;
    const router = new Router(direction);
    if (isConveyorNode(previous) && previous.item) {
      router.acceptItem(previous.item, previous.progress, previous.entryDirection);
    }
    tile.building = router;
    return router;
  }

  placeMachine(x: number, y: number, outputItem: ItemId, direction: Direction): Machine | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const machine = new TestProducer(outputItem, direction);
    tile.building = machine;
    return machine;
  }

  placeFurnace(x: number, y: number, direction: Direction): Furnace | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const furnace = new Furnace(direction);
    tile.building = furnace;
    return furnace;
  }

  placeDrill(x: number, y: number, direction: Direction): Drill | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const initialResourceType = tile.resource?.type ?? null;
    const drill = new Drill(direction, () => this.mineResourceAt(x, y, 1), initialResourceType);
    tile.building = drill;
    return drill;
  }

  placeContainer(x: number, y: number): Container | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const container = new Container();
    tile.building = container;
    return container;
  }

  placeIronChest(x: number, y: number): Container | null {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return null;
    }

    const chest = new Container(36, 200, "iron_chest");
    tile.building = chest;
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
    tile.building = unloader;
    return unloader;
  }

  clearBuilding(x: number, y: number): void {
    const tile = this.grid.get(x, y);
    if (!tile) {
      return;
    }
    tile.building = null;
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
}
