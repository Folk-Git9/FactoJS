import type { Direction } from "../core/types";
import type { ItemId } from "../data/items";
import type { Zombie } from "./Zombie";
import { Item } from "./Item";
import type { ItemHandler } from "./ItemHandler";
import type { InputMachine, Machine } from "./Machine";
import type { InventorySlotStack } from "./PlayerInventory";

export class Turret implements Machine, InputMachine, ItemHandler {
  readonly kind = "machine";
  readonly machineType = "turret";
  outputDirection: Direction;

  readonly rangeTiles: number;
  readonly damagePerShot: number;
  readonly fireCooldownSeconds: number;
  readonly maxAmmo: number;

  private fireCooldownRemainingSeconds = 0;
  private ammoCount = 0;

  constructor(
    outputDirection: Direction,
    rangeTiles = 7.5,
    damagePerShot = 12,
    fireCooldownSeconds = 0.4,
    maxAmmo = 200
  ) {
    this.outputDirection = outputDirection;
    this.rangeTiles = Math.max(1, rangeTiles);
    this.damagePerShot = Math.max(1, damagePerShot);
    this.fireCooldownSeconds = Math.max(0.05, fireCooldownSeconds);
    this.maxAmmo = Math.max(1, Math.floor(maxAmmo));
  }

  canAcceptInput(itemType: ItemId, _inputDirection: Direction): boolean {
    return itemType === "ammo_rounds" && this.ammoCount < this.maxAmmo;
  }

  acceptInput(item: Item, inputDirection: Direction): boolean {
    if (!this.canAcceptInput(item.type, inputDirection)) {
      return false;
    }
    this.ammoCount += 1;
    return true;
  }

  advanceCombat(deltaSeconds: number): void {
    this.fireCooldownRemainingSeconds = Math.max(0, this.fireCooldownRemainingSeconds - deltaSeconds);
  }

  canFireAtDistance(distance: number): boolean {
    return this.ammoCount > 0 && this.fireCooldownRemainingSeconds <= 1e-6 && distance <= this.rangeTiles;
  }

  fireAt(zombie: Zombie): boolean {
    if (this.ammoCount <= 0 || this.fireCooldownRemainingSeconds > 1e-6) {
      return false;
    }
    this.ammoCount -= 1;
    this.fireCooldownRemainingSeconds = this.fireCooldownSeconds;
    zombie.applyDamage(this.damagePerShot);
    return true;
  }

  get ammo(): number {
    return this.ammoCount;
  }

  onPickup(): InventorySlotStack[] | null {
    if (this.ammoCount <= 0) {
      return null;
    }
    return [{ itemId: "ammo_rounds", count: this.ammoCount }];
  }
}
