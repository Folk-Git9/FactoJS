import { World } from "../core/World";
import { isConveyorNode } from "../entities/Conveyor";
import { isProducerMachine } from "../entities/Machine";

export class ProductionSystem {
  update(world: World, deltaSeconds: number): void {
    world.grid.forEach((tile, x, y) => {
      if (!isProducerMachine(tile.building)) {
        return;
      }

      const machine = tile.building;
      machine.advance(deltaSeconds);
      if (!machine.hasOutputItem()) {
        return;
      }

      const outputPosition = world.getNeighborPosition(x, y, machine.outputDirection);
      if (!outputPosition) {
        return;
      }

      const outputTile = world.getTile(outputPosition.x, outputPosition.y);
      if (!outputTile || !isConveyorNode(outputTile.building)) {
        return;
      }

      while (machine.hasOutputItem() && outputTile.building.canAcceptItem()) {
        const outputItem = machine.takeOutputItem();
        if (!outputItem) {
          break;
        }
        outputTile.building.acceptItem(outputItem, 0, machine.outputDirection);
      }
    });
  }
}
