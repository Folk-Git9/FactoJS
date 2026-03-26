import type { ItemId } from "../data/items";

let itemCounter = 0;

export class Item {
  readonly uid: string;
  readonly type: ItemId;

  constructor(type: ItemId) {
    this.uid = `item-${itemCounter++}`;
    this.type = type;
  }
}
