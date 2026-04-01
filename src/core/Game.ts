import { MouseInput } from "../input/Mouse";
import { Player } from "../entities/Player";
import { MiningInputSystem } from "../input/Mining";
import { PlacementInputSystem } from "../input/Placement";
import { Renderer } from "../render/Renderer";
import { BeltSystem } from "../systems/BeltSystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { ProductionSystem } from "../systems/ProductionSystem";
import { TransportSystem } from "../systems/TransportSystem";
import {
  CRAFT_RECIPES,
  type CraftRecipe,
} from "../data/crafting";
import { getItemDefinition, type ItemId } from "../data/items";
import { HUD, type InventoryTransferRequest } from "../ui/HUD";
import { TickSystem } from "./TickSystem";
import { World } from "./World";

export interface GameConfig {
  width?: number;
  height?: number;
  tickRate?: number;
}

export class Game {
  private readonly world: World;
  private readonly player: Player;
  private readonly tickSystem: TickSystem;
  private readonly playerSystem: PlayerSystem;
  private readonly productionSystem: ProductionSystem;
  private readonly transportSystem: TransportSystem;

  private readonly renderer: Renderer;
  private readonly hud: HUD;
  private readonly mouse: MouseInput;
  private readonly miningInput: MiningInputSystem;
  private readonly placementInput: PlacementInputSystem;
  private readonly unsubscribeInventoryTransfer: () => void;
  private readonly unsubscribeCraftRequest: () => void;

  private isRunning = false;
  private lastFrameTimeMs = 0;
  private smoothedFps = 60;
  private worldItemsSnapshot = 0;
  private worldItemsSampleAccumulator = 0;
  private selectedQuickbarIndex = 0;
  private readonly playerMoveKeys = new Set<string>();
  private readonly zoomKeys = new Set<string>();

  private readonly onResize = (): void => {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = this.resolveControlKey(event);
    const hotbarIndex = this.resolveHotbarIndex(event);

    if (hotbarIndex !== null) {
      event.preventDefault();
      this.selectedQuickbarIndex = hotbarIndex;
      this.updateHud();
      return;
    }

    if (key === "tab") {
      event.preventDefault();
      const inventoryOpen = this.hud.toggleInventory();
      if (inventoryOpen) {
        this.playerMoveKeys.clear();
        this.zoomKeys.clear();
      }
      return;
    }

    if (this.hud.isInventoryOpen()) {
      if (this.isPlayerMoveKey(key) || this.isZoomControlKey(key) || key === "f") {
        event.preventDefault();
      }
      return;
    }

    if (this.isPlayerMoveKey(key) || this.isZoomControlKey(key) || key === "f") {
      event.preventDefault();
    }
    if (key === "f") {
      this.playerSystem.collectNearbyConveyorItems(this.player, this.world);
      this.playerSystem.collectNearbyMachineOutputs(this.player, this.world);
      this.updateHud();
    }
    if (this.isPlayerMoveKey(key)) {
      this.playerMoveKeys.add(key);
    }
    if (this.isZoomControlKey(key)) {
      this.zoomKeys.add(key);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = this.resolveControlKey(event);

    if (key === "tab") {
      event.preventDefault();
      return;
    }

    if (this.hud.isInventoryOpen()) {
      if (this.isPlayerMoveKey(key) || this.isZoomControlKey(key)) {
        event.preventDefault();
      }
      return;
    }

    if (this.isPlayerMoveKey(key) || this.isZoomControlKey(key)) {
      event.preventDefault();
    }
    this.playerMoveKeys.delete(key);
    this.zoomKeys.delete(key);
  };

  private readonly onWindowBlur = (): void => {
    this.playerMoveKeys.clear();
    this.zoomKeys.clear();
  };

  private readonly onCraftRequest = (recipeId: string): void => {
    const recipe = CRAFT_RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe) {
      return;
    }
    if (!this.canCraft(recipe)) {
      return;
    }

    for (const [itemId, requiredCount] of Object.entries(recipe.input) as Array<[ItemId, number | undefined]>) {
      if (!requiredCount || requiredCount <= 0) {
        continue;
      }
      this.player.inventory.remove(itemId, requiredCount);
    }

    this.player.inventory.add(recipe.output.item, recipe.output.count);
    this.updateHud();
  };

