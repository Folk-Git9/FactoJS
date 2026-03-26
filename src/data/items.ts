export type ItemId = "iron_ore" | "iron_plate";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  color: number;
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    color: 0x8a99aa,
  },
  iron_plate: {
    id: "iron_plate",
    name: "Iron Plate",
    color: 0xcdd6df,
  },
};

export const getItemDefinition = (itemId: ItemId): ItemDefinition => ITEM_DEFINITIONS[itemId];
