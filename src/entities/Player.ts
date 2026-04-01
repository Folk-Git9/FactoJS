import { PlayerInventory } from "./PlayerInventory";

export class Player {
  x: number;
  y: number;
  readonly speedTilesPerSecond: number;
  readonly pickupRadius: number;
  readonly inventory = new PlayerInventory();

  constructor(x: number, y: number, speedTilesPerSecond = 6.5, pickupRadius = 1.2) {
    this.x = x;
    this.y = y;
    this.speedTilesPerSecond = speedTilesPerSecond;
    this.pickupRadius = pickupRadius;
  }
}
