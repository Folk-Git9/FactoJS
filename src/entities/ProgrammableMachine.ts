import type { Direction } from "../core/types";
import { ITEM_DEFINITIONS, type ItemId } from "../data/items";
import { compileProgrammableMachineProgram, formatProgrammableMachineRuntimeError, type CompiledProgrammableMachineProgram } from "../scripting/ProgrammableMachineRuntime";
import { Container } from "./Container";
import { Item } from "./Item";
import type { ItemHandler } from "./ItemHandler";
import type { InputMachine, ProducerMachine } from "./Machine";
import type { InventorySlotStack } from "./PlayerInventory";

const DEFAULT_INPUT_SLOT_COUNT = 12;
const DEFAULT_MAX_INPUT_STACK = 50;
const DEFAULT_OUTPUT_CAPACITY = 24;
const DEFAULT_OUTPUT_VIEW_SLOTS = 8;
const DEFAULT_PROGRAM_SOURCE = `if (api.every(0.2, "main")) {
  if (api.convert({ iron_ore: 1, coal_ore: 1 }, { iron_plate: 1 })) {
    api.setStatus("Smelting iron");
  } else if (api.send("stone", 1) > 0) {
    api.setStatus("Passing stone through");
  } else {
    api.setStatus("Waiting for inputs");
  }
}`;

export interface ProgrammableMachineUiState {
  outputDirection: Direction;
  inputSlots: Array<InventorySlotStack | null>;
  inputTotalCount: number;
  inputCapacity: number;
  outputSlots: Array<InventorySlotStack | null>;
  outputCount: number;
  outputCapacity: number;
  programSource: string;
  programVersion: number;
  activeProgramVersion: number | null;
  compileError: string | null;
  runtimeError: string | null;
  statusText: string;
}

interface WorldStats {
  tick: number;
  time: number;
}

interface ProgrammableMachineApi {
  getTick(): number;
  getTime(): number;
  getDelta(): number;
  count(itemId: ItemId): number;
  has(itemId: ItemId, amount?: number): boolean;
  items(): Partial<Record<ItemId, number>>;
  queued(): Partial<Record<ItemId, number>>;
  queueSpace(): number;
  send(itemId: ItemId, amount?: number): number;
  convert(
    input: Partial<Record<string, number>>,
    output: Partial<Record<string, number>>
  ): boolean;
  setOutput(direction: Direction): Direction;
  getOutput(): Direction;
  every(intervalSeconds: number, key?: string): boolean;
  setStatus(text: string): void;
}

const isKnownItemId = (value: string): value is ItemId => {
  return Object.prototype.hasOwnProperty.call(ITEM_DEFINITIONS, value);
};

const isDirection = (value: string): value is Direction => {
  return value === "up" || value === "right" || value === "down" || value === "left";
};

const toItemRecordEntries = (
  record: Partial<Record<string, number>>
): Array<[ItemId, number]> => {
  const entries: Array<[ItemId, number]> = [];
  for (const [itemId, amount] of Object.entries(record)) {
    if (!isKnownItemId(itemId)) {
      continue;
    }
    const normalizedAmount = Math.max(0, Math.floor(amount ?? 0));
    if (normalizedAmount <= 0) {
      continue;
    }
    entries.push([itemId, normalizedAmount]);
  }
  return entries;
};

const aggregateStacks = (stacks: Array<InventorySlotStack | null>): Partial<Record<ItemId, number>> => {
  const counts = Object.create(null) as Partial<Record<ItemId, number>>;
  for (const stack of stacks) {
    if (!stack) {
      continue;
    }
    counts[stack.itemId] = (counts[stack.itemId] ?? 0) + stack.count;
  }
  return counts;
};

export class ProgrammableMachine implements ProducerMachine, InputMachine, ItemHandler {
  readonly kind = "machine";
  readonly machineType = "programmable_machine";
  outputDirection: Direction;

  private readonly getWorldStats: () => WorldStats;
  private readonly inputBuffer: Container;
  private readonly outputCapacity: number;
  private readonly outputViewSlots: number;
  private readonly outputBuffer: ItemId[] = [];
  private readonly intervalTimers = new Map<string, number>();
  private readonly state: Record<string, unknown> = {};

  private programSource = DEFAULT_PROGRAM_SOURCE;
  private programVersion = 0;
  private activeProgramVersion: number | null = null;
  private compileError: string | null = null;
  private runtimeError: string | null = null;
  private statusText = "Idle";
  private activeProgram: CompiledProgrammableMachineProgram | null = null;

