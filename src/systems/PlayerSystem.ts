import { World } from "../core/World";
import { isConveyorNode } from "../entities/Conveyor";
import { isProducerMachine } from "../entities/Machine";
import { Player } from "../entities/Player";

export class PlayerSystem {
  updateMovement(player: Player, world: World, inputX: number, inputY: number, deltaSeconds: number): void {
    let directionX = inputX;
    let directionY = inputY;
    const length = Math.hypot(directionX, directionY);
    if (length > 0) {
      directionX /= length;
      directionY /= length;
    }

    const travel = player.speedTilesPerSecond * deltaSeconds;
    const nextX = player.x + directionX * travel;
    const nextY = player.y + directionY * travel;

    const minX = -world.width / 2 + 0.5;
    const maxX = world.width / 2 - 0.5;
    const minY = -world.height / 2 + 0.5;
    const maxY = world.height / 2 - 0.5;

    player.x = Math.min(Math.max(nextX, minX), maxX);
    player.y = Math.min(Math.max(nextY, minY), maxY);
  }

  collectNearbyConveyorItems(player: Player, world: World, maxItemsToCollect = 3): number {
    const centerGridX = Math.floor(player.x + world.width / 2);
    const centerGridY = Math.floor(world.height / 2 - player.y);
    const scanRadius = Math.ceil(player.pickupRadius + 0.6);

    let collected = 0;
    for (let y = centerGridY - scanRadius; y <= centerGridY + scanRadius; y += 1) {
      for (let x = centerGridX - scanRadius; x <= centerGridX + scanRadius; x += 1) {
        if (collected >= maxItemsToCollect) {
          return collected;
        }

        const tile = world.getTile(x, y);
        if (!tile || !isConveyorNode(tile.building) || !tile.building.item) {
          continue;
        }

        const tileWorldX = x - world.width / 2 + 0.5;
        const tileWorldY = world.height / 2 - y - 0.5;
        const distance = Math.hypot(tileWorldX - player.x, tileWorldY - player.y);
        if (distance > player.pickupRadius) {
          continue;
        }

        const item = tile.building.releaseItem();
        if (!item) {
          continue;
        }

        player.inventory.addItem(item);
        collected += 1;
      }
    }

    return collected;
  }

  collectNearbyMachineOutputs(player: Player, world: World, maxItemsToCollect = 4): number {
    const centerGridX = Math.floor(player.x + world.width / 2);
    const centerGridY = Math.floor(world.height / 2 - player.y);
    const scanRadius = Math.ceil(player.pickupRadius + 0.6);

    let collected = 0;
    for (let y = centerGridY - scanRadius; y <= centerGridY + scanRadius; y += 1) {
      for (let x = centerGridX - scanRadius; x <= centerGridX + scanRadius; x += 1) {
        if (collected >= maxItemsToCollect) {
          return collected;
        }

        const tile = world.getTile(x, y);
        if (!tile || !isProducerMachine(tile.building)) {
          continue;
        }

        const tileWorldX = x - world.width / 2 + 0.5;
        const tileWorldY = world.height / 2 - y - 0.5;
        const distance = Math.hypot(tileWorldX - player.x, tileWorldY - player.y);
        if (distance > player.pickupRadius) {
          continue;
        }

        while (tile.building.hasOutputItem() && collected < maxItemsToCollect) {
          const item = tile.building.takeOutputItem();
          if (!item) {
            break;
          }
          player.inventory.addItem(item);
          collected += 1;
        }
      }
    }

    return collected;
  }

  mineResourceAtGrid(player: Player, world: World, gridX: number, gridY: number, strength = 1): boolean {
    if (strength <= 0) {
      return false;
    }

    if (!this.canMineResourceAtGrid(player, world, gridX, gridY)) {
      return false;
    }

    const minedResource = world.mineResourceAt(gridX, gridY, strength);
    if (!minedResource) {
      return false;
    }

    player.inventory.add(minedResource, 1);
    return true;
  }

  canMineResourceAtGrid(player: Player, world: World, gridX: number, gridY: number): boolean {
    const distance = this.getDistanceToGridCell(player, world, gridX, gridY);
    const maxMineDistance = player.pickupRadius + 0.9;
    return distance <= maxMineDistance;
  }

  private getDistanceToGridCell(player: Player, world: World, gridX: number, gridY: number): number {
    const tileWorldX = gridX - world.width / 2 + 0.5;
    const tileWorldY = world.height / 2 - gridY - 0.5;
    return Math.hypot(tileWorldX - player.x, tileWorldY - player.y);
  }
}
