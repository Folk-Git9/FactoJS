import type { ConveyorNode } from "../entities/Conveyor";
import type { Machine } from "../entities/Machine";
import type { ResourceItemId } from "../data/items";

export type Building = ConveyorNode | Machine;

export interface ResourceDeposit {
  type: ResourceItemId;
  amount: number;
  maxAmount: number;
}

export class Tile {
  building: Building | null = null;
  resource: ResourceDeposit | null = null;
}