  constructor(
    outputDirection: Direction,
    getWorldStats: () => WorldStats,
    initialProgramSource = DEFAULT_PROGRAM_SOURCE,
    inputSlotCount = DEFAULT_INPUT_SLOT_COUNT,
    maxInputStack = DEFAULT_MAX_INPUT_STACK,
    outputCapacity = DEFAULT_OUTPUT_CAPACITY,
    outputViewSlots = DEFAULT_OUTPUT_VIEW_SLOTS
  ) {
    this.outputDirection = outputDirection;
    this.getWorldStats = getWorldStats;
    this.inputBuffer = new Container(inputSlotCount, maxInputStack);
    this.outputCapacity = Math.max(1, Math.floor(outputCapacity));
    this.outputViewSlots = Math.max(1, Math.floor(outputViewSlots));
    this.applyProgramSource(initialProgramSource);
  }

  canAcceptInput(itemType: ItemId, inputDirection: Direction): boolean {
    if (inputDirection === this.outputDirection) {
      return false;
    }
    return this.inputBuffer.canInsert(itemType, 1);
  }

  acceptInput(item: Item, inputDirection: Direction): boolean {
    if (!this.canAcceptInput(item.type, inputDirection)) {
      return false;
    }
    return this.inputBuffer.insert(item.type, 1) === 1;
  }

  advance(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || !this.activeProgram || this.runtimeError) {
      return;
    }

