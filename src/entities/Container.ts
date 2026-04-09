import type { Direction } from "../core/types";
import type { ItemId } from "../data/items";
import type { InputMachine, Machine } from "./Machine";
import type { Item } from "./Item";
import type { InventorySlotStack } from "./PlayerInventory";
import { Item as ItemEntity } from "./Item";

const DEFAULT_SLOT_COUNT = 24;
const DEFAULT_MAX_STACK_PER_SLOT = 100;
export type ContainerMachineType = "container" | "iron_chest";

export interface ContainerUiState {
  slots: Array<InventorySlotStack | null>;
  slotCount: number;
  maxStackPerSlot: number;
  totalCount: number;
  totalCapacity: number;
}

export class Container implements Machine, InputMachine {
  readonly kind = "machine";
  readonly machineType: ContainerMachineType;

  private readonly maxStackPerSlot: number;
  private slots: Array<InventorySlotStack | null>;

  constructor(
    slotCount = DEFAULT_SLOT_COUNT,
    maxStackPerSlot = DEFAULT_MAX_STACK_PER_SLOT,
    machineType: ContainerMachineType = "container"
  ) {
    const normalizedSlotCount = Math.max(1, Math.floor(slotCount));
    this.maxStackPerSlot = Math.max(1, Math.floor(maxStackPerSlot));
    this.slots = Array.from({ length: normalizedSlotCount }, () => null);
    this.machineType = machineType;
  }

  canAcceptInput(itemType: ItemId, _inputDirection: Direction): boolean {
    return this.canInsert(itemType, 1);
  }

  acceptInput(item: Item, _inputDirection: Direction): boolean {
    return this.insert(item.type, 1) === 1;
  }

  canInsert(itemId: ItemId, amount = 1): boolean {
    const requested = Math.max(0, Math.floor(amount));
    if (requested <= 0) {
      return true;
    }
    const simulatedSlots = this.cloneSlots(this.slots);
    const inserted = this.addToSlots(simulatedSlots, itemId, requested);
    return inserted >= requested;
  }

  insert(itemId: ItemId, amount = 1): number {
    const requested = Math.max(0, Math.floor(amount));
    if (requested <= 0) {
      return 0;
    }
    return this.addToSlots(this.slots, itemId, requested);
  }

  getSlot(index: number): InventorySlotStack | null {
    if (index < 0 || index >= this.slots.length) {
      return null;
    }
    return this.cloneSlot(this.slots[index]);
  }

  getSlots(): Array<InventorySlotStack | null> {
    return this.slots.map((slot) => this.cloneSlot(slot));
  }

  takeFromSlot(index: number, amount?: number): InventorySlotStack | null {
    if (index < 0 || index >= this.slots.length) {
      return null;
    }

    const slot = this.slots[index];
    if (!slot) {
      return null;
    }

    const requested = amount === undefined ? slot.count : Math.max(1, Math.floor(amount));
    const takenCount = Math.min(slot.count, requested);
    if (takenCount <= 0) {
      return null;
    }

    slot.count -= takenCount;
    if (slot.count <= 0) {
      this.slots[index] = null;
    }

    return {
      itemId: slot.itemId,
      count: takenCount,
    };
  }

