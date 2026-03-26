import { oppositeDirection, type Direction } from "../core/types";
import type { ConveyorNode } from "./Conveyor";
import type { Item } from "./Item";

export class Belt implements ConveyorNode {
  readonly kind = "belt";
  direction: Direction;
  speedTilesPerSecond: number;
  item: Item | null;
  progress: number;
  entryDirection: Direction;

  constructor(direction: Direction, speedTilesPerSecond = 2) {
    this.direction = direction;
    this.speedTilesPerSecond = speedTilesPerSecond;
    this.item = null;
    this.progress = 0;
    this.entryDirection = oppositeDirection(direction);
  }

  canAcceptItem(): boolean {
    return this.item === null;
  }

  acceptItem(item: Item, progress = 0, entryDirection = oppositeDirection(this.direction)): void {
    this.item = item;
    this.progress = Math.min(Math.max(progress, 0), 0.99);
    this.entryDirection = entryDirection;
  }

  releaseItem(): Item | null {
    const released = this.item;
    this.item = null;
    this.progress = 0;
    this.entryDirection = oppositeDirection(this.direction);
    return released;
  }

  getOutputDirections(_entryDirection: Direction): Direction[] {
    return [this.direction];
  }
}
