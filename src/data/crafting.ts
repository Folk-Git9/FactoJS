import type { ItemId } from "./items";

export type CraftRecipeId =
  | "craft_furnace"
  | "craft_belt"
  | "craft_router"
  | "craft_drill"
  | "craft_container"
  | "craft_iron_chest"
  | "craft_unloader"
  | "craft_turret"
  | "craft_ammo_rounds"
  | "craft_programmable_machine";

export interface CraftRecipe {
  id: CraftRecipeId;
  name: string;
  craftSeconds: number;
  input: Partial<Record<ItemId, number>>;
  output: {
    item: ItemId;
    count: number;
  };
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "craft_furnace",
    name: "Stone Furnace",
    craftSeconds: 2.8,
    input: {
      stone: 5,
    },
    output: {
      item: "furnace_item",
      count: 1,
    },
  },
  {
    id: "craft_belt",
    name: "Conveyor Belt",
    craftSeconds: 0.7,
    input: {
      iron_plate: 1,
    },
    output: {
      item: "belt_item",
      count: 1,
    },
  },
  {
    id: "craft_router",
    name: "Router",
    craftSeconds: 0.9,
    input: {
      iron_plate: 2,
    },
    output: {
      item: "router_item",
      count: 1,
    },
  },
  {
    id: "craft_drill",
    name: "Burner Drill",
    craftSeconds: 2.4,
    input: {
      iron_plate: 6,
      stone: 4,
    },
    output: {
      item: "drill_item",
      count: 1,
    },
  },
  {
    id: "craft_container",
    name: "Container",
    craftSeconds: 1.8,
    input: {
      stone: 8,
      iron_plate: 2,
    },
    output: {
      item: "container_item",
      count: 1,
    },
  },
  {
    id: "craft_iron_chest",
    name: "Iron Chest",
    craftSeconds: 2.2,
    input: {
      iron_plate: 8,
    },
    output: {
      item: "iron_chest_item",
      count: 1,
    },
  },
  {
    id: "craft_unloader",
    name: "Unloader",
    craftSeconds: 1.4,
    input: {
      iron_plate: 3,
      belt_item: 1,
    },
    output: {
      item: "unloader_item",
      count: 1,
    },
  },
  {
    id: "craft_turret",
    name: "Turret",
    craftSeconds: 3.2,
    input: {
      iron_plate: 10,
      stone: 4,
    },
    output: {
      item: "turret_item",
      count: 1,
    },
  },
  {
    id: "craft_ammo_rounds",
    name: "Ammo Rounds",
    craftSeconds: 1.1,
    input: {
      iron_plate: 1,
      coal_ore: 1,
    },
    output: {
      item: "ammo_rounds",
      count: 8,
    },
  },
  {
    id: "craft_programmable_machine",
    name: "Programmable Machine",
    craftSeconds: 2.8,
    input: {
      iron_plate: 4,
      stone: 2,
    },
    output: {
      item: "programmable_machine_item",
      count: 1,
    },
  },
];