  private readonly onInventoryTransfer = (request: InventoryTransferRequest): void => {
    const moved = this.player.inventory.moveStack(
      request.fromSection,
      request.fromIndex,
      request.toSection,
      request.toIndex
    );

    if (moved) {
      this.updateHud();
    }
  };

  private readonly frame = (timestampMs: number): void => {
    if (!this.isRunning) {
      return;
    }

    const deltaSeconds = Math.min((timestampMs - this.lastFrameTimeMs) / 1000, 0.1);
    this.lastFrameTimeMs = timestampMs;

    const instantFps = 1 / Math.max(deltaSeconds, 0.0001);
    this.smoothedFps = this.smoothedFps * 0.9 + instantFps * 0.1;

    if (!this.hud.isInventoryOpen()) {
      this.updatePlayerControls(deltaSeconds);
      this.updateZoomControls(deltaSeconds);
    }
    this.miningInput.update(deltaSeconds);
    this.renderer.centerCameraOn(this.player.x, this.player.y);
    this.tickSystem.update(deltaSeconds, (fixedDelta) => this.update(fixedDelta));
    this.updateWorldItemsSnapshot(deltaSeconds);
    this.renderer.render(this.world, this.player);
    this.updateHud();

    requestAnimationFrame(this.frame);
  };

