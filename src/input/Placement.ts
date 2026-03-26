import type { BuildTool, Direction } from "../core/types";
import { rotateDirection } from "../core/types";
import { World } from "../core/World";
import { MouseInput, type GridPointerEvent } from "./Mouse";
import { HUD } from "../ui/HUD";

export class PlacementSystem {
  private readonly world: World;
  private readonly mouse: MouseInput;
  private readonly hud: HUD;

  private tool: BuildTool = "belt";
  private direction: Direction = "right";
  private readonly unsubscribeMouse: () => void;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();

    switch (key) {
      case "r":
        this.direction = rotateDirection(this.direction);
        this.syncHud();
        break;
      case "1":
        this.tool = "belt";
        this.syncHud();
        break;
      case "2":
        this.tool = "machine";
        this.syncHud();
        break;
      case "3":
        this.tool = "router";
        this.syncHud();
        break;
      case "4":
        this.tool = "eraser";
        this.syncHud();
        break;
      default:
        break;
    }
  };

  constructor(world: World, mouse: MouseInput, hud: HUD) {
    this.world = world;
    this.mouse = mouse;
    this.hud = hud;
    this.unsubscribeMouse = this.mouse.onPointer(this.handlePointer);
    window.addEventListener("keydown", this.onKeyDown);
    this.syncHud();
  }

  dispose(): void {
    this.unsubscribeMouse();
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private handlePointer = (event: GridPointerEvent): void => {
    const { x, y } = event.position;
    this.hud.setHoveredCell(event.position);

    if (event.button === 2 || this.tool === "eraser") {
      this.world.clearBuilding(x, y);
      return;
    }

    if (this.tool === "machine") {
      this.world.placeMachine(x, y, "iron_ore", this.direction);
      return;
    }

    if (this.tool === "router") {
      this.world.placeRouter(x, y, this.direction);
      return;
    }

    this.world.placeBelt(x, y, this.direction);
  };

  private syncHud(): void {
    this.hud.setBuildMode(this.tool, this.direction);
  }
}
