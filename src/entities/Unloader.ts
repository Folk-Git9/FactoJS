import type { Direction } from "../core/types";
import type { ItemId } from "../data/items";
import type { Container } from "./Container";
import type { ProducerMachine } from "./Machine";
import { Item } from "./Item";
import type { InventorySlotStack } from "./PlayerInventory";
import type { ItemHandler } from "./ItemHandler";

const DEFAULT_CYCLE_SECONDS = 0.35;
const DEFAULT_FILTER_SLOT_COUNT = 4;
const DEFAULT_MAX_BUFFERED_OUTPUT = 2;

export interface UnloaderUiState {
  sourceConnected: boolean;
  filters: Array<ItemId | null>;
  outputBufferCount: number;
  outputBufferCapacity: number;
  cycleSeconds: number;
}

export class Unloader implements ProducerMachine, ItemHandler {
  readonly kind = "machine";
  readonly machineType = "unloader";
  outputDirection: Direction;

  private readonly getSourceContainer: () => Container | null;
  private readonly cycleSeconds: number;
  private readonly maxBufferedOutput: number;
  private readonly filters: Array<ItemId | null>;
  private readonly outputBuffer: ItemId[] = [];

  private timerSeconds = 0;

  constructor(
    outputDirection: Direction,
    getSourceContainer: () => Container | null,
    cycleSeconds = DEFAULT_CYCLE_SECONDS,
    filterSlotCount = DEFAULT_FILTER_SLOT_COUNT,
    maxBufferedOutput = DEFAULT_MAX_BUFFERED_OUTPUT
  ) {
    this.outputDirection = outputDirection;
    this.getSourceContainer = getSourceContainer;
    this.cycleSeconds = Math.max(0.05, cycleSeconds);
    this.maxBufferedOutput = Math.max(1, Math.floor(maxBufferedOutput));
    this.filters = Array.from({ length: Math.max(1, Math.floor(filterSlotCount)) }, () => null);
  }

  advance(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || this.outputBuffer.length >= this.maxBufferedOutput) {
      return;
    }

    const sourceContainer = this.getSourceContainer();
    if (!sourceContainer) {
      this.timerSeconds = 0;
      return;
    }

    this.timerSeconds += deltaSeconds;
    const allowedItems = this.getAllowedItemsSet();
    while (this.timerSeconds >= this.cycleSeconds && this.outputBuffer.length < this.maxBufferedOutput) {
      this.timerSeconds -= this.cycleSeconds;
      const extracted = sourceContainer.takeSingleMatching(allowedItems);
      if (!extracted) {
        break;
      }
      this.outputBuffer.push(extracted.type);
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

  onPickup(): InventorySlotStack[] | null {
    if (this.outputBuffer.length <= 0) {
      return null;
    }

    const counts = new Map<ItemId, number>();
    for (const itemId of this.outputBuffer) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    this.outputBuffer.length = 0;

    return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
  }

  getFilter(slotIndex: number): ItemId | null {
    if (slotIndex < 0 || slotIndex >= this.filters.length) {
      return null;
    }
    return this.filters[slotIndex] ?? null;
  }

  getFilters(): Array<ItemId | null> {
    return [...this.filters];
  }

  setFilter(slotIndex: number, itemId: ItemId | null): boolean {
    if (slotIndex < 0 || slotIndex >= this.filters.length) {
      return false;
    }
    this.filters[slotIndex] = itemId;
    return true;
  }

  clearFilters(): void {
    for (let i = 0; i < this.filters.length; i += 1) {
      this.filters[i] = null;
    }
  }

  get debugState(): UnloaderUiState {
    return {
      sourceConnected: this.getSourceContainer() !== null,
      filters: this.getFilters(),
      outputBufferCount: this.outputBuffer.length,
      outputBufferCapacity: this.maxBufferedOutput,
      cycleSeconds: this.cycleSeconds,
    };
  }

  private getAllowedItemsSet(): ReadonlySet<ItemId> | null {
    const allowed = new Set<ItemId>();
    for (const filter of this.filters) {
      if (filter) {
        allowed.add(filter);
      }
    }
    if (allowed.size <= 0) {
      return null;
    }
    return allowed;
  }
}

