import type { ItemId } from "../data/items";
import type { Item } from "../entities/Item";

export class Inventory {
  private readonly counts = new Map<ItemId, number>();

  add(item: Item): void {
    const current = this.counts.get(item.type) ?? 0;
    this.counts.set(item.type, current + 1);
  }

  getCount(itemId: ItemId): number {
    return this.counts.get(itemId) ?? 0;
  }

  entries(): Array<[ItemId, number]> {
    return [...this.counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }
}
