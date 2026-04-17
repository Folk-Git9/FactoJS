import { World } from "../core/World";
import { oppositeDirection } from "../core/types";
import type { Direction } from "../core/types";
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
    const sourceItemType = source.item?.type;
    if (!sourceItemType) {
      return;
    }
    const outputDirections = source.getOutputDirections(source.entryDirection, sourceItemType);
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
        if (
          nextTile.building.kind === "router" &&
          !this.hasRouterForwardOutput(world, nextPosition.x, nextPosition.y, outputDirection, sourceItemType)
        ) {
          continue;
        }

        source.onItemDispatched?.(outputDirection);

        const movedItem = source.releaseItem();
        if (!movedItem) {
          return;
        }

        nextTile.building.acceptItem(movedItem, Math.min(transfer.carryProgress, 0.99), outputDirection);
        return;
      }

      if (isInputMachine(nextTile.building)) {
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

  private hasRouterForwardOutput(
    world: World,
    routerX: number,
    routerY: number,
    entryDirection: Direction,
    itemType: Item["type"]
  ): boolean {
    const routerTile = world.getTile(routerX, routerY);
    if (!routerTile || !isConveyorNode(routerTile.building) || routerTile.building.kind !== "router") {
      return true;
    }

    const outputDirections = routerTile.building.getOutputDirections(entryDirection, itemType, { preview: true });
    for (const outputDirection of outputDirections) {
      const forwardPosition = world.getNeighborPosition(routerX, routerY, outputDirection);
      if (!forwardPosition) {
        continue;
      }

      const forwardTile = world.getTile(forwardPosition.x, forwardPosition.y);
      if (!forwardTile?.building) {
        continue;
      }

      if (isConveyorNode(forwardTile.building)) {
        if (forwardTile.building.canAcceptItem()) {
          return true;
        }
        continue;
      }

      if (isInputMachine(forwardTile.building)) {
        const inputDirection = oppositeDirection(outputDirection);
        if (forwardTile.building.canAcceptInput(itemType, inputDirection)) {
          return true;
        }
      }
    }

    return false;
  }
}