    const api = this.createApi(deltaSeconds);
    try {
      this.activeProgram.execute(api, this.state);
    } catch (error) {
      this.runtimeError = formatProgrammableMachineRuntimeError(error);
      this.statusText = "Runtime halted";
    }
  }

  hasOutputItem(): boolean {
    return this.outputBuffer.length > 0;
  }

  takeOutputItem(): Item | null {
    const next = this.outputBuffer.shift();
    if (!next) {
      return null;
    }
    return new Item(next);
  }

  takeInputSlot(index: number, amount?: number): InventorySlotStack | null {
    return this.inputBuffer.takeFromSlot(index, amount);
  }

  takeOutputSlot(index: number, amount?: number): InventorySlotStack | null {
    const slots = this.getOutputSlots();
    const slot = index >= 0 && index < slots.length ? slots[index] : null;
    if (!slot) {
      return null;
    }

    const requested = amount === undefined ? slot.count : Math.max(1, Math.floor(amount));
    const removed = this.removeOutputItems(slot.itemId, requested);
    if (removed <= 0) {
      return null;
    }

    return {
      itemId: slot.itemId,
      count: removed,
    };
  }

  applyProgramSource(source: string): { ok: boolean; error: string | null } {
    const normalizedSource = source.replace(/\r\n/g, "\n");
    const compileResult = compileProgrammableMachineProgram(normalizedSource);
    this.programSource = normalizedSource;
    this.programVersion += 1;
    this.compileError = compileResult.error;

    if (!compileResult.ok || !compileResult.program) {
      this.statusText = this.activeProgram ? "Compile failed, previous build still running" : "Compile failed";
      return {
        ok: false,
        error: this.compileError,
      };
    }

    this.activeProgram = compileResult.program;
    this.activeProgramVersion = this.programVersion;
    this.compileError = null;
    this.runtimeError = null;
    this.statusText = "Program applied";
    this.intervalTimers.clear();
    for (const key of Object.keys(this.state)) {
      delete this.state[key];
    }

    return {
      ok: true,
      error: null,
    };
  }

  onPickup(): InventorySlotStack[] | null {
    const carried: InventorySlotStack[] = [];
    const inputStacks = this.inputBuffer.clearAndTakeAll();
    for (const stack of inputStacks) {
      carried.push(stack);
    }

    const queuedCounts = this.getOutputCounts();
    for (const [itemId, count] of Object.entries(queuedCounts) as Array<[ItemId, number | undefined]>) {
      if (!count || count <= 0) {
        continue;
      }
      carried.push({ itemId, count });
    }
    this.outputBuffer.length = 0;

    return carried.length > 0 ? carried : null;
  }

  get debugState(): ProgrammableMachineUiState {
    return {
      outputDirection: this.outputDirection,
      inputSlots: this.inputBuffer.getSlots(),
      inputTotalCount: this.inputBuffer.getTotalCount(),
      inputCapacity: this.inputBuffer.debugState.totalCapacity,
      outputSlots: this.getPaddedOutputSlots(),
      outputCount: this.outputBuffer.length,
      outputCapacity: this.outputCapacity,
      programSource: this.programSource,
      programVersion: this.programVersion,
      activeProgramVersion: this.activeProgramVersion,
      compileError: this.compileError,
      runtimeError: this.runtimeError,
      statusText: this.statusText,
    };
  }

  static get defaultProgramSource(): string {
    return DEFAULT_PROGRAM_SOURCE;
  }

  private createApi(deltaSeconds: number): ProgrammableMachineApi {
    return {
      getTick: () => this.getWorldStats().tick,
      getTime: () => this.getWorldStats().time,
      getDelta: () => deltaSeconds,
      count: (itemId) => this.inputBuffer.getCount(itemId),
      has: (itemId, amount = 1) => this.inputBuffer.getCount(itemId) >= Math.max(1, Math.floor(amount)),
      items: () => aggregateStacks(this.inputBuffer.getSlots()),
      queued: () => this.getOutputCounts(),
      queueSpace: () => Math.max(0, this.outputCapacity - this.outputBuffer.length),
      send: (itemId, amount = 1) => this.sendFromInput(itemId, amount),
      convert: (input, output) => this.convertItems(input, output),
      setOutput: (direction) => {
        if (isDirection(direction)) {
          this.outputDirection = direction;
        }
        return this.outputDirection;
      },
      getOutput: () => this.outputDirection,
      every: (intervalSeconds, key = "default") => this.consumeInterval(intervalSeconds, key, deltaSeconds),
      setStatus: (text) => {
        this.statusText = text.slice(0, 120);
      },
    };
  }

  private sendFromInput(itemId: ItemId, amount: number): number {
    const requested = Math.max(1, Math.floor(amount));
    const movable = Math.min(
      requested,
      this.inputBuffer.getCount(itemId),
      Math.max(0, this.outputCapacity - this.outputBuffer.length)
    );
    if (movable <= 0) {
      return 0;
    }

    const removed = this.inputBuffer.takeItem(itemId, movable);
    for (let i = 0; i < removed; i += 1) {
      this.outputBuffer.push(itemId);
    }
    return removed;
  }

  private convertItems(
    inputRecord: Partial<Record<string, number>>,
    outputRecord: Partial<Record<string, number>>
  ): boolean {
    const inputEntries = toItemRecordEntries(inputRecord);
    const outputEntries = toItemRecordEntries(outputRecord);
    if (inputEntries.length <= 0 || outputEntries.length <= 0) {
      return false;
    }

    for (const [itemId, count] of inputEntries) {
      if (this.inputBuffer.getCount(itemId) < count) {
        return false;
      }
    }

    const totalOutputCount = outputEntries.reduce((sum, [, count]) => sum + count, 0);
    if (this.outputBuffer.length + totalOutputCount > this.outputCapacity) {
      return false;
    }

    for (const [itemId, count] of inputEntries) {
      const removed = this.inputBuffer.takeItem(itemId, count);
      if (removed < count) {
        this.inputBuffer.insert(itemId, removed);
        return false;
      }
    }

    for (const [itemId, count] of outputEntries) {
      for (let i = 0; i < count; i += 1) {
        this.outputBuffer.push(itemId);
      }
    }

    return true;
  }

  private consumeInterval(intervalSeconds: number, key: string, deltaSeconds: number): boolean {
    const normalizedInterval = Math.max(0.01, intervalSeconds);
    const timerKey = key.slice(0, 48) || "default";
    const nextValue = (this.intervalTimers.get(timerKey) ?? 0) + deltaSeconds;
    if (nextValue + 1e-6 < normalizedInterval) {
      this.intervalTimers.set(timerKey, nextValue);
      return false;
    }

    this.intervalTimers.set(timerKey, nextValue % normalizedInterval);
    return true;
  }

  private getOutputCounts(): Partial<Record<ItemId, number>> {
    const counts = Object.create(null) as Partial<Record<ItemId, number>>;
    for (const itemId of this.outputBuffer) {
      counts[itemId] = (counts[itemId] ?? 0) + 1;
    }
    return counts;
  }

  private getOutputSlots(): Array<InventorySlotStack | null> {
    const counts = this.getOutputCounts();
    return Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([itemId, count]) => ({
        itemId: itemId as ItemId,
        count: count ?? 0,
      }));
  }

  private getPaddedOutputSlots(): Array<InventorySlotStack | null> {
    const slots = this.getOutputSlots();
    while (slots.length < this.outputViewSlots) {
      slots.push(null);
    }
    return slots;
  }

  private removeOutputItems(itemId: ItemId, amount: number): number {
    let remaining = Math.max(1, Math.floor(amount));
    const kept: ItemId[] = [];
    for (const queuedItem of this.outputBuffer) {
      if (queuedItem === itemId && remaining > 0) {
        remaining -= 1;
        continue;
      }
      kept.push(queuedItem);
    }

    const removed = Math.max(0, amount - remaining);
    if (removed > 0) {
      this.outputBuffer.length = 0;
      this.outputBuffer.push(...kept);
    }
    return removed;
  }
}
