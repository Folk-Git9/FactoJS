import { PlayerInventory } from "./PlayerInventory";

export class Player {
  x: number;
  y: number;
  readonly speedTilesPerSecond: number;
  readonly pickupRadius: number;
  readonly maxHealth: number;
  readonly inventory = new PlayerInventory();
  health: number;

  constructor(x: number, y: number, speedTilesPerSecond = 6.5, pickupRadius = 1.2, maxHealth = 100) {
    this.x = x;
    this.y = y;
    this.speedTilesPerSecond = speedTilesPerSecond;
    this.pickupRadius = pickupRadius;
    this.maxHealth = Math.max(1, maxHealth);
    this.health = this.maxHealth;
  }

  applyDamage(amount: number): void {
    this.health = Math.max(0, this.health - Math.max(0, amount));
  }

  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.health = this.maxHealth;
  }
}
