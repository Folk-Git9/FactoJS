import type { Direction } from "../core/types";
import type { Item } from "./Item";

export type ConveyorKind = "belt" | "router";

export interface ConveyorRoutingOptions {
  preview?: boolean;
}

export interface ConveyorNode {
  readonly kind: ConveyorKind;
  direction: Direction;
  speedTilesPerSecond: number;
  item: Item | null;
  progress: number;
  entryDirection: Direction;

  canAcceptItem(): boolean;
  acceptItem(item: Item, progress?: number, entryDirection?: Direction): void;
  releaseItem(): Item | null;
  getOutputDirections(entryDirection: Direction, itemType?: Item["type"], options?: ConveyorRoutingOptions): Direction[];
  onItemDispatched?(outputDirection: Direction): void;
}

export const isConveyorNode = (value: unknown): value is ConveyorNode => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ConveyorNode>;
  return (
    (candidate.kind === "belt" || candidate.kind === "router") &&
    typeof candidate.canAcceptItem === "function" &&
    typeof candidate.acceptItem === "function" &&
    typeof candidate.releaseItem === "function" &&
    typeof candidate.getOutputDirections === "function"
  );
};
