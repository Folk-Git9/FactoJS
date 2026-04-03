import type { Direction } from "../core/types";
import type { ItemId, ResourceItemId } from "../data/items";
import { Item } from "./Item";
import type { InputMachine, ProducerMachine } from "./Machine";

const DEFAULT_MINE_SECONDS = 1.1;
const DEFAULT_MINES_PER_COAL = 5;
const DEFAULT_MAX_FUEL = 24;
const DEFAULT_MAX_OUTPUT = 24;

type MineResourceFn = () => ResourceItemId | null;

export class Drill implements ProducerMachine, InputMachine {
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

  constructor(
    outputDirection: Direction,
    mineResource: MineResourceFn,
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

  private ensureFuel(): void {
    if (this.burnCharges > 0 || this.fuelCount <= 0) {
      return;
    }
    this.fuelCount -= 1;
    this.burnCharges = this.minesPerCoal;
  }
}
