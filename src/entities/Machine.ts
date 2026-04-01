import type { Direction } from "../core/types";
import type { ItemId } from "../data/items";
import { Item } from "./Item";

export interface Machine {
  readonly kind: "machine";
  readonly machineType: string;
}

export interface DirectionalMachine extends Machine {
  outputDirection: Direction;
}

export interface ProducerMachine extends DirectionalMachine {
  advance(deltaSeconds: number): void;
  hasOutputItem(): boolean;
  takeOutputItem(): Item | null;
}

export interface InputMachine extends Machine {
  canAcceptInput(itemType: ItemId, inputDirection: Direction): boolean;
  acceptInput(item: Item, inputDirection: Direction): boolean;
}

export const isMachine = (value: unknown): value is Machine => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Machine>;
  return candidate.kind === "machine" && typeof candidate.machineType === "string";
};

export const isDirectionalMachine = (value: unknown): value is DirectionalMachine => {
  if (!isMachine(value)) {
    return false;
  }
  const candidate = value as Partial<DirectionalMachine>;
  return (
    candidate.outputDirection === "up" ||
    candidate.outputDirection === "right" ||
    candidate.outputDirection === "down" ||
    candidate.outputDirection === "left"
  );
};

export const isProducerMachine = (value: unknown): value is ProducerMachine => {
  if (!isDirectionalMachine(value)) {
    return false;
  }
  const candidate = value as Partial<ProducerMachine>;
  return (
    typeof candidate.advance === "function" &&
    typeof candidate.hasOutputItem === "function" &&
    typeof candidate.takeOutputItem === "function"
  );
};

export const isInputMachine = (value: unknown): value is InputMachine => {
  if (!isMachine(value)) {
    return false;
  }
  const candidate = value as Partial<InputMachine>;
  return (
    typeof candidate.canAcceptInput === "function" &&
    typeof candidate.acceptInput === "function"
  );
};

export class TestProducer implements ProducerMachine {
  readonly kind = "machine";
  readonly machineType = "test_producer";
  readonly outputItem: ItemId;
  outputDirection: Direction;
  cycleSeconds: number;
  private timerSeconds: number;
  private pendingOutputCount = 0;

  constructor(outputItem: ItemId, outputDirection: Direction, cycleSeconds = 1.2) {
    this.outputItem = outputItem;
    this.outputDirection = outputDirection;
    this.cycleSeconds = cycleSeconds;
    this.timerSeconds = 0;
  }

  advance(deltaSeconds: number): void {
    this.timerSeconds += deltaSeconds;
    const produced = Math.floor(this.timerSeconds / this.cycleSeconds);
    if (produced > 0) {
      this.timerSeconds -= produced * this.cycleSeconds;
      this.pendingOutputCount += produced;
    }
  }

  hasOutputItem(): boolean {
    return this.pendingOutputCount > 0;
  }

  takeOutputItem(): Item | null {
    if (this.pendingOutputCount <= 0) {
      return null;
    }
    this.pendingOutputCount -= 1;
    return new Item(this.outputItem);
  }

  get progress01(): number {
    return this.timerSeconds / this.cycleSeconds;
  }
}
