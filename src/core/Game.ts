import { MouseInput, type GridPointerEvent } from "../input/Mouse";
import { Container } from "../entities/Container";
import { Drill } from "../entities/Drill";
import { Furnace } from "../entities/Furnace";
import { Item } from "../entities/Item";
import { isMachine } from "../entities/Machine";
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
import { HUD, type InventoryTransferRequest, type MachineGuiActionRequest, type MachineTransferMode } from "../ui/HUD";
import { ContainerGui, type ContainerTakeSlotRequest } from "../ui/ContainerGui";
import { TickSystem } from "./TickSystem";
import { World } from "./World";

export interface GameConfig {
  width?: number;
  height?: number;
  tickRate?: number;
}

interface ActiveCraftTask {
  recipe: CraftRecipe;
  elapsedSeconds: number;
}

interface OpenMachineGuiTarget {
  x: number;
  y: number;
  machineType: "furnace" | "drill" | "container";
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
  private readonly containerGui: ContainerGui;
  private readonly mouse: MouseInput;
  private readonly miningInput: MiningInputSystem;
  private readonly placementInput: PlacementInputSystem;
  private readonly unsubscribeInventoryTransfer: () => void;
  private readonly unsubscribeCraftRequest: () => void;
  private readonly unsubscribeMachineGuiAction: () => void;
  private readonly unsubscribeContainerTakeSlot: () => void;
  private readonly unsubscribeContainerCraftRequest: () => void;
  private readonly unsubscribeContainerClose: () => void;
  private readonly unsubscribeMachinePointer: () => void;
  private readonly craftQueue: CraftRecipe[] = [];
  private activeCraft: ActiveCraftTask | null = null;
  private openMachineGuiTarget: OpenMachineGuiTarget | null = null;

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
      if (this.hud.isMachineGuiOpen() || this.containerGui.isOpen()) {
        this.closeMachineGui();
      }
      const inventoryOpen = this.hud.toggleInventory();
      if (inventoryOpen) {
        this.playerMoveKeys.clear();
        this.zoomKeys.clear();
      }
      return;
    }

    if (key === "escape" && (this.hud.isMachineGuiOpen() || this.containerGui.isOpen())) {
      event.preventDefault();
      this.closeMachineGui();
      return;
    }

    if (this.isAnyMenuOpen()) {
      if (this.isPlayerMoveKey(key) || this.isZoomControlKey(key) || key === "f" || this.isPlacementRotateKey(key)) {
        event.preventDefault();
      }
      return;
    }

    if (this.isPlayerMoveKey(key) || this.isZoomControlKey(key) || key === "f" || this.isPlacementRotateKey(key)) {
      event.preventDefault();
    }
    if (key === "f") {
      this.playerSystem.collectNearbyConveyorItems(this.player, this.world);
      this.playerSystem.collectNearbyMachineOutputs(this.player, this.world);
      this.updateHud();
    }
    if (this.isPlacementRotateKey(key)) {
      this.placementInput.rotatePlacementDirection();
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

    if (this.isAnyMenuOpen()) {
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

    this.craftQueue.push(recipe);
    this.startNextCraftIfNeeded();
    this.updateHud();
  };

  private readonly onMachineGuiAction = (request: MachineGuiActionRequest): void => {
    if (request.action === "close") {
      this.closeMachineGui();
      return;
    }

    const target = this.openMachineGuiTarget;
    if (!target) {
      this.closeMachineGui();
      return;
    }

    if (target.machineType === "furnace") {
      const furnace = this.getOpenFurnace();
      if (!furnace) {
        this.closeMachineGui();
        return;
      }

      if (request.action === "insert_ore") {
        const available = this.player.inventory.getCount("iron_ore");
        const amount = this.resolveMachineTransferAmount(available, request.mode);
        this.transferInventoryToFurnaceInput(furnace, "iron_ore", amount);
      } else if (request.action === "take_ore") {
        const stored = furnace.debugState.oreCount;
        const amount = this.resolveMachineTransferAmount(stored, request.mode);
        this.transferFurnaceOreToInventory(furnace, amount);
      } else if (request.action === "insert_fuel") {
        const available = this.player.inventory.getCount("coal_ore");
        const amount = this.resolveMachineTransferAmount(available, request.mode);
        this.transferInventoryToFurnaceInput(furnace, "coal_ore", amount);
      } else if (request.action === "take_fuel") {
        const stored = furnace.debugState.fuelCount;
        const amount = this.resolveMachineTransferAmount(stored, request.mode);
        this.transferFurnaceFuelToInventory(furnace, amount);
      } else if (request.action === "take_output") {
        const outputCount = furnace.debugState.outputCount;
        const amount = this.resolveMachineTransferAmount(outputCount, request.mode);
        this.transferFurnaceOutputToInventory(furnace, amount);
      }
    } else if (target.machineType === "drill") {
      const drill = this.getOpenDrill();
      if (!drill) {
        this.closeMachineGui();
        return;
      }

      if (request.action === "insert_fuel") {
        const available = this.player.inventory.getCount("coal_ore");
        const amount = this.resolveMachineTransferAmount(available, request.mode);
        this.transferInventoryToDrillFuel(drill, amount);
      } else if (request.action === "take_fuel") {
        const stored = drill.debugState.fuelCount;
        const amount = this.resolveMachineTransferAmount(stored, request.mode);
        this.transferDrillFuelToInventory(drill, amount);
      } else if (request.action === "take_output") {
        const outputCount = drill.debugState.outputCount;
        const amount = this.resolveMachineTransferAmount(outputCount, request.mode);
        this.transferDrillOutputToInventory(drill, amount);
      }
    }

    this.syncMachineGui();
    this.updateHud();
  };

  private readonly onContainerTakeSlot = (request: ContainerTakeSlotRequest): void => {
    const container = this.getOpenContainer();
    if (!container) {
      this.closeMachineGui();
      return;
    }

    const slot = container.getSlot(request.slotIndex);
    if (!slot) {
      return;
    }

    const amount = this.resolveMachineTransferAmount(slot.count, request.mode);
    const extracted = container.takeFromSlot(request.slotIndex, amount);
    if (!extracted) {
      return;
    }

    this.player.inventory.add(extracted.itemId, extracted.count);
    this.syncMachineGui();
    this.updateHud();
  };

  private readonly onContainerCraftRequest = (recipeId: string): void => {
    const container = this.getOpenContainer();
    if (!container) {
      return;
    }

    const recipe = CRAFT_RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe) {
      return;
    }

    const crafted = container.tryCraft(recipe.input, recipe.output.item, recipe.output.count);
    if (!crafted) {
      return;
    }

    this.syncMachineGui();
    this.updateHud();
  };

  private readonly onContainerClose = (): void => {
    this.closeMachineGui();
    this.updateHud();
  };

  private readonly handleMachinePointer = (event: GridPointerEvent): void => {
    if (event.button !== 0 || !this.isWorldInputEnabled()) {
      return;
    }

    const tile = this.world.getTile(event.position.x, event.position.y);
    if (!tile?.building || !isMachine(tile.building)) {
      return;
    }

    if (
      tile.building.machineType === "furnace" ||
      tile.building.machineType === "drill" ||
      tile.building.machineType === "container"
    ) {
      this.openMachineGuiTarget = {
        x: event.position.x,
        y: event.position.y,
        machineType: tile.building.machineType,
      };
      this.syncMachineGui();
      this.updateHud();
    }
  };

  private readonly onInventoryTransfer = (request: InventoryTransferRequest): void => {
    const moved = this.player.inventory.moveStack(
      request.fromSection,
      request.fromIndex,
      request.toSection,
      request.toIndex,
      request.amount
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

    if (!this.isAnyMenuOpen()) {
      this.updatePlayerControls(deltaSeconds);
      this.updateZoomControls(deltaSeconds);
    }
    this.miningInput.update(deltaSeconds);
    this.renderer.centerCameraOn(this.player.x, this.player.y);
    this.tickSystem.update(deltaSeconds, (fixedDelta) => this.update(fixedDelta));
    this.updateCrafting(deltaSeconds);
    this.syncMachineGui();
    this.updateWorldItemsSnapshot(deltaSeconds);
    this.renderer.setPlacementPreview(this.placementInput.getPlacementPreview());
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
    this.containerGui = new ContainerGui(host);
    this.unsubscribeInventoryTransfer = this.hud.onInventoryTransfer(this.onInventoryTransfer);
    this.unsubscribeCraftRequest = this.hud.onCraftRequest(this.onCraftRequest);
    this.unsubscribeMachineGuiAction = this.hud.onMachineGuiAction(this.onMachineGuiAction);
    this.unsubscribeContainerTakeSlot = this.containerGui.onTakeSlot(this.onContainerTakeSlot);
    this.unsubscribeContainerCraftRequest = this.containerGui.onCraftRequest(this.onContainerCraftRequest);
    this.unsubscribeContainerClose = this.containerGui.onClose(this.onContainerClose);
    this.mouse = new MouseInput(this.renderer.canvas, (x, y) => this.renderer.screenToGrid(x, y));
    this.miningInput = new MiningInputSystem(
      this.world,
      this.player,
      this.mouse,
      this.playerSystem,
      this.hud,
      () => this.isWorldInputEnabled()
    );
    this.unsubscribeMachinePointer = this.mouse.onPointer(this.handleMachinePointer);
    this.placementInput = new PlacementInputSystem(
      this.world,
      this.player,
      this.mouse,
      () => this.selectedQuickbarIndex,
      () => this.isWorldInputEnabled()
    );
    this.worldItemsSnapshot = this.world.countItemsOnConveyors();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    this.onResize();
    this.renderer.centerCameraOn(this.player.x, this.player.y);
    this.updateHud();
    this.renderer.setPlacementPreview(this.placementInput.getPlacementPreview());
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
    this.unsubscribeMachineGuiAction();
    this.unsubscribeContainerTakeSlot();
    this.unsubscribeContainerCraftRequest();
    this.unsubscribeContainerClose();
    this.unsubscribeMachinePointer();
    this.miningInput.dispose();
    this.placementInput.dispose();
    this.mouse.dispose();
    this.containerGui.dispose();
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

  private isPlacementRotateKey(key: string): boolean {
    return key === "r";
  }

  private isAnyMenuOpen(): boolean {
    return this.hud.isInventoryOpen() || this.hud.isMachineGuiOpen() || this.containerGui.isOpen();
  }

  private isWorldInputEnabled(): boolean {
    return !this.isAnyMenuOpen();
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
      case "KeyR":
        return "r";
      case "Tab":
        return "tab";
      case "Escape":
        return "escape";
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

  private startNextCraftIfNeeded(): void {
    if (this.activeCraft || this.craftQueue.length === 0) {
      return;
    }
    const next = this.craftQueue.shift();
    if (!next) {
      return;
    }
    this.activeCraft = {
      recipe: next,
      elapsedSeconds: 0,
    };
  }

  private updateCrafting(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.startNextCraftIfNeeded();
    if (!this.activeCraft) {
      return;
    }

    let remainingFrameSeconds = deltaSeconds;
    while (remainingFrameSeconds > 0 && this.activeCraft) {
      const durationSeconds = this.getCraftDurationSeconds(this.activeCraft.recipe);
      const remainingCraftSeconds = Math.max(0, durationSeconds - this.activeCraft.elapsedSeconds);
      const consumedSeconds = Math.min(remainingFrameSeconds, remainingCraftSeconds);
      this.activeCraft.elapsedSeconds += consumedSeconds;
      remainingFrameSeconds -= consumedSeconds;

      if (this.activeCraft.elapsedSeconds + 1e-6 < durationSeconds) {
        break;
      }

      this.player.inventory.add(this.activeCraft.recipe.output.item, this.activeCraft.recipe.output.count);
      this.activeCraft = null;
      this.startNextCraftIfNeeded();
    }
  }

  private getCraftDurationSeconds(recipe: CraftRecipe): number {
    return Math.max(0.05, recipe.craftSeconds);
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
    const activeCraft = this.activeCraft;
    const activeCraftDuration = activeCraft ? this.getCraftDurationSeconds(activeCraft.recipe) : 0;
    this.hud.setCraftingStatus({
      recipeTitle: activeCraft?.recipe.name ?? null,
      progress01: activeCraft
        ? Math.min(activeCraft.elapsedSeconds / activeCraftDuration, 1)
        : null,
      remainingSeconds: activeCraft
        ? Math.max(activeCraftDuration - activeCraft.elapsedSeconds, 0)
        : null,
      queuedCount: this.craftQueue.length,
    });
    this.hud.setCraftingRecipes(CRAFT_RECIPES.map((recipe) => ({
      id: recipe.id,
      title: recipe.name,
      outputLabel: `Output: ${getItemDefinition(recipe.output.item).name} x${recipe.output.count}`,
      inputLabel: `Cost: ${this.formatRecipeCost(recipe)}`,
      craftTimeLabel: `Time: ${this.formatDurationSeconds(this.getCraftDurationSeconds(recipe))}`,
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

  private formatDurationSeconds(seconds: number): string {
    if (seconds >= 10) {
      return `${seconds.toFixed(0)}s`;
    }
    return `${seconds.toFixed(1)}s`;
  }

  private resolveMachineTransferAmount(totalCount: number, mode: MachineTransferMode): number {
    if (totalCount <= 0) {
      return 0;
    }
    if (mode === "single") {
      return 1;
    }
    if (mode === "half") {
      return Math.max(1, Math.ceil(totalCount / 2));
    }
    return totalCount;
  }

  private transferInventoryToFurnaceInput(furnace: Furnace, itemId: ItemId, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      if (!furnace.canAcceptInput(itemId, "up")) {
        break;
      }
      if (!this.player.inventory.remove(itemId, 1)) {
        break;
      }
      const accepted = furnace.acceptInput(new Item(itemId), "up");
      if (!accepted) {
        this.player.inventory.add(itemId, 1);
        break;
      }
      moved += 1;
    }
    return moved;
  }

  private transferFurnaceOreToInventory(furnace: Furnace, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      const ore = furnace.takeOreItem();
      if (!ore) {
        break;
      }
      this.player.inventory.addItem(ore);
      moved += 1;
    }
    return moved;
  }

  private transferFurnaceFuelToInventory(furnace: Furnace, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      const fuel = furnace.takeFuelItem();
      if (!fuel) {
        break;
      }
      this.player.inventory.addItem(fuel);
      moved += 1;
    }
    return moved;
  }

  private transferFurnaceOutputToInventory(furnace: Furnace, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      const output = furnace.takeOutputItem();
      if (!output) {
        break;
      }
      this.player.inventory.addItem(output);
      moved += 1;
    }
    return moved;
  }

  private transferInventoryToDrillFuel(drill: Drill, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      if (!drill.canAcceptInput("coal_ore", "up")) {
        break;
      }
      if (!this.player.inventory.remove("coal_ore", 1)) {
        break;
      }
      const accepted = drill.acceptInput(new Item("coal_ore"), "up");
      if (!accepted) {
        this.player.inventory.add("coal_ore", 1);
        break;
      }
      moved += 1;
    }
    return moved;
  }

  private transferDrillFuelToInventory(drill: Drill, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      const fuel = drill.takeFuelItem();
      if (!fuel) {
        break;
      }
      this.player.inventory.addItem(fuel);
      moved += 1;
    }
    return moved;
  }

  private transferDrillOutputToInventory(drill: Drill, amount: number): number {
    const attempts = Math.max(0, Math.floor(amount));
    let moved = 0;
    for (let i = 0; i < attempts; i += 1) {
      const output = drill.takeOutputItem();
      if (!output) {
        break;
      }
      this.player.inventory.addItem(output);
      moved += 1;
    }
    return moved;
  }

  private getOpenFurnace(): Furnace | null {
    const target = this.openMachineGuiTarget;
    if (!target || target.machineType !== "furnace") {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (!tile?.building || !isMachine(tile.building) || tile.building.machineType !== "furnace") {
      return null;
    }
    return tile.building as Furnace;
  }

  private getOpenDrill(): Drill | null {
    const target = this.openMachineGuiTarget;
    if (!target || target.machineType !== "drill") {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (!tile?.building || !isMachine(tile.building) || tile.building.machineType !== "drill") {
      return null;
    }
    return tile.building as Drill;
  }

  private getOpenContainer(): Container | null {
    const target = this.openMachineGuiTarget;
    if (!target || target.machineType !== "container") {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (!tile?.building || !isMachine(tile.building) || tile.building.machineType !== "container") {
      return null;
    }
    return tile.building as Container;
  }

  private syncMachineGui(): void {
    const target = this.openMachineGuiTarget;
    if (!target) {
      this.hud.setFurnaceGui(null);
      this.hud.setDrillGui(null);
      this.containerGui.setView(null);
      return;
    }

    if (target.machineType === "furnace") {
      const furnace = this.getOpenFurnace();
      if (!furnace) {
        this.closeMachineGui();
        return;
      }

      const state = furnace.debugState;
      this.hud.setDrillGui(null);
      this.containerGui.setView(null);
      this.hud.setFurnaceGui({
        gridX: target.x,
        gridY: target.y,
        oreCount: state.oreCount,
        oreCapacity: state.oreCapacity,
        fuelCount: state.fuelCount,
        fuelCapacity: state.fuelCapacity,
        outputCount: state.outputCount,
        outputCapacity: state.outputCapacity,
        progress01: state.progress01,
      });
      return;
    }

    if (target.machineType === "drill") {
      const drill = this.getOpenDrill();
      if (!drill) {
        this.closeMachineGui();
        return;
      }

      const state = drill.debugState;
      this.hud.setFurnaceGui(null);
      this.containerGui.setView(null);
      this.hud.setDrillGui({
        gridX: target.x,
        gridY: target.y,
        resourceType: state.resourceType,
        fuelCount: state.fuelCount,
        fuelCapacity: state.fuelCapacity,
        outputCount: state.outputCount,
        outputCapacity: state.outputCapacity,
        progress01: state.progress01,
      });
      return;
    }

    const container = this.getOpenContainer();
    if (!container) {
      this.closeMachineGui();
      return;
    }

    const state = container.debugState;
    this.hud.setFurnaceGui(null);
    this.hud.setDrillGui(null);
    this.containerGui.setView({
      gridX: target.x,
      gridY: target.y,
      slots: state.slots,
      maxStackPerSlot: state.maxStackPerSlot,
      totalCount: state.totalCount,
      totalCapacity: state.totalCapacity,
    });
    this.containerGui.setCraftingRecipes(CRAFT_RECIPES.map((recipe) => ({
      id: recipe.id,
      title: recipe.name,
      outputLabel: `Output: ${getItemDefinition(recipe.output.item).name} x${recipe.output.count}`,
      inputLabel: `Cost: ${this.formatRecipeCost(recipe)}`,
      craftTimeLabel: "Instant",
      canCraft: container.canCraft(recipe.input, recipe.output.item, recipe.output.count),
    })));
  }

  private closeMachineGui(): void {
    this.openMachineGuiTarget = null;
    this.hud.setFurnaceGui(null);
    this.hud.setDrillGui(null);
    this.containerGui.setView(null);
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
