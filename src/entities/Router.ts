import { DIRECTIONS, oppositeDirection, type Direction } from "../core/types";
import type { ConveyorNode } from "./Conveyor";
import type { Item } from "./Item";

export class Router implements ConveyorNode {
  readonly kind = "router";
  direction: Direction;
  speedTilesPerSecond: number;
  item: Item | null;
  progress: number;
  entryDirection: Direction;
  private nextOutputCursor = 0;

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

  getOutputDirections(entryDirection: Direction): Direction[] {
    const candidates = this.getCandidates(entryDirection);
    if (candidates.length === 0) {
      return [this.direction];
    }

    const start = this.nextOutputCursor % candidates.length;
    return [...candidates.slice(start), ...candidates.slice(0, start)];
  }

  onItemDispatched(outputDirection: Direction): void {
    const candidates = this.getCandidates(this.entryDirection);
    if (candidates.length === 0) {
      this.direction = outputDirection;
      return;
    }

    const outputIndex = candidates.indexOf(outputDirection);
    if (outputIndex >= 0) {
      this.nextOutputCursor = (outputIndex + 1) % candidates.length;
    }
    this.direction = outputDirection;
  }

  private getCandidates(entryDirection: Direction): Direction[] {
    const backDirection = oppositeDirection(entryDirection);
    return DIRECTIONS.filter((direction) => direction !== backDirection);
  }
}
