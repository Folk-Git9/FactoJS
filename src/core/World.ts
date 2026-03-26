import { Belt } from "../entities/Belt";
import { isConveyorNode } from "../entities/Conveyor";
import { Item } from "../entities/Item";
import { Machine } from "../entities/Machine";
import { Router } from "../entities/Router";
import { Grid } from "../grid/Grid";
import type { Direction, GridPosition } from "./types";
import { DIRECTION_TO_GRID_OFFSET, oppositeDirection } from "./types";
import type { ItemId } from "../data/items";

export class World {
  readonly grid: Grid;
  tick = 0;
  elapsedSeconds = 0;

  constructor(width: number, height: number) {
    this.grid = new Grid(width, height);
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

    const machine = new Machine(outputItem, direction);
    tile.building = machine;
    return machine;
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
}
