import { World } from "../core/World";
import { oppositeDirection } from "../core/types";
import { isConveyorNode } from "../entities/Conveyor";
import type { Item } from "../entities/Item";
import { isInputMachine } from "../entities/Machine";

interface BeltSystemEvents {
  onItemExitedWorld?: (item: Item) => void;
}

interface TransferIntent {
  x: number;
  y: number;
  carryProgress: number;
}

export class BeltSystem {
  private readonly events: BeltSystemEvents;

  constructor(events: BeltSystemEvents = {}) {
    this.events = events;
  }

  update(world: World, deltaSeconds: number): void {
    const transfers: TransferIntent[] = [];

    world.grid.forEach((tile, x, y) => {
      if (!isConveyorNode(tile.building) || !tile.building.item) {
        return;
      }

      tile.building.progress += tile.building.speedTilesPerSecond * deltaSeconds;
      if (tile.building.progress >= 1) {
        transfers.push({
          x,
          y,
          carryProgress: tile.building.progress - 1,
        });
      }
    });

    for (const transfer of transfers) {
      this.applyTransfer(world, transfer);
    }
  }

  private applyTransfer(world: World, transfer: TransferIntent): void {
    const sourceTile = world.getTile(transfer.x, transfer.y);
    if (!sourceTile || !isConveyorNode(sourceTile.building) || !sourceTile.building.item) {
      return;
    }

    const source = sourceTile.building;
    const outputDirections = source.getOutputDirections(source.entryDirection);
    let hasOutOfBoundsOutput = false;

    for (const outputDirection of outputDirections) {
      const nextPosition = world.getNeighborPosition(transfer.x, transfer.y, outputDirection);
      if (!nextPosition) {
        hasOutOfBoundsOutput = true;
        continue;
      }

      const nextTile = world.getTile(nextPosition.x, nextPosition.y);
      if (!nextTile || !nextTile.building) {
        continue;
      }

      if (isConveyorNode(nextTile.building) && nextTile.building.canAcceptItem()) {
        source.onItemDispatched?.(outputDirection);

        const movedItem = source.releaseItem();
        if (!movedItem) {
          return;
        }

        nextTile.building.acceptItem(movedItem, Math.min(transfer.carryProgress, 0.99), outputDirection);
        return;
      }

      if (isInputMachine(nextTile.building)) {
        const sourceItemType = source.item?.type;
        if (!sourceItemType) {
          return;
        }
        const inputDirection = oppositeDirection(outputDirection);
        if (!nextTile.building.canAcceptInput(sourceItemType, inputDirection)) {
          continue;
        }

        source.onItemDispatched?.(outputDirection);
        const movedItem = source.releaseItem();
        if (!movedItem) {
          return;
        }

        const accepted = nextTile.building.acceptInput(movedItem, inputDirection);
        if (!accepted) {
          source.acceptItem(movedItem, 1, source.entryDirection);
          return;
        }
        return;
      }
    }

    if (hasOutOfBoundsOutput && outputDirections.length === 1) {
      const item = source.releaseItem();
      if (item) {
        this.events.onItemExitedWorld?.(item);
      }
      return;
    }

    source.progress = 1;
  }
}
