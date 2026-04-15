export type ItemId =
  | "iron_ore"
  | "iron_plate"
  | "stone"
  | "coal_ore"
  | "ammo_rounds"
  | "belt_item"
  | "furnace_item"
  | "router_item"
  | "drill_item"
  | "container_item"
  | "iron_chest_item"
  | "unloader_item"
  | "turret_item"
  | "programmable_machine_item";

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
  ammo_rounds: {
    id: "ammo_rounds",
    name: "Ammo Rounds",
    color: 0xd8c16f,
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
  iron_chest_item: {
    id: "iron_chest_item",
    name: "Iron Chest",
    color: 0x8ea2b6,
  },
  unloader_item: {
    id: "unloader_item",
    name: "Unloader",
    color: 0xcd9f59,
  },
  turret_item: {
    id: "turret_item",
    name: "Turret",
    color: 0xc66a4b,
  },
  programmable_machine_item: {
    id: "programmable_machine_item",
    name: "Programmable Machine",
    color: 0x6fa8dc,
  },
  iron_plate: {
    id: "iron_plate",
    name: "Iron Plate",
    color: 0xcdd6df,
  },
};

export type ResourceItemId = "stone" | "iron_ore" | "coal_ore";
export type PlaceableItemId =
  | "belt_item"
  | "furnace_item"
  | "router_item"
  | "drill_item"
  | "container_item"
  | "iron_chest_item"
  | "unloader_item"
  | "turret_item"
  | "programmable_machine_item";

export const RESOURCE_ITEM_IDS: ResourceItemId[] = ["stone", "iron_ore", "coal_ore"];
export const PLACEABLE_ITEM_IDS: PlaceableItemId[] = [
  "belt_item",
  "furnace_item",
  "router_item",
  "drill_item",
  "container_item",
  "iron_chest_item",
  "unloader_item",
  "turret_item",
  "programmable_machine_item",
];

export const getItemDefinition = (itemId: ItemId): ItemDefinition => ITEM_DEFINITIONS[itemId];

export const isPlaceableItemId = (itemId: ItemId): itemId is PlaceableItemId => {
  return (
    itemId === "belt_item" ||
    itemId === "furnace_item" ||
    itemId === "router_item" ||
    itemId === "drill_item" ||
    itemId === "container_item" ||
    itemId === "iron_chest_item" ||
    itemId === "unloader_item" ||
    itemId === "turret_item" ||
    itemId === "programmable_machine_item"
  );
};
