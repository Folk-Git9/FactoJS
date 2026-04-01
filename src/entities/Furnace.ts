import type { Direction } from "../core/types";
import type { ItemId } from "../data/items";
import { Item } from "./Item";
import type { InputMachine, ProducerMachine } from "./Machine";

const DEFAULT_SMELT_SECONDS = 1.6;
const DEFAULT_SMELTS_PER_COAL = 4;
const DEFAULT_MAX_ORE = 24;
const DEFAULT_MAX_FUEL = 24;
const DEFAULT_MAX_OUTPUT = 48;

const ORE_TO_OUTPUT: Partial<Record<ItemId, ItemId>> = {
  iron_ore: "iron_plate",
};

export class Furnace implements ProducerMachine, InputMachine {
  readonly kind = "machine";
  readonly machineType = "furnace";
  outputDirection: Direction;

  private readonly smeltSeconds: number;
  private readonly smeltsPerCoal: number;
  private readonly maxOre: number;
  private readonly maxFuel: number;
  private readonly maxOutput: number;

  private oreInputCount = 0;
  private fuelCount = 0;
  private outputCount = 0;
  private burnCharges = 0;
  private timerSeconds = 0;

  constructor(
    outputDirection: Direction,
    smeltSeconds = DEFAULT_SMELT_SECONDS,
    smeltsPerCoal = DEFAULT_SMELTS_PER_COAL,
    maxOre = DEFAULT_MAX_ORE,
    maxFuel = DEFAULT_MAX_FUEL,
    maxOutput = DEFAULT_MAX_OUTPUT
  ) {
    this.outputDirection = outputDirection;
    this.smeltSeconds = Math.max(smeltSeconds, 0.05);
    this.smeltsPerCoal = Math.max(1, smeltsPerCoal);
    this.maxOre = Math.max(1, maxOre);
    this.maxFuel = Math.max(1, maxFuel);
    this.maxOutput = Math.max(1, maxOutput);
  }

  canAcceptInput(itemType: ItemId, _inputDirection: Direction): boolean {
    if (itemType === "coal_ore") {
      return this.fuelCount < this.maxFuel;
    }

    const smeltedOutput = ORE_TO_OUTPUT[itemType];
    if (!smeltedOutput) {
      return false;
    }

    return this.oreInputCount < this.maxOre;
  }

  acceptInput(item: Item, inputDirection: Direction): boolean {
    if (!this.canAcceptInput(item.type, inputDirection)) {
      return false;
    }

    if (item.type === "coal_ore") {
      this.fuelCount += 1;
      return true;
    }

    this.oreInputCount += 1;
    return true;
  }

  advance(deltaSeconds: number): void {
    if (this.outputCount >= this.maxOutput || this.oreInputCount <= 0) {
      return;
    }

    this.ensureFuel();
    if (this.burnCharges <= 0) {
      return;
    }

    this.timerSeconds += deltaSeconds;
    while (
      this.timerSeconds >= this.smeltSeconds &&
      this.oreInputCount > 0 &&
      this.burnCharges > 0 &&
      this.outputCount < this.maxOutput
    ) {
      this.timerSeconds -= this.smeltSeconds;
      this.oreInputCount -= 1;
      this.burnCharges -= 1;
      this.outputCount += 1;
      this.ensureFuel();
    }
  }

  hasOutputItem(): boolean {
    return this.outputCount > 0;
  }

  takeOutputItem(): Item | null {
    if (this.outputCount <= 0) {
      return null;
    }
    this.outputCount -= 1;
    return new Item("iron_plate");
  }

  get debugState(): {
    ore: number;
    fuel: number;
    burnCharges: number;
    output: number;
    progress01: number;
  } {
    const progress01 = this.smeltSeconds > 0 ? Math.min(this.timerSeconds / this.smeltSeconds, 1) : 0;
    return {
      ore: this.oreInputCount,
      fuel: this.fuelCount,
      burnCharges: this.burnCharges,
      output: this.outputCount,
      progress01,
    };
  }

  private ensureFuel(): void {
    if (this.burnCharges > 0 || this.fuelCount <= 0) {
      return;
    }

    this.fuelCount -= 1;
    this.burnCharges = this.smeltsPerCoal;
  }
}
