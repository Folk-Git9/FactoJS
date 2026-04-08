import type { Direction } from "../core/types";
import type { ItemId, ResourceItemId } from "../data/items";
import { Item } from "./Item";
import { ItemHandler } from "./ItemHandler";
import type { InputMachine, ProducerMachine } from "./Machine";
import { InventorySlotStack } from "./PlayerInventory";

const DEFAULT_MINE_SECONDS = 1.1;
const DEFAULT_MINES_PER_COAL = 5;
const DEFAULT_MAX_FUEL = 24;
const DEFAULT_MAX_OUTPUT = 24;

type MineResourceFn = () => ResourceItemId | null;

export interface DrillUiState {
  resourceType: ResourceItemId | null;
  fuelCount: number;
  fuelCapacity: number;
  outputCount: number;
  outputCapacity: number;
  progress01: number;
}

export class Drill implements ProducerMachine, InputMachine, ItemHandler {
  readonly kind = "machine";
  readonly machineType = "drill";
  outputDirection: Direction;

  private readonly mineSeconds: number;
  private readonly minesPerCoal: number;
  private readonly maxFuel: number;
  private readonly maxOutput: number;
  private readonly mineResource: MineResourceFn;

  private fuelCount = 0;
  private burnCharges = 0;
  private timerSeconds = 0;
  private readonly outputItems: ItemId[] = [];
  private resourceType: ResourceItemId | null;

  constructor(
    outputDirection: Direction,
    mineResource: MineResourceFn,
    initialResourceType: ResourceItemId | null = null,
    mineSeconds = DEFAULT_MINE_SECONDS,
    minesPerCoal = DEFAULT_MINES_PER_COAL,
    maxFuel = DEFAULT_MAX_FUEL,
    maxOutput = DEFAULT_MAX_OUTPUT
  ) {
    this.outputDirection = outputDirection;
    this.mineResource = mineResource;
    this.mineSeconds = Math.max(0.05, mineSeconds);
    this.minesPerCoal = Math.max(1, minesPerCoal);
    this.maxFuel = Math.max(1, maxFuel);
    this.maxOutput = Math.max(1, maxOutput);
    this.resourceType = initialResourceType;
  }

  onPickup(): InventorySlotStack[] | null {
    if (this.fuelCount <= 0 && this.outputItems.length <= 0)
        return null;

    const result: InventorySlotStack[] = [];

    if (this.fuelCount > 0) {
      result.push({itemId: "coal_ore", count: this.fuelCount});
    }
    if (this.outputItems.length > 0) {
      const map: Map<string, number> = new Map();

      for (const stack of this.outputItems) {
          let count = map.get(stack) ?? 0; // если нет, ставим 0
          map.set(stack, count + 1);       // увеличиваем на 1
      }
      
      map.forEach((count, stack) => {
          result.push({ itemId: stack as ItemId, count });
      });

      return result;
    }
    return null;
  }

  canAcceptInput(itemType: ItemId, _inputDirection: Direction): boolean {
    return itemType === "coal_ore" && this.fuelCount < this.maxFuel;
  }

  acceptInput(item: Item, inputDirection: Direction): boolean {
    if (!this.canAcceptInput(item.type, inputDirection)) {
      return false;
    }
    this.fuelCount += 1;
    return true;
  }

  advance(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || this.outputItems.length >= this.maxOutput) {
      return;
    }

    this.ensureFuel();
    if (this.burnCharges <= 0) {
      return;
    }

    this.timerSeconds += deltaSeconds;
    while (
      this.timerSeconds >= this.mineSeconds &&
      this.outputItems.length < this.maxOutput &&
      this.burnCharges > 0
    ) {
      const minedResource = this.mineResource();
      if (!minedResource) {
        this.timerSeconds = 0;
        return;
      }

      this.timerSeconds -= this.mineSeconds;
      this.burnCharges -= 1;
      this.resourceType = minedResource;
      this.outputItems.push(minedResource);
      this.ensureFuel();
    }
  }

  hasOutputItem(): boolean {
    return this.outputItems.length > 0;
  }

  takeOutputItem(): Item | null {
    const next = this.outputItems.shift();
    if (!next) {
      return null;
    }
    return new Item(next);
  }

  takeFuelItem(): Item | null {
    if (this.fuelCount <= 0) {
      return null;
    }
    this.fuelCount -= 1;
    return new Item("coal_ore");
  }

  get debugState(): DrillUiState & { burnCharges: number } {
    const progress01 = this.mineSeconds > 0 ? Math.min(this.timerSeconds / this.mineSeconds, 1) : 0;
    return {
      resourceType: this.resourceType,
      fuelCount: this.fuelCount,
      fuelCapacity: this.maxFuel,
      burnCharges: this.burnCharges,
      outputCount: this.outputItems.length,
      outputCapacity: this.maxOutput,
      progress01,
    };
  }

  private ensureFuel(): void {
    if (this.burnCharges > 0 || this.fuelCount <= 0) {
      return;
    }
    this.fuelCount -= 1;
    this.burnCharges = this.minesPerCoal;
  }
}
