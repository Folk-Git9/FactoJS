import type { GridPosition } from "../core/types";
import { World } from "../core/World";
import { Player } from "../entities/Player";
import { getItemDefinition, type ItemId } from "../data/items";
import { isConveyorNode } from "../entities/Conveyor";
import { isMachine } from "../entities/Machine";
import { PlayerSystem } from "../systems/PlayerSystem";
import { HUD } from "../ui/HUD";
import { MouseInput, type GridPointerButtonEvent, type GridPointerEvent } from "./Mouse";

const DEFAULT_MINE_DURATION_SECONDS = 0.5;

export class MiningInputSystem {
  private readonly world: World;
  private readonly player: Player;
  private readonly mouse: MouseInput;
  private readonly playerSystem: PlayerSystem;
  private readonly hud: HUD;
  private readonly isInputEnabled: () => boolean;
  private readonly mineDurationSeconds: number;
  private readonly unsubscribePointerDown: () => void;
  private readonly unsubscribePointerMove: () => void;
  private readonly unsubscribeButtonState: () => void;

  private pointerCell: GridPosition | null = null;
  private isRightButtonHeld = false;
  private interactionTarget: GridPosition | null = null;
  private interactionElapsedSeconds = 0;
  private interactionMode: "mine" | "pickup" | null = null;

  constructor(
    world: World,
    player: Player,
    mouse: MouseInput,
    playerSystem: PlayerSystem,
    hud: HUD,
    isInputEnabled: () => boolean = () => true,
    mineDurationSeconds = DEFAULT_MINE_DURATION_SECONDS
  ) {
    this.world = world;
    this.player = player;
    this.mouse = mouse;
    this.playerSystem = playerSystem;
    this.hud = hud;
    this.isInputEnabled = isInputEnabled;
    this.mineDurationSeconds = Math.max(0.05, mineDurationSeconds);

    this.unsubscribePointerDown = this.mouse.onPointer(this.handlePointerDown);
    this.unsubscribePointerMove = this.mouse.onPointerMove(this.handlePointerMove);
    this.unsubscribeButtonState = this.mouse.onButtonState(this.handleButtonState);
  }

  dispose(): void {
    this.unsubscribePointerDown();
    this.unsubscribePointerMove();
    this.unsubscribeButtonState();
    this.stopInteraction();
  }

  update(deltaSeconds: number): void {
    if (!this.isInputEnabled()) {
      this.stopInteraction();
      this.isRightButtonHeld = false;
      return;
    }

    if (!this.isRightButtonHeld || !this.pointerCell) {
      this.stopInteraction();
      return;
    }

    const target = this.pointerCell;
    const tile = this.world.getTile(target.x, target.y);
    if (!tile) {
      this.stopInteraction();
      return;
    }

    if (!this.playerSystem.canReachGridCell(this.player, this.world, target.x, target.y)) {
      this.stopInteraction();
      return;
    }

    if (tile.building) {
      this.updateBuildingPickup(target, deltaSeconds);
      return;
    }

    if (!tile.resource) {
      this.stopInteraction();
      return;
    }

    this.beginInteraction("mine", target);
    this.interactionElapsedSeconds += deltaSeconds;
    const progress = Math.min(this.interactionElapsedSeconds / this.mineDurationSeconds, 1);
    const resourceName = getItemDefinition(tile.resource.type).name;
    this.hud.setMiningProgress(progress, `Mining ${resourceName}`);

    if (progress < 1) {
      return;
    }

    const mined = this.playerSystem.mineResourceAtGrid(this.player, this.world, target.x, target.y, 1);
    this.interactionElapsedSeconds = 0;

    const afterMine = this.world.getTile(target.x, target.y)?.resource ?? null;
    this.hud.setHoveredResource(afterMine ? { type: afterMine.type, amount: afterMine.amount } : null);

    if (!mined || !afterMine) {
      this.stopInteraction();
    }
  }

