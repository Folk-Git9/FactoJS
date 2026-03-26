import type { Direction } from "../core/types";
import type { ItemId } from "../data/items";

export class Machine {
  readonly kind = "machine";
  readonly outputItem: ItemId;
  outputDirection: Direction;
  cycleSeconds: number;
  private timerSeconds: number;

  constructor(outputItem: ItemId, outputDirection: Direction, cycleSeconds = 1.2) {
    this.outputItem = outputItem;
    this.outputDirection = outputDirection;
    this.cycleSeconds = cycleSeconds;
    this.timerSeconds = 0;
  }

  advance(deltaSeconds: number): number {
    this.timerSeconds += deltaSeconds;
    const produced = Math.floor(this.timerSeconds / this.cycleSeconds);
    if (produced > 0) {
      this.timerSeconds -= produced * this.cycleSeconds;
    }
    return produced;
  }

  get progress01(): number {
    return this.timerSeconds / this.cycleSeconds;
  }
}
