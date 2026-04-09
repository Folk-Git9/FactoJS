import type { Direction, GridPosition } from "../core/types";
import { rotateDirection } from "../core/types";
import { World } from "../core/World";
import type { PlaceableItemId } from "../data/items";
import { Item } from "../entities/Item";
import { isInputMachine, isProducerMachine } from "../entities/Machine";
import { Player } from "../entities/Player";
import { MouseInput, type GridPointerEvent } from "./Mouse";

export interface PlacementPreview {
  x: number;
  y: number;
  kind: "belt" | "router" | "machine";
  direction: Direction;
  canPlace: boolean;
}

export interface PlacementActionEvent {
  itemId: PlaceableItemId;
  x: number;
  y: number;
  direction: Direction;
}

export interface PlacementMachineInsertEvent {
  x: number;
  y: number;
  itemId: Item["type"];
  inputDirection: Direction;
  count: number;
}

export class PlacementInputSystem {
  private readonly world: World;
  private readonly player: Player;
  private readonly mouse: MouseInput;
  private readonly isInputEnabled: () => boolean;
  private readonly getSelectedQuickbarIndex: () => number;
  private readonly onPlacement?: (event: PlacementActionEvent) => void;
  private readonly onMachineInsert?: (event: PlacementMachineInsertEvent) => void;
  private readonly unsubscribePointerDown: () => void;
  private readonly unsubscribePointerMove: () => void;

  private pointerCell: GridPosition | null = null;
  private placementDirection: Direction = "right";

  constructor(
    world: World,
    player: Player,
    mouse: MouseInput,
    getSelectedQuickbarIndex: () => number,
    isInputEnabled: () => boolean = () => true,
    onPlacement?: (event: PlacementActionEvent) => void,
    onMachineInsert?: (event: PlacementMachineInsertEvent) => void
  ) {
    this.world = world;
    this.player = player;
    this.mouse = mouse;
    this.getSelectedQuickbarIndex = getSelectedQuickbarIndex;
    this.isInputEnabled = isInputEnabled;
    this.onPlacement = onPlacement;
    this.onMachineInsert = onMachineInsert;

    this.unsubscribePointerDown = this.mouse.onPointer(this.handlePointerDown);
    this.unsubscribePointerMove = this.mouse.onPointerMove(this.handlePointerMove);
  }

  dispose(): void {
    this.unsubscribePointerDown();
    this.unsubscribePointerMove();
  }

  rotatePlacementDirection(): void {
    if (!this.isInputEnabled()) {
      return;
    }
    this.placementDirection = rotateDirection(this.placementDirection);
  }

  getPlacementPreview(): PlacementPreview | null {
    if (!this.isInputEnabled() || !this.pointerCell) {
      return null;
    }

    const hotbarIndex = this.getSelectedQuickbarIndex();
    const slot = this.player.inventory.getHotbarSlot(hotbarIndex);
    const kind = this.resolvePlacementKind(slot?.itemId ?? null);
    if (!kind) {
      return null;
    }

    return {
      x: this.pointerCell.x,
      y: this.pointerCell.y,
      kind,
      direction: this.placementDirection,
      canPlace: this.canPlaceAt(this.pointerCell.x, this.pointerCell.y, slot?.itemId ?? null),
    };
  }

  private handlePointerDown = (event: GridPointerEvent): void => {
    this.pointerCell = event.position;
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

    const placementDirection = this.placementDirection;

    if (slot.itemId === "belt_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeBelt(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "belt_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
      }
      return;
    }

    if (slot.itemId === "router_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeRouter(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "router_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
      }
      return;
    }

    if (slot.itemId === "furnace_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeFurnace(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "furnace_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
      }
      return;
    }

    if (slot.itemId === "drill_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeDrill(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "drill_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
      }
      return;
    }

    if (slot.itemId === "container_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeContainer(event.position.x, event.position.y)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "container_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
      }
      return;
    }

    if (slot.itemId === "iron_chest_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeIronChest(event.position.x, event.position.y)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "iron_chest_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
      }
      return;
    }

    if (slot.itemId === "unloader_item") {
      if (!this.canPlaceAt(event.position.x, event.position.y, slot.itemId)) {
        return;
      }
      if (this.world.placeUnloader(event.position.x, event.position.y, placementDirection)) {
        this.player.inventory.consumeHotbarItem(hotbarIndex, 1);
        this.onPlacement?.({
          itemId: "unloader_item",
          x: event.position.x,
          y: event.position.y,
          direction: placementDirection,
        });
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
        } else {
          this.onMachineInsert?.({
            x: event.position.x,
            y: event.position.y,
            itemId: consumed,
            inputDirection,
            count: 1,
          });
        }
        return;
      }
    }

    this.tryTakeMachineOutput(tile.building);
  };

  private handlePointerMove = (position: GridPosition | null): void => {
    this.pointerCell = position;
  };

  private resolvePlacementKind(itemId: string | null): "belt" | "router" | "machine" | null {
    if (itemId === "belt_item") {
      return "belt";
    }
    if (itemId === "router_item") {
      return "router";
    }
    if (itemId === "furnace_item") {
      return "machine";
    }
    if (itemId === "drill_item") {
      return "machine";
    }
    if (itemId === "container_item") {
      return "machine";
    }
    if (itemId === "iron_chest_item") {
      return "machine";
    }
    if (itemId === "unloader_item") {
      return "machine";
    }
    return null;
  }

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
    const dx = this.getGridCellWorldX(gridX) - this.player.x;
    const dy = this.getGridCellWorldY(gridY) - this.player.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? "right" : "left";
    }
    return dy >= 0 ? "up" : "down";
  }

  private canPlaceAt(gridX: number, gridY: number, itemId: string | null): boolean {
    const tile = this.world.getTile(gridX, gridY);
    if (!tile || tile.building) {
      return false;
    }
    if (itemId === "drill_item" && !tile.resource) {
      return false;
    }
    return this.isWithinPlacementRange(gridX, gridY);
  }

  private isWithinPlacementRange(gridX: number, gridY: number): boolean {
    const maxPlacementDistance = this.player.pickupRadius + 3.9;
    return this.getDistanceToGridCell(gridX, gridY) <= maxPlacementDistance;
  }

  private getDistanceToGridCell(gridX: number, gridY: number): number {
    const dx = this.getGridCellWorldX(gridX) - this.player.x;
    const dy = this.getGridCellWorldY(gridY) - this.player.y;
    return Math.hypot(dx, dy);
  }

  private getGridCellWorldX(gridX: number): number {
    return gridX - this.world.width / 2 + 0.5;
  }

  private getGridCellWorldY(gridY: number): number {
    return this.world.height / 2 - gridY - 0.5;
  }

}
