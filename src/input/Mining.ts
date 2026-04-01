import type { GridPosition } from "../core/types";
import { World } from "../core/World";
import { Player } from "../entities/Player";
import { getItemDefinition } from "../data/items";
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
  private miningTarget: GridPosition | null = null;
  private miningElapsedSeconds = 0;

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
    this.stopMining();
  }

  update(deltaSeconds: number): void {
    if (!this.isInputEnabled()) {
      this.stopMining();
      this.isRightButtonHeld = false;
      return;
    }

    if (!this.isRightButtonHeld || !this.pointerCell) {
      this.stopMining();
      return;
    }

    const target = this.pointerCell;
    const tile = this.world.getTile(target.x, target.y);
    const resource = tile?.resource ?? null;
    if (!resource) {
      this.stopMining();
      return;
    }

    if (!this.playerSystem.canMineResourceAtGrid(this.player, this.world, target.x, target.y)) {
      this.stopMining();
      return;
    }

    if (!this.miningTarget || this.miningTarget.x !== target.x || this.miningTarget.y !== target.y) {
      this.miningTarget = { x: target.x, y: target.y };
      this.miningElapsedSeconds = 0;
    }

    this.miningElapsedSeconds += deltaSeconds;
    const progress = Math.min(this.miningElapsedSeconds / this.mineDurationSeconds, 1);
    const resourceName = getItemDefinition(resource.type).name;
    this.hud.setMiningProgress(progress, `Mining ${resourceName}`);

    if (progress < 1) {
      return;
    }

    const mined = this.playerSystem.mineResourceAtGrid(this.player, this.world, target.x, target.y, 1);
    this.miningElapsedSeconds = 0;

    const afterMine = this.world.getTile(target.x, target.y)?.resource ?? null;
    this.hud.setHoveredResource(afterMine ? { type: afterMine.type, amount: afterMine.amount } : null);

    if (!mined || !afterMine) {
      this.stopMining();
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
      this.stopMining();
      return;
    }

    this.isRightButtonHeld = event.isDown;
    if (event.position) {
      this.setPointerCell(event.position);
    }

    if (!event.isDown) {
      this.stopMining();
    }
  };

  private setPointerCell(position: GridPosition | null): void {
    this.pointerCell = position;
    this.hud.setHoveredCell(position);

    if (!position) {
      this.hud.setHoveredResource(null);
      this.stopMining();
      return;
    }

    const hoveredResource = this.world.getTile(position.x, position.y)?.resource ?? null;
    this.hud.setHoveredResource(hoveredResource ? { type: hoveredResource.type, amount: hoveredResource.amount } : null);

    if (this.miningTarget && (this.miningTarget.x !== position.x || this.miningTarget.y !== position.y)) {
      this.stopMining();
    }
  }

  private stopMining(): void {
    this.miningTarget = null;
    this.miningElapsedSeconds = 0;
    this.hud.setMiningProgress(null);
  }
}
