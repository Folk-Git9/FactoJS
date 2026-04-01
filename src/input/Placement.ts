import type { Direction } from "../core/types";
import { World } from "../core/World";
import { Player } from "../entities/Player";
import { isInputMachine, isProducerMachine } from "../entities/Machine";
import { Item } from "../entities/Item";
import { MouseInput, type GridPointerEvent } from "./Mouse";

export class PlacementInputSystem {
  private readonly world: World;
  private readonly player: Player;
  private readonly mouse: MouseInput;
  private readonly isInputEnabled: () => boolean;
  private readonly getSelectedQuickbarIndex: () => number;
  private readonly unsubscribePointerDown: () => void;

  constructor(
    world: World,
    player: Player,
    mouse: MouseInput,
    getSelectedQuickbarIndex: () => number,
    isInputEnabled: () => boolean = () => true
  ) {
    this.world = world;
    this.player = player;
    this.mouse = mouse;
    this.getSelectedQuickbarIndex = getSelectedQuickbarIndex;
    this.isInputEnabled = isInputEnabled;

    this.unsubscribePointerDown = this.mouse.onPointer(this.handlePointerDown);
  }

  dispose(): void {
    this.unsubscribePointerDown();
  }

  private handlePointerDown = (event: GridPointerEvent): void => {
    if (!this.isInputEnabled() || event.button !== 0) {
      return;
    }

    const tile = this.world.getTile(event.position.x, event.position.y);
    if (!tile) {
      return;
    }

    const hotbarIndex = this.getSelectedQuickbarIndex();
    const slot = this.player.inventory.getHotbarSlot(hotbarIndex);
    if (!slot) {
      this.tryTakeMachineOutput(tile.building);
      return;
    }

    const placementDirection: Direction = "right";

    if (slot.itemId === "belt_item") {
      if (tile.building) {
        return;
      }
      if (this.world.placeBelt(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
      }
      return;
    }

    if (slot.itemId === "furnace_item") {
      if (tile.building) {
        return;
      }
      if (this.world.placeFurnace(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
      }
      return;
    }

    if (tile.building && isInputMachine(tile.building)) {
      const inputDirection = this.getInputDirection(event.position.x, event.position.y);
      if (tile.building.canAcceptInput(slot.itemId, inputDirection)) {
        const consumed = this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        if (!consumed) {
          return;
        }

        const accepted = tile.building.acceptInput(new Item(consumed), inputDirection);
        if (!accepted) {
          this.player.inventory.add(consumed, 1);
        }
        return;
      }
    }

    this.tryTakeMachineOutput(tile.building);
  };

  private tryTakeMachineOutput(building: unknown): void {
    if (!isProducerMachine(building)) {
      return;
    }

    const output = building.takeOutputItem();
    if (!output) {
      return;
    }

    this.player.inventory.addItem(output);
  }

  private getInputDirection(gridX: number, gridY: number): Direction {
    const tileWorldX = gridX - this.world.width / 2 + 0.5;
    const tileWorldY = this.world.height / 2 - gridY - 0.5;
    const dx = tileWorldX - this.player.x;
    const dy = tileWorldY - this.player.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? "right" : "left";
    }
    return dy >= 0 ? "up" : "down";
  }
}
