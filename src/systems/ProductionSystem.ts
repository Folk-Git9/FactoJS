import { World } from "../core/World";
import { isConveyorNode } from "../entities/Conveyor";
import { Item } from "../entities/Item";
import { Machine } from "../entities/Machine";

export class ProductionSystem {
  update(world: World, deltaSeconds: number): void {
    world.grid.forEach((tile, x, y) => {
      if (!(tile.building instanceof Machine)) {
        return;
      }

      const machine = tile.building;
      const producedCount = machine.advance(deltaSeconds);
      if (producedCount <= 0) {
        return;
      }

      for (let i = 0; i < producedCount; i += 1) {
        const outputPosition = world.getNeighborPosition(x, y, machine.outputDirection);
        if (!outputPosition) {
          return;
        }

        const outputTile = world.getTile(outputPosition.x, outputPosition.y);
        if (!outputTile || !isConveyorNode(outputTile.building) || !outputTile.building.canAcceptItem()) {
          return;
        }

        outputTile.building.acceptItem(new Item(machine.outputItem), 0, machine.outputDirection);
      }
    });
  }
}