  private handlePointerDown = (event: GridPointerEvent): void => {
    if (!this.isInputEnabled()) {
      return;
    }
    this.setPointerCell(event.position);
  };

  private handlePointerMove = (position: GridPosition | null): void => {
    if (!this.isInputEnabled()) {
      return;
    }
    this.setPointerCell(position);
  };

  private handleButtonState = (event: GridPointerButtonEvent): void => {
    if (event.button !== 2) {
      return;
    }

    if (!this.isInputEnabled()) {
      this.isRightButtonHeld = false;
      this.stopInteraction();
      return;
    }

    this.isRightButtonHeld = event.isDown;
    if (event.position) {
      this.setPointerCell(event.position);
    }

    if (!event.isDown) {
      this.stopInteraction();
    }
  };

  private setPointerCell(position: GridPosition | null): void {
    this.pointerCell = position;
    this.hud.setHoveredCell(position);

    if (!position) {
      this.hud.setHoveredResource(null);
      this.stopInteraction();
      return;
    }

    const hoveredTile = this.world.getTile(position.x, position.y);
    const hoveredResource = hoveredTile?.building ? null : (hoveredTile?.resource ?? null);
    this.hud.setHoveredResource(hoveredResource ? { type: hoveredResource.type, amount: hoveredResource.amount } : null);

    if (this.interactionTarget && (this.interactionTarget.x !== position.x || this.interactionTarget.y !== position.y)) {
      this.stopInteraction();
    }
  }

  private updateBuildingPickup(target: GridPosition, deltaSeconds: number): void {
    this.beginInteraction("pickup", target);
    this.interactionElapsedSeconds += deltaSeconds;
    const progress = Math.min(this.interactionElapsedSeconds / this.mineDurationSeconds, 1);
    this.hud.setMiningProgress(progress, "Picking Up Building");

    if (progress < 1) {
      return;
    }

    const picked = this.tryPickupBuildingAt(target.x, target.y);
    this.interactionElapsedSeconds = 0;
    const hoveredResource = this.world.getTile(target.x, target.y)?.resource ?? null;
    this.hud.setHoveredResource(hoveredResource ? { type: hoveredResource.type, amount: hoveredResource.amount } : null);

    if (!picked) {
      this.stopInteraction();
    }
  }

  private beginInteraction(mode: "mine" | "pickup", target: GridPosition): void {
    if (
      this.interactionMode !== mode ||
      !this.interactionTarget ||
      this.interactionTarget.x !== target.x ||
      this.interactionTarget.y !== target.y
    ) {
      this.interactionMode = mode;
      this.interactionTarget = { x: target.x, y: target.y };
      this.interactionElapsedSeconds = 0;
    }
  }

  private tryPickupBuildingAt(gridX: number, gridY: number): boolean {
    const tile = this.world.getTile(gridX, gridY);
    if (!tile?.building) {
      return false;
    }

    if (!this.playerSystem.canReachGridCell(this.player, this.world, gridX, gridY)) {
      return false;
    }

    const pickupItem = this.getBuildingPickupItem(tile.building);
    this.world.clearBuilding(gridX, gridY);
    if (pickupItem) {
      this.player.inventory.add(pickupItem, 1);
    }
    return true;
  }

  private getBuildingPickupItem(building: unknown): ItemId | null {
    if (isConveyorNode(building)) {
      if (building.kind === "belt") {
        return "belt_item";
      }
      if (building.kind === "router") {
        return "router_item";
      }
    }
    if (isMachine(building) && building.machineType === "furnace") {
      return "furnace_item";
    }
    if (isMachine(building) && building.machineType === "drill") {
      return "drill_item";
    }
    return null;
  }

  private stopInteraction(): void {
    this.interactionTarget = null;
    this.interactionElapsedSeconds = 0;
    this.interactionMode = null;
    this.hud.setMiningProgress(null);
  }
}
