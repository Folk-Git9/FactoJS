import type { ConveyorNode } from "../entities/Conveyor";
import type { Machine } from "../entities/Machine";

export type Building = ConveyorNode | Machine;

export class Tile {
  building: Building | null = null;
}
