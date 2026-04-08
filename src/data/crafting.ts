import type { ItemId } from "./items";

export type CraftRecipeId = "craft_furnace" | "craft_belt" | "craft_router" | "craft_drill" | "craft_container";

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
];
