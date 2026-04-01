import type { ItemId } from "../data/items";
import type { Item } from "./Item";

export interface InventorySlotStack {
  itemId: ItemId;
  count: number;
}

export interface PlayerInventoryView {
  hotbar: Array<InventorySlotStack | null>;
  backpack: Array<InventorySlotStack | null>;
  totalCount: number;
}

export type InventorySection = "hotbar" | "backpack";

export const HOTBAR_SLOT_COUNT = 10;
export const BACKPACK_SLOT_COUNT = 24;

export class PlayerInventory {
  private readonly hotbarSlots: Array<InventorySlotStack | null>;
  private readonly backpackSlots: Array<InventorySlotStack | null>;

  constructor() {
    this.hotbarSlots = Array.from({ length: HOTBAR_SLOT_COUNT }, () => null);
    this.backpackSlots = Array.from({ length: BACKPACK_SLOT_COUNT }, () => null);
  }

  addItem(item: Item): void {
    this.add(item.type, 1);
  }

  add(itemId: ItemId, amount = 1): void {
    if (amount <= 0) {
      return;
    }

    let remaining = amount;
    remaining = this.addToSlots(this.hotbarSlots, itemId, remaining);
    this.addToSlots(this.backpackSlots, itemId, remaining);
  }

  remove(itemId: ItemId, amount = 1): boolean {
    if (amount <= 0) {
      return true;
    }

    if (this.getCount(itemId) < amount) {
      return false;
    }

    let remaining = amount;
    remaining = this.removeFromSlots(this.hotbarSlots, itemId, remaining);
    this.removeFromSlots(this.backpackSlots, itemId, remaining);
    return true;
  }

  getCount(itemId: ItemId): number {
    let count = 0;
    for (const slot of this.hotbarSlots) {
      if (slot?.itemId === itemId) {
        count += slot.count;
      }
    }
    for (const slot of this.backpackSlots) {
      if (slot?.itemId === itemId) {
        count += slot.count;
      }
    }
    return count;
  }

  getTotalCount(): number {
    let total = 0;
    for (const slot of this.hotbarSlots) {
      total += slot?.count ?? 0;
    }
    for (const slot of this.backpackSlots) {
      total += slot?.count ?? 0;
    }
    return total;
  }

  entries(): Array<[ItemId, number]> {
    const counts = new Map<ItemId, number>();
    this.aggregateEntries(this.hotbarSlots, counts);
    this.aggregateEntries(this.backpackSlots, counts);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  getHotbarSlots(): Array<InventorySlotStack | null> {
    return this.hotbarSlots.map((slot) => this.cloneSlot(slot));
  }

  getHotbarSlot(index: number): InventorySlotStack | null {
    if (index < 0 || index >= this.hotbarSlots.length) {
      return null;
    }
    return this.cloneSlot(this.hotbarSlots[index]);
  }

  getBackpackSlots(): Array<InventorySlotStack | null> {
    return this.backpackSlots.map((slot) => this.cloneSlot(slot));
  }

  getView(): PlayerInventoryView {
    return {
      hotbar: this.getHotbarSlots(),
      backpack: this.getBackpackSlots(),
      totalCount: this.getTotalCount(),
    };
  }

  moveHotbarToBackpack(index: number): boolean {
    return this.moveSectionToFirstAvailable("hotbar", index, "backpack");
  }

  moveBackpackToHotbar(index: number): boolean {
    return this.moveSectionToFirstAvailable("backpack", index, "hotbar");
  }

  moveStack(fromSection: InventorySection, fromIndex: number, toSection: InventorySection, toIndex: number): boolean {
    const fromSlots = this.getSectionSlots(fromSection);
    const toSlots = this.getSectionSlots(toSection);
    if (!fromSlots || !toSlots) {
      return false;
    }
    if (!this.isIndexInBounds(fromSlots, fromIndex) || !this.isIndexInBounds(toSlots, toIndex)) {
      return false;
    }
    if (fromSection === toSection && fromIndex === toIndex) {
      return false;
    }

    const source = fromSlots[fromIndex];
    if (!source) {
      return false;
    }

    const target = toSlots[toIndex];
    if (!target) {
      fromSlots[fromIndex] = null;
      toSlots[toIndex] = source;
      return true;
    }

    if (target.itemId === source.itemId) {
      target.count += source.count;
      fromSlots[fromIndex] = null;
      return true;
    }

    fromSlots[fromIndex] = target;
    toSlots[toIndex] = source;
    return true;
  }

  consumeHotbarItem(index: number, amount = 1): ItemId | null {
    if (amount <= 0 || index < 0 || index >= this.hotbarSlots.length) {
      return null;
    }

    const slot = this.hotbarSlots[index];
    if (!slot || slot.count < amount) {
      return null;
    }

    const itemId = slot.itemId;
    slot.count -= amount;
    if (slot.count === 0) {
      this.hotbarSlots[index] = null;
    }
    return itemId;
  }

  private addToSlots(slots: Array<InventorySlotStack | null>, itemId: ItemId, amount: number): number {
    if (amount <= 0) {
      return 0;
    }

    for (const slot of slots) {
      if (slot?.itemId === itemId) {
        slot.count += amount;
        return 0;
      }
    }

    const emptyIndex = slots.findIndex((slot) => slot === null);
    if (emptyIndex < 0) {
      return amount;
    }

    slots[emptyIndex] = { itemId, count: amount };
    return 0;
  }

  private removeFromSlots(slots: Array<InventorySlotStack | null>, itemId: ItemId, amount: number): number {
    let remaining = amount;

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot || slot.itemId !== itemId) {
        continue;
      }

      if (slot.count > remaining) {
        slot.count -= remaining;
        return 0;
      }

      remaining -= slot.count;
      slots[i] = null;
      if (remaining === 0) {
        return 0;
      }
    }

    return remaining;
  }

  private moveSectionToFirstAvailable(
    sourceSection: InventorySection,
    sourceIndex: number,
    targetSection: InventorySection
  ): boolean {
    const source = this.getSectionSlots(sourceSection);
    const target = this.getSectionSlots(targetSection);
    if (!source || !target || !this.isIndexInBounds(source, sourceIndex)) {
      return false;
    }
    const sourceSlot = source[sourceIndex];
    if (!sourceSlot) {
      return false;
    }

    const mergeIndex = target.findIndex((slot) => slot?.itemId === sourceSlot.itemId);
    if (mergeIndex >= 0) {
      const mergeTarget = target[mergeIndex];
      if (!mergeTarget) {
        return false;
      }
      mergeTarget.count += sourceSlot.count;
      source[sourceIndex] = null;
      return true;
    }

    const emptyIndex = target.findIndex((slot) => slot === null);
    if (emptyIndex < 0) {
      return false;
    }

    target[emptyIndex] = this.cloneSlot(sourceSlot);
    source[sourceIndex] = null;
    return true;
  }

  private getSectionSlots(section: InventorySection): Array<InventorySlotStack | null> {
    if (section === "hotbar") {
      return this.hotbarSlots;
    }
    return this.backpackSlots;
  }

  private isIndexInBounds(slots: Array<InventorySlotStack | null>, index: number): boolean {
    return index >= 0 && index < slots.length;
  }

  private aggregateEntries(slots: Array<InventorySlotStack | null>, out: Map<ItemId, number>): void {
    for (const slot of slots) {
      if (!slot) {
        continue;
      }
      const current = out.get(slot.itemId) ?? 0;
      out.set(slot.itemId, current + slot.count);
    }
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