  constructor(host: HTMLElement, config: GameConfig = {}) {
    const width = config.width ?? 200;
    const height = config.height ?? 140;
    const tickRate = config.tickRate ?? 60;

    this.world = new World(width, height);
    this.player = new Player(0, 0);

    this.tickSystem = new TickSystem(tickRate);
    this.playerSystem = new PlayerSystem();
    this.productionSystem = new ProductionSystem();

    const beltSystem = new BeltSystem();
    this.transportSystem = new TransportSystem(beltSystem);

    host.style.margin = "0";
    host.style.overflow = "hidden";
    host.style.position = "relative";

    this.renderer = new Renderer(host, this.world);
    this.hud = new HUD(host);
    this.unsubscribeInventoryTransfer = this.hud.onInventoryTransfer(this.onInventoryTransfer);
    this.unsubscribeCraftRequest = this.hud.onCraftRequest(this.onCraftRequest);
    this.mouse = new MouseInput(this.renderer.canvas, (x, y) => this.renderer.screenToGrid(x, y));
    this.miningInput = new MiningInputSystem(
      this.world,
      this.player,
      this.mouse,
      this.playerSystem,
      this.hud,
      () => !this.hud.isInventoryOpen()
    );
    this.placementInput = new PlacementInputSystem(
      this.world,
      this.player,
      this.mouse,
      () => this.selectedQuickbarIndex,
      () => !this.hud.isInventoryOpen()
    );
    this.worldItemsSnapshot = this.world.countItemsOnConveyors();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    this.onResize();
    this.renderer.centerCameraOn(this.player.x, this.player.y);
    this.updateHud();
    this.renderer.render(this.world, this.player);
  }

  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.lastFrameTimeMs = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.isRunning = false;
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    this.unsubscribeInventoryTransfer();
    this.unsubscribeCraftRequest();
    this.miningInput.dispose();
    this.placementInput.dispose();
    this.mouse.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }

  private update(deltaSeconds: number): void {
    this.productionSystem.update(this.world, deltaSeconds);
    this.transportSystem.update(this.world, deltaSeconds);
    this.world.advance(deltaSeconds);
  }

  private updatePlayerControls(deltaSeconds: number): void {
    let moveX = 0;
    let moveY = 0;

    if (this.playerMoveKeys.has("a")) {
      moveX -= 1;
    }
    if (this.playerMoveKeys.has("d")) {
      moveX += 1;
    }
    if (this.playerMoveKeys.has("w")) {
      moveY += 1;
    }
    if (this.playerMoveKeys.has("s")) {
      moveY -= 1;
    }

    this.playerSystem.updateMovement(this.player, this.world, moveX, moveY, deltaSeconds);
  }

  private updateZoomControls(deltaSeconds: number): void {
    let zoomMultiplier = 1;
    if (this.zoomKeys.has("q") || this.zoomKeys.has("=") || this.zoomKeys.has("+")) {
      zoomMultiplier *= Math.exp(deltaSeconds * 1.8);
    }
    if (this.zoomKeys.has("e") || this.zoomKeys.has("-")) {
      zoomMultiplier *= Math.exp(-deltaSeconds * 1.8);
    }
    if (zoomMultiplier !== 1) {
      this.renderer.zoomCamera(zoomMultiplier);
    }
  }

  private isZoomControlKey(key: string): boolean {
    return (
      key === "q" ||
      key === "e" ||
      key === "+" ||
      key === "-" ||
      key === "="
    );
  }

  private isPlayerMoveKey(key: string): boolean {
    return key === "w" || key === "a" || key === "s" || key === "d";
  }

  private resolveControlKey(event: KeyboardEvent): string {
    switch (event.code) {
      case "KeyW":
        return "w";
      case "KeyA":
        return "a";
      case "KeyS":
        return "s";
      case "KeyD":
        return "d";
      case "KeyQ":
        return "q";
      case "KeyE":
        return "e";
      case "KeyF":
        return "f";
      case "Tab":
        return "tab";
      case "Equal":
        return "=";
      case "Minus":
        return "-";
      case "NumpadAdd":
        return "+";
      case "NumpadSubtract":
        return "-";
      default:
        return event.key.toLowerCase();
    }
  }

  private resolveHotbarIndex(event: KeyboardEvent): number | null {
    switch (event.code) {
      case "Digit1":
      case "Numpad1":
        return 0;
      case "Digit2":
      case "Numpad2":
        return 1;
      case "Digit3":
      case "Numpad3":
        return 2;
      case "Digit4":
      case "Numpad4":
        return 3;
      case "Digit5":
      case "Numpad5":
        return 4;
      case "Digit6":
      case "Numpad6":
        return 5;
      case "Digit7":
      case "Numpad7":
        return 6;
      case "Digit8":
      case "Numpad8":
        return 7;
      case "Digit9":
      case "Numpad9":
        return 8;
      case "Digit0":
      case "Numpad0":
        return 9;
      default:
        return null;
    }
  }

  private canCraft(recipe: CraftRecipe): boolean {
    for (const [itemId, requiredCount] of Object.entries(recipe.input) as Array<[ItemId, number | undefined]>) {
      if (!requiredCount || requiredCount <= 0) {
        continue;
      }
      if (this.player.inventory.getCount(itemId) < requiredCount) {
        return false;
      }
    }
    return true;
  }

  private updateHud(): void {
    this.hud.setStats({
      fps: this.smoothedFps,
      tick: this.world.tick,
      worldItems: this.worldItemsSnapshot,
    });
    this.hud.setPlayerPosition(this.player.x, this.player.y);
    this.hud.setPlayerInventory(this.player.inventory.getView());
    this.hud.setSelectedQuickbarIndex(this.selectedQuickbarIndex);
    this.hud.setCraftingRecipes(CRAFT_RECIPES.map((recipe) => ({
      id: recipe.id,
      title: recipe.name,
      outputLabel: `Output: ${getItemDefinition(recipe.output.item).name} x${recipe.output.count}`,
      inputLabel: `Cost: ${this.formatRecipeCost(recipe)}`,
      canCraft: this.canCraft(recipe),
    })));
  }

  private formatRecipeCost(recipe: CraftRecipe): string {
    const parts: string[] = [];
    for (const [itemId, amount] of Object.entries(recipe.input) as Array<[ItemId, number | undefined]>) {
      if (!amount || amount <= 0) {
        continue;
      }
      parts.push(`${getItemDefinition(itemId).name} x${amount}`);
    }
    return parts.length > 0 ? parts.join(", ") : "-";
  }

  private updateWorldItemsSnapshot(deltaSeconds: number): void {
    this.worldItemsSampleAccumulator += deltaSeconds;
    if (this.worldItemsSampleAccumulator < 0.25) {
      return;
    }

    this.worldItemsSampleAccumulator = 0;
    this.worldItemsSnapshot = this.world.countItemsOnConveyors();
  }
}