  takeSingleMatching(allowedItems: ReadonlySet<ItemId> | null = null): ItemEntity | null {
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (!slot || slot.count <= 0) {
        continue;
      }
      if (allowedItems && allowedItems.size > 0 && !allowedItems.has(slot.itemId)) {
        continue;
      }

      slot.count -= 1;
      const itemId = slot.itemId;
      if (slot.count <= 0) {
        this.slots[i] = null;
      }
      return new ItemEntity(itemId);
    }
    return null;
  }

  getCount(itemId: ItemId): number {
    let count = 0;
    for (const slot of this.slots) {
      if (slot?.itemId === itemId) {
        count += slot.count;
      }
    }
    return count;
  }

  getTotalCount(): number {
    let total = 0;
    for (const slot of this.slots) {
      total += slot?.count ?? 0;
    }
    return total;
  }

  canCraft(input: Partial<Record<ItemId, number>>, outputItem: ItemId, outputCount: number): boolean {
    return this.simulateCraft(input, outputItem, outputCount) !== null;
  }

  tryCraft(input: Partial<Record<ItemId, number>>, outputItem: ItemId, outputCount: number): boolean {
    const simulated = this.simulateCraft(input, outputItem, outputCount);
    if (!simulated) {
      return false;
    }
    this.slots = simulated;
    return true;
  }

  clearAndTakeAll(): InventorySlotStack[] {
    const extracted: InventorySlotStack[] = [];
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (!slot) {
        continue;
      }
      extracted.push(this.cloneSlot(slot) as InventorySlotStack);
      this.slots[i] = null;
    }
    return extracted;
  }

  get debugState(): ContainerUiState {
    return {
      slots: this.getSlots(),
      slotCount: this.slots.length,
      maxStackPerSlot: this.maxStackPerSlot,
      totalCount: this.getTotalCount(),
      totalCapacity: this.slots.length * this.maxStackPerSlot,
    };
  }

  private simulateCraft(
    input: Partial<Record<ItemId, number>>,
    outputItem: ItemId,
    outputCount: number
  ): Array<InventorySlotStack | null> | null {
    const normalizedOutputCount = Math.max(0, Math.floor(outputCount));
    if (normalizedOutputCount <= 0) {
      return null;
    }

    const simulatedSlots = this.cloneSlots(this.slots);

    for (const [itemId, required] of Object.entries(input) as Array<[ItemId, number | undefined]>) {
      const requiredCount = Math.max(0, Math.floor(required ?? 0));
      if (requiredCount <= 0) {
        continue;
      }

      if (this.getCountInSlots(simulatedSlots, itemId) < requiredCount) {
        return null;
      }

      const removed = this.removeFromSlots(simulatedSlots, itemId, requiredCount);
      if (removed < requiredCount) {
        return null;
      }
    }

    const inserted = this.addToSlots(simulatedSlots, outputItem, normalizedOutputCount);
    if (inserted < normalizedOutputCount) {
      return null;
    }

    return simulatedSlots;
  }

  private addToSlots(
    slots: Array<InventorySlotStack | null>,
    itemId: ItemId,
    amount: number
  ): number {
    let remaining = Math.max(0, Math.floor(amount));
    if (remaining <= 0) {
      return 0;
    }

    for (const slot of slots) {
      if (!slot || slot.itemId !== itemId || slot.count >= this.maxStackPerSlot) {
        continue;
      }
      const freeSpace = this.maxStackPerSlot - slot.count;
      const moved = Math.min(freeSpace, remaining);
      slot.count += moved;
      remaining -= moved;
      if (remaining <= 0) {
        return amount;
      }
    }

    for (let i = 0; i < slots.length && remaining > 0; i += 1) {
      if (slots[i]) {
        continue;
      }
      const moved = Math.min(this.maxStackPerSlot, remaining);
      slots[i] = {
        itemId,
        count: moved,
      };
      remaining -= moved;
    }

    return amount - remaining;
  }

  private removeFromSlots(
    slots: Array<InventorySlotStack | null>,
    itemId: ItemId,
    amount: number
  ): number {
    let remaining = Math.max(0, Math.floor(amount));
    if (remaining <= 0) {
      return 0;
    }

    for (let i = 0; i < slots.length && remaining > 0; i += 1) {
      const slot = slots[i];
      if (!slot || slot.itemId !== itemId) {
        continue;
      }

      const removed = Math.min(slot.count, remaining);
      slot.count -= removed;
      remaining -= removed;

      if (slot.count <= 0) {
        slots[i] = null;
      }
    }

    return amount - remaining;
  }

  private getCountInSlots(slots: Array<InventorySlotStack | null>, itemId: ItemId): number {
    let count = 0;
    for (const slot of slots) {
      if (slot?.itemId === itemId) {
        count += slot.count;
      }
    }
    return count;
  }

  private cloneSlots(slots: Array<InventorySlotStack | null>): Array<InventorySlotStack | null> {
    return slots.map((slot) => this.cloneSlot(slot));
  }

  private cloneSlot(slot: InventorySlotStack | null): InventorySlotStack | null {
    if (!slot) {
      return null;
    }
    return {
      itemId: slot.itemId,
      count: slot.count,
    };
  }
}
