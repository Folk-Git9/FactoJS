import type { ItemId } from "./items";

export interface Recipe {
  id: string;
  input: Partial<Record<ItemId, number>>;
  output: {
    item: ItemId;
    count: number;
  };
  durationSeconds: number;
}

export const RECIPES: Recipe[] = [
  {
    id: "smelt_iron",
    input: { iron_ore: 1 },
    output: { item: "iron_plate", count: 1 },
    durationSeconds: 1.5,
  },
];
