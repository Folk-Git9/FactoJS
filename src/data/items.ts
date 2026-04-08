export type ItemId =
  | "iron_ore"
  | "iron_plate"
  | "stone"
  | "coal_ore"
  | "belt_item"
  | "furnace_item"
  | "router_item"
  | "drill_item"
  | "container_item";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  color: number;
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  stone: {
    id: "stone",
    name: "Stone",
    color: 0x9f9f9f,
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    color: 0x8a99aa,
  },
  coal_ore: {
    id: "coal_ore",
    name: "Coal Ore",
    color: 0x3f434a,
  },
  belt_item: {
    id: "belt_item",
    name: "Conveyor Belt",
    color: 0xf5a524,
  },
  furnace_item: {
    id: "furnace_item",
    name: "Stone Furnace",
    color: 0xb8743b,
  },
  router_item: {
    id: "router_item",
    name: "Router",
    color: 0x17a2b8,
  },
  drill_item: {
    id: "drill_item",
    name: "Burner Drill",
    color: 0x5a9f56,
  },
  container_item: {
    id: "container_item",
    name: "Container",
    color: 0x4e78a9,
  },
  iron_plate: {
    id: "iron_plate",
    name: "Iron Plate",
    color: 0xcdd6df,
  },
};

export type ResourceItemId = "stone" | "iron_ore" | "coal_ore";
export type PlaceableItemId = "belt_item" | "furnace_item" | "router_item" | "drill_item" | "container_item";

export const RESOURCE_ITEM_IDS: ResourceItemId[] = ["stone", "iron_ore", "coal_ore"];
export const PLACEABLE_ITEM_IDS: PlaceableItemId[] = ["belt_item", "furnace_item", "router_item", "drill_item", "container_item"];

export const getItemDefinition = (itemId: ItemId): ItemDefinition => ITEM_DEFINITIONS[itemId];

export const isPlaceableItemId = (itemId: ItemId): itemId is PlaceableItemId => {
  return (
    itemId === "belt_item" ||
    itemId === "furnace_item" ||
    itemId === "router_item" ||
    itemId === "drill_item" ||
    itemId === "container_item"
  );
};
