import type { ItemId } from "./items";

export type CraftRecipeId = "craft_furnace" | "craft_belt";

export interface CraftRecipe {
  id: CraftRecipeId;
  name: string;
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
    input: {
      iron_plate: 1,
    },
    output: {
      item: "belt_item",
      count: 1,
    },
  },
];
