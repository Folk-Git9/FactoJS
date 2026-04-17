import { MouseInput, type GridPointerEvent } from "../input/Mouse";
import { Container } from "../entities/Container";
import { Drill } from "../entities/Drill";
import { Furnace } from "../entities/Furnace";
import { Item } from "../entities/Item";
import { ProgrammableMachine } from "../entities/ProgrammableMachine";
import { Router } from "../entities/Router";
import { Unloader } from "../entities/Unloader";
import { isConveyorNode } from "../entities/Conveyor";
import { isInputMachine, isMachine } from "../entities/Machine";
import { Player } from "../entities/Player";
import type { InventorySection } from "../entities/PlayerInventory";
import { MiningInputSystem } from "../input/Mining";
import {
  PlacementInputSystem,
  type PlacementActionEvent,
  type PlacementMachineInsertEvent,
} from "../input/Placement";
import { Renderer } from "../render/Renderer";
import { BeltSystem } from "../systems/BeltSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { ProductionSystem } from "../systems/ProductionSystem";
import { TransportSystem } from "../systems/TransportSystem";
import { MultiplayerClient } from "../net/MultiplayerClient";
import type { MultiplayerReplicatedAction } from "../net/protocol";
import {
  CRAFT_RECIPES,
  type CraftRecipe,
} from "../data/crafting";
import { ITEM_DEFINITIONS, getItemDefinition, type ItemId, type PlaceableItemId } from "../data/items";
import { HUD, type InventoryTransferRequest, type MachineGuiActionRequest, type MachineTransferMode } from "../ui/HUD";
import { ContainerGui, type ContainerTakeSlotRequest } from "../ui/ContainerGui";
import {
  ProgrammableMachineGui,
  type ProgrammableMachineApplyRequest,
  type ProgrammableMachineTakeSlotRequest,
} from "../ui/ProgrammableMachineGui";
import {
  ProgrammableRouterGui,
  type ProgrammableRouterApplyRequest,
} from "../ui/ProgrammableRouterGui";
import { UnloaderGui, type UnloaderFilterChangeRequest } from "../ui/UnloaderGui";
import { TickSystem } from "./TickSystem";
import { World } from "./World";

export interface GameConfig {
  width?: number;
  height?: number;
  tickRate?: number;
  multiplayerClient?: MultiplayerClient | null;
}

interface ActiveCraftTask {
  recipe: CraftRecipe;
  elapsedSeconds: number;
}

interface OpenMachineGuiTarget {
  x: number;
  y: number;
  machineType: "router" | "furnace" | "drill" | "container" | "iron_chest" | "unloader" | "programmable_machine";
}

export class Game {
  private readonly world: World;
  private readonly player: Player;
  private readonly tickSystem: TickSystem;
  private readonly playerSystem: PlayerSystem;
  private readonly productionSystem: ProductionSystem;
  private readonly transportSystem: TransportSystem;
  private readonly combatSystem: CombatSystem;

  private readonly renderer: Renderer;
  private readonly hud: HUD;
  private readonly containerGui: ContainerGui;
  private readonly programmableMachineGui: ProgrammableMachineGui;
  private readonly programmableRouterGui: ProgrammableRouterGui;
  private readonly unloaderGui: UnloaderGui;
  private readonly mouse: MouseInput;
  private readonly miningInput: MiningInputSystem;
  private readonly placementInput: PlacementInputSystem;
  private readonly multiplayerClient: MultiplayerClient | null;
  private readonly unsubscribeInventoryTransfer: () => void;
  private readonly unsubscribeCraftRequest: () => void;
  private readonly unsubscribeMachineGuiAction: () => void;
  private readonly unsubscribeContainerTakeSlot: () => void;
  private readonly unsubscribeContainerCraftRequest: () => void;
  private readonly unsubscribeContainerClose: () => void;
  private readonly unsubscribeProgrammableMachineTakeSlot: () => void;
  private readonly unsubscribeProgrammableMachineApply: () => void;
  private readonly unsubscribeProgrammableMachineClose: () => void;
  private readonly unsubscribeProgrammableRouterApply: () => void;
  private readonly unsubscribeProgrammableRouterClose: () => void;
  private readonly unsubscribeUnloaderFilterChange: () => void;
  private readonly unsubscribeUnloaderClose: () => void;
  private readonly unsubscribeMachinePointer: () => void;
  private readonly unsubscribeMultiplayerAction: (() => void) | null;
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
    if (this.isTextInputFocused()) {
      if (this.resolveControlKey(event) === "escape" && this.isMachineOverlayOpen()) {
        event.preventDefault();
        this.closeMachineGui();
      }
      return;
    }

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
      if (this.isMachineOverlayOpen()) {
        this.closeMachineGui();
      }
      const inventoryOpen = this.hud.toggleInventory();
      if (inventoryOpen) {
        this.playerMoveKeys.clear();
        this.zoomKeys.clear();
      }
      return;
    }

    if (key === "m") {
      event.preventDefault();
      if (this.isMachineOverlayOpen()) {
        this.closeMachineGui();
      }
      const creativeOpen = this.hud.toggleCreativeMenu();
      if (creativeOpen) {
        this.playerMoveKeys.clear();
        this.zoomKeys.clear();
      }
      return;
    }

    if (key === "escape" && this.isMachineOverlayOpen()) {
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
    if (this.isTextInputFocused()) {
      return;
    }

    const key = this.resolveControlKey(event);

    if (key === "tab") {
      event.preventDefault();
      return;
    }

    if (key === "m") {
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
        const moved = this.transferInventoryToFurnaceInput(furnace, "iron_ore", amount);
        if (moved > 0) {
          this.multiplayerClient?.sendAction({
            kind: "machine_insert",
            x: target.x,
            y: target.y,
            itemId: "iron_ore",
            inputDirection: "up",
            count: moved,
          });
        }
      } else if (request.action === "take_ore") {
        const stored = furnace.debugState.oreCount;
        const amount = this.resolveMachineTransferAmount(stored, request.mode);
        this.transferFurnaceOreToInventory(furnace, amount);
      } else if (request.action === "insert_fuel") {
        const available = this.player.inventory.getCount("coal_ore");
        const amount = this.resolveMachineTransferAmount(available, request.mode);
        const moved = this.transferInventoryToFurnaceInput(furnace, "coal_ore", amount);
        if (moved > 0) {
          this.multiplayerClient?.sendAction({
            kind: "machine_insert",
            x: target.x,
            y: target.y,
            itemId: "coal_ore",
            inputDirection: "up",
            count: moved,
          });
        }
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
        const moved = this.transferInventoryToDrillFuel(drill, amount);
        if (moved > 0) {
          this.multiplayerClient?.sendAction({
            kind: "machine_insert",
            x: target.x,
            y: target.y,
            itemId: "coal_ore",
            inputDirection: "up",
            count: moved,
          });
        }
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

  private readonly onUnloaderFilterChange = (request: UnloaderFilterChangeRequest): void => {
    const unloader = this.getOpenUnloader();
    if (!unloader) {
      this.closeMachineGui();
      return;
    }

    unloader.setFilter(request.slotIndex, request.itemId);
    this.syncMachineGui();
  };

  private readonly onUnloaderClose = (): void => {
    this.closeMachineGui();
  };

  private readonly onProgrammableMachineTakeSlot = (request: ProgrammableMachineTakeSlotRequest): void => {
    const machine = this.getOpenProgrammableMachine();
    if (!machine) {
      this.closeMachineGui();
      return;
    }

    const state = machine.debugState;
    const slot = request.section === "input"
      ? state.inputSlots[request.slotIndex] ?? null
      : state.outputSlots[request.slotIndex] ?? null;
    if (!slot) {
      return;
    }

    const amount = this.resolveMachineTransferAmount(slot.count, request.mode);
    const extracted = request.section === "input"
      ? machine.takeInputSlot(request.slotIndex, amount)
      : machine.takeOutputSlot(request.slotIndex, amount);
    if (!extracted) {
      return;
    }

    this.player.inventory.add(extracted.itemId, extracted.count);
    this.syncMachineGui();
    this.updateHud();
  };

  private readonly onProgrammableMachineApply = (request: ProgrammableMachineApplyRequest): void => {
    const target = this.openMachineGuiTarget;
    const machine = this.getOpenProgrammableMachine();
    if (!target || !machine) {
      this.closeMachineGui();
      return;
    }

    machine.applyProgramSource(request.source);
    this.multiplayerClient?.sendAction({
      kind: "set_program_source",
      x: target.x,
      y: target.y,
      source: request.source,
    });
    this.syncMachineGui();
    this.updateHud();
  };

  private readonly onProgrammableMachineClose = (): void => {
    this.closeMachineGui();
  };

  private readonly handleMachinePointer = (event: GridPointerEvent): void => {
    if (event.button !== 0 || !this.isWorldInputEnabled()) {
      return;
    }

    const tile = this.world.getTile(event.position.x, event.position.y);
    if (!tile?.building) {
      return;
    }

    if (isConveyorNode(tile.building) && tile.building.kind === "router") {
      this.openMachineGuiTarget = {
        x: event.position.x,
        y: event.position.y,
        machineType: "router",
      };
      this.syncMachineGui();
      this.updateHud();
      return;
    }

    if (!isMachine(tile.building)) {
      return;
    }

    if (
      tile.building.machineType === "furnace" ||
      tile.building.machineType === "drill" ||
      tile.building.machineType === "container" ||
      tile.building.machineType === "iron_chest" ||
      tile.building.machineType === "unloader" ||
      tile.building.machineType === "programmable_machine"
    ) {
      if (
        (
          tile.building.machineType === "container" ||
          tile.building.machineType === "iron_chest" ||
          tile.building.machineType === "programmable_machine"
        ) &&
        this.shouldDeferMachineGuiForManualInsert(event.position.x, event.position.y, tile.building)
      ) {
        return;
      }

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
    let moved = false;
    const fromInventory = this.isPlayerInventorySection(request.fromSection);
    const toInventory = this.isPlayerInventorySection(request.toSection);

    if (fromInventory && toInventory) {
      const fromSection = request.fromSection as InventorySection;
      const toSection = request.toSection as InventorySection;
      moved = this.player.inventory.moveStack(
        fromSection,
        request.fromIndex,
        toSection,
        request.toIndex,
        request.amount
      );
    } else if (!fromInventory && request.fromSection === "creative" && toInventory && request.itemId) {
      const toSection = request.toSection as InventorySection;
      const requestedAmount = Math.max(1, Math.floor(request.amount ?? 1));
      moved = this.player.inventory.insertIntoSlot(
        toSection,
        request.toIndex,
        request.itemId,
        requestedAmount
      ) > 0;
    } else if (fromInventory && request.toSection === "trash") {
      const fromSection = request.fromSection as InventorySection;
      const removed = this.player.inventory.takeFromSlot(
        fromSection,
        request.fromIndex,
        request.amount
      );
      moved = removed !== null;
    }

    if (moved) {
      this.updateHud();
    }
  };

  private readonly onProgrammableRouterApply = (request: ProgrammableRouterApplyRequest): void => {
    const target = this.openMachineGuiTarget;
    const router = this.getOpenRouter();
    if (!target || !router) {
      this.closeMachineGui();
      return;
    }

    router.applyProgramSource(request.source);
    this.multiplayerClient?.sendAction({
      kind: "set_router_program_source",
      x: target.x,
      y: target.y,
      source: request.source,
    });
    this.syncMachineGui();
    this.updateHud();
  };

  private readonly onProgrammableRouterClose = (): void => {
    this.closeMachineGui();
  };

  private readonly onLocalPlacementAction = (event: PlacementActionEvent): void => {
    this.multiplayerClient?.sendAction({
      kind: "place_building",
      itemId: event.itemId,
      x: event.x,
      y: event.y,
      direction: event.direction,
    });
  };

  private readonly onLocalMineResourceAction = (x: number, y: number, amount: number): void => {
    this.multiplayerClient?.sendAction({
      kind: "mine_resource",
      x,
      y,
      amount,
    });
  };

  private readonly onLocalPickupBuildingAction = (x: number, y: number): void => {
    this.multiplayerClient?.sendAction({
      kind: "pickup_building",
      x,
      y,
    });
  };

  private readonly onReplicatedAction = (action: MultiplayerReplicatedAction): void => {
    this.applyReplicatedAction(action);
  };

  private readonly onLocalMachineInsertAction = (event: PlacementMachineInsertEvent): void => {
    this.multiplayerClient?.sendAction({
      kind: "machine_insert",
      x: event.x,
      y: event.y,
      itemId: event.itemId,
      inputDirection: event.inputDirection,
      count: event.count,
    });
  };

  private readonly frame = (timestampMs: number): void => {
    if (!this.isRunning) {
      return;
    }

    const deltaSeconds = Math.max(0, (timestampMs - this.lastFrameTimeMs) / 1000);
    this.lastFrameTimeMs = timestampMs;

    const instantFps = 1 / Math.max(deltaSeconds, 0.0001);
    this.smoothedFps = this.smoothedFps * 0.9 + instantFps * 0.1;

    if (!this.isAnyMenuOpen()) {
      this.updatePlayerControls(deltaSeconds);
      this.updateZoomControls(deltaSeconds);
    }
    this.multiplayerClient?.updateLocalPosition(this.player.x, this.player.y);
    this.miningInput.update(deltaSeconds);
    this.renderer.centerCameraOn(this.player.x, this.player.y);
    this.tickSystem.update(deltaSeconds, (fixedDelta) => this.update(fixedDelta));
    this.updateCrafting(deltaSeconds);
    this.syncMachineGui();
    this.updateWorldItemsSnapshot(deltaSeconds);
    this.renderer.setPlacementPreview(this.placementInput.getPlacementPreview());
    this.renderer.render(this.world, this.player, this.multiplayerClient?.getRemotePlayers() ?? []);
    this.updateHud();

    requestAnimationFrame(this.frame);
  };

  constructor(host: HTMLElement, config: GameConfig = {}) {
    const width = config.width ?? 200;
    const height = config.height ?? 140;
    const tickRate = config.tickRate ?? 60;
    this.multiplayerClient = config.multiplayerClient ?? null;

    this.world = new World(width, height);
    this.player = new Player(0, 0);

    this.tickSystem = new TickSystem(tickRate, this.multiplayerClient ? 40 : 10);
    this.playerSystem = new PlayerSystem();
    this.productionSystem = new ProductionSystem();
    this.combatSystem = new CombatSystem();

    const beltSystem = new BeltSystem();
    this.transportSystem = new TransportSystem(beltSystem);

    host.style.margin = "0";
    host.style.overflow = "hidden";
    host.style.position = "relative";

    this.renderer = new Renderer(host, this.world);
    this.hud = new HUD(host);
    this.containerGui = new ContainerGui(host);
    this.programmableMachineGui = new ProgrammableMachineGui(host);
    this.programmableRouterGui = new ProgrammableRouterGui(host);
    this.unloaderGui = new UnloaderGui(host);
    this.unsubscribeInventoryTransfer = this.hud.onInventoryTransfer(this.onInventoryTransfer);
    this.unsubscribeCraftRequest = this.hud.onCraftRequest(this.onCraftRequest);
    this.unsubscribeMachineGuiAction = this.hud.onMachineGuiAction(this.onMachineGuiAction);
    this.unsubscribeContainerTakeSlot = this.containerGui.onTakeSlot(this.onContainerTakeSlot);
    this.unsubscribeContainerCraftRequest = this.containerGui.onCraftRequest(this.onContainerCraftRequest);
    this.unsubscribeContainerClose = this.containerGui.onClose(this.onContainerClose);
    this.unsubscribeProgrammableMachineTakeSlot = this.programmableMachineGui.onTakeSlot(this.onProgrammableMachineTakeSlot);
    this.unsubscribeProgrammableMachineApply = this.programmableMachineGui.onApply(this.onProgrammableMachineApply);
    this.unsubscribeProgrammableMachineClose = this.programmableMachineGui.onClose(this.onProgrammableMachineClose);
    this.unsubscribeProgrammableRouterApply = this.programmableRouterGui.onApply(this.onProgrammableRouterApply);
    this.unsubscribeProgrammableRouterClose = this.programmableRouterGui.onClose(this.onProgrammableRouterClose);
    this.unsubscribeUnloaderFilterChange = this.unloaderGui.onFilterChange(this.onUnloaderFilterChange);
    this.unsubscribeUnloaderClose = this.unloaderGui.onClose(this.onUnloaderClose);
    this.mouse = new MouseInput(this.renderer.canvas, (x, y) => this.renderer.screenToGrid(x, y));
    this.miningInput = new MiningInputSystem(
      this.world,
      this.player,
      this.mouse,
      this.playerSystem,
      this.hud,
      () => this.isWorldInputEnabled(),
      undefined,
      {
        onMineResource: this.onLocalMineResourceAction,
        onPickupBuilding: this.onLocalPickupBuildingAction,
      }
    );
    this.unsubscribeMachinePointer = this.mouse.onPointer(this.handleMachinePointer);
    this.placementInput = new PlacementInputSystem(
      this.world,
      this.player,
      this.mouse,
      () => this.selectedQuickbarIndex,
      () => this.isWorldInputEnabled(),
      this.onLocalPlacementAction,
      this.onLocalMachineInsertAction
    );
    this.unsubscribeMultiplayerAction = this.multiplayerClient?.onAction(this.onReplicatedAction) ?? null;
    this.worldItemsSnapshot = this.world.countItemsOnConveyors();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    this.onResize();
    this.renderer.centerCameraOn(this.player.x, this.player.y);
    this.updateHud();
    this.renderer.setPlacementPreview(this.placementInput.getPlacementPreview());
    this.renderer.render(this.world, this.player, this.multiplayerClient?.getRemotePlayers() ?? []);
    this.multiplayerClient?.connect(this.player.x, this.player.y);
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
    this.unsubscribeProgrammableMachineTakeSlot();
    this.unsubscribeProgrammableMachineApply();
    this.unsubscribeProgrammableMachineClose();
    this.unsubscribeProgrammableRouterApply();
    this.unsubscribeProgrammableRouterClose();
    this.unsubscribeUnloaderFilterChange();
    this.unsubscribeUnloaderClose();
    this.unsubscribeMachinePointer();
    this.unsubscribeMultiplayerAction?.();
    this.miningInput.dispose();
    this.placementInput.dispose();
    this.mouse.dispose();
    this.containerGui.dispose();
    this.programmableMachineGui.dispose();
    this.programmableRouterGui.dispose();
    this.unloaderGui.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.multiplayerClient?.disconnect();
  }

  private update(deltaSeconds: number): void {
    this.productionSystem.update(this.world, deltaSeconds);
    this.transportSystem.update(this.world, deltaSeconds);
    this.world.advance(deltaSeconds);
    this.combatSystem.update(this.world, this.player, deltaSeconds);
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

  private shouldDeferMachineGuiForManualInsert(gridX: number, gridY: number, building: unknown): boolean {
    if (!isInputMachine(building)) {
      return false;
    }

    const selected = this.player.inventory.getHotbarSlot(this.selectedQuickbarIndex);
    if (!selected) {
      return false;
    }

    const inputDirection = this.getInputDirectionFromPlayer(gridX, gridY);
    return building.canAcceptInput(selected.itemId, inputDirection);
  }

  private getInputDirectionFromPlayer(gridX: number, gridY: number): "up" | "right" | "down" | "left" {
    const dx = this.getGridCellWorldX(gridX) - this.player.x;
    const dy = this.getGridCellWorldY(gridY) - this.player.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? "right" : "left";
    }
    return dy >= 0 ? "up" : "down";
  }

  private getGridCellWorldX(gridX: number): number {
    return gridX - this.world.width / 2 + 0.5;
  }

  private getGridCellWorldY(gridY: number): number {
    return this.world.height / 2 - gridY - 0.5;
  }

  private isPlayerInventorySection(section: string): section is InventorySection {
    return section === "hotbar" || section === "backpack";
  }

  private applyReplicatedAction(action: MultiplayerReplicatedAction): void {
    if (action.kind === "set_program_source") {
      const tile = this.world.getTile(action.x, action.y);
      if (!tile?.building || !isMachine(tile.building) || tile.building.machineType !== "programmable_machine") {
        return;
      }
      (tile.building as ProgrammableMachine).applyProgramSource(action.source);
      return;
    }

    if (action.kind === "set_router_program_source") {
      const tile = this.world.getTile(action.x, action.y);
      if (!tile?.building || !isConveyorNode(tile.building) || tile.building.kind !== "router") {
        return;
      }
      (tile.building as Router).applyProgramSource(action.source);
      return;
    }

    if (action.kind === "machine_insert") {
      const tile = this.world.getTile(action.x, action.y);
      if (!tile?.building || !isInputMachine(tile.building)) {
        return;
      }

      const normalizedDirection = this.normalizeDirection(action.inputDirection);
      if (!normalizedDirection || !this.isKnownItemId(action.itemId)) {
        return;
      }

      const count = Math.max(1, Math.floor(action.count || 1));
      for (let i = 0; i < count; i += 1) {
        if (!tile.building.canAcceptInput(action.itemId, normalizedDirection)) {
          break;
        }
        const accepted = tile.building.acceptInput(new Item(action.itemId), normalizedDirection);
        if (!accepted) {
          break;
        }
      }
      return;
    }

    if (action.kind === "mine_resource") {
      const amount = Math.max(1, Math.floor(action.amount || 1));
      this.world.mineResourceAt(action.x, action.y, amount);
      return;
    }

    if (action.kind === "pickup_building") {
      this.world.clearBuilding(action.x, action.y);
      return;
    }

    if (action.kind !== "place_building") {
      return;
    }

    const tile = this.world.getTile(action.x, action.y);
    if (!tile || tile.building) {
      return;
    }

    const direction = this.normalizeDirection(action.direction);
    if (!direction) {
      return;
    }

    this.applyReplicatedPlacement(action.itemId as PlaceableItemId, action.x, action.y, direction);
  }

  private applyReplicatedPlacement(itemId: PlaceableItemId, x: number, y: number, direction: "up" | "right" | "down" | "left"): void {
    switch (itemId) {
      case "belt_item":
        this.world.placeBelt(x, y, direction);
        return;
      case "router_item":
        this.world.placeRouter(x, y, direction);
        return;
      case "furnace_item":
        this.world.placeFurnace(x, y, direction);
        return;
      case "drill_item":
        this.world.placeDrill(x, y, direction);
        return;
      case "container_item":
        this.world.placeContainer(x, y);
        return;
      case "iron_chest_item":
        this.world.placeIronChest(x, y);
        return;
      case "unloader_item":
        this.world.placeUnloader(x, y, direction);
        return;
      case "turret_item":
        this.world.placeTurret(x, y, direction);
        return;
      case "programmable_machine_item":
        this.world.placeProgrammableMachine(x, y, direction);
        return;
      default:
        return;
    }
  }

  private normalizeDirection(direction: string): "up" | "right" | "down" | "left" | null {
    if (direction === "up" || direction === "right" || direction === "down" || direction === "left") {
      return direction;
    }
    return null;
  }

  private isKnownItemId(itemId: string): itemId is ItemId {
    return Object.prototype.hasOwnProperty.call(ITEM_DEFINITIONS, itemId);
  }

  private isAnyMenuOpen(): boolean {
    return (
      this.hud.isInventoryOpen() ||
      this.isMachineOverlayOpen()
    );
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
      case "KeyM":
        return "m";
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
      hostiles: this.combatSystem.getHostileCount(this.world),
      nextWaveSeconds: this.combatSystem.getNextWaveInSeconds(this.world),
    });
    this.hud.setPlayerPosition(this.player.x, this.player.y, this.player.health, this.player.maxHealth);
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
    this.hud.setCraftingRecipes(CRAFT_RECIPES.map((recipe) => {
      const category = this.getRecipeCategory(recipe);
      return {
        id: recipe.id,
        title: recipe.name,
        outputLabel: `Output: ${getItemDefinition(recipe.output.item).name} x${recipe.output.count}`,
        inputLabel: `Cost: ${this.formatRecipeCost(recipe)}`,
        craftTimeLabel: `Time: ${this.formatDurationSeconds(this.getCraftDurationSeconds(recipe))}`,
        canCraft: this.canCraft(recipe),
        categoryId: category.id,
        categoryLabel: category.label,
      };
    }));
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

  private getRecipeCategory(recipe: CraftRecipe): { id: string; label: string } {
    switch (recipe.output.item) {
      case "belt_item":
        return { id: "conveyors", label: "Conveyors" };
      case "router_item":
      case "unloader_item":
        return { id: "logistics", label: "Logistics" };
      case "programmable_machine_item":
        return { id: "logic", label: "Logic" };
      case "ammo_rounds":
      case "turret_item":
        return { id: "defense", label: "Defense" };
      case "furnace_item":
      case "drill_item":
        return { id: "production", label: "Production" };
      case "container_item":
      case "iron_chest_item":
        return { id: "storage", label: "Storage" };
      default:
        return { id: "other", label: "Other" };
    }
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
    if (!target || (target.machineType !== "container" && target.machineType !== "iron_chest")) {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (
      !tile?.building ||
      !isMachine(tile.building) ||
      (tile.building.machineType !== "container" && tile.building.machineType !== "iron_chest")
    ) {
      return null;
    }
    return tile.building as Container;
  }

  private getOpenUnloader(): Unloader | null {
    const target = this.openMachineGuiTarget;
    if (!target || target.machineType !== "unloader") {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (!tile?.building || !isMachine(tile.building) || tile.building.machineType !== "unloader") {
      return null;
    }
    return tile.building as Unloader;
  }

  private getOpenRouter(): Router | null {
    const target = this.openMachineGuiTarget;
    if (!target || target.machineType !== "router") {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (!tile?.building || !isConveyorNode(tile.building) || tile.building.kind !== "router") {
      return null;
    }
    return tile.building as Router;
  }

  private getOpenProgrammableMachine(): ProgrammableMachine | null {
    const target = this.openMachineGuiTarget;
    if (!target || target.machineType !== "programmable_machine") {
      return null;
    }
    const tile = this.world.getTile(target.x, target.y);
    if (!tile?.building || !isMachine(tile.building) || tile.building.machineType !== "programmable_machine") {
      return null;
    }
    return tile.building as ProgrammableMachine;
  }

  private syncMachineGui(): void {
    const target = this.openMachineGuiTarget;
    if (!target) {
      this.hud.setFurnaceGui(null);
      this.hud.setDrillGui(null);
      this.containerGui.setView(null);
      this.programmableMachineGui.setView(null);
      this.programmableRouterGui.setView(null);
      this.unloaderGui.setView(null);
      return;
    }

    if (target.machineType === "router") {
      const router = this.getOpenRouter();
      if (!router) {
        this.closeMachineGui();
        return;
      }

      const state = router.debugState;
      this.hud.setFurnaceGui(null);
      this.hud.setDrillGui(null);
      this.containerGui.setView(null);
      this.programmableMachineGui.setView(null);
      this.unloaderGui.setView(null);
      this.programmableRouterGui.setView({
        gridX: target.x,
        gridY: target.y,
        direction: state.direction,
        storedItem: state.storedItem,
        storedProgress: state.storedProgress,
        inputSide: state.inputSide,
        programSource: state.programSource,
        programVersion: state.programVersion,
        activeProgramVersion: state.activeProgramVersion,
        compileError: state.compileError,
        runtimeError: state.runtimeError,
        statusText: state.statusText,
        lastDecisionItem: state.lastDecisionItem,
        lastDecisionInputSide: state.lastDecisionInputSide,
        lastDecisionOutputs: state.lastDecisionOutputs,
      });
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
      this.programmableMachineGui.setView(null);
      this.programmableRouterGui.setView(null);
      this.unloaderGui.setView(null);
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
      this.programmableMachineGui.setView(null);
      this.programmableRouterGui.setView(null);
      this.unloaderGui.setView(null);
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

    if (target.machineType === "container" || target.machineType === "iron_chest") {
      const container = this.getOpenContainer();
      if (!container) {
        this.closeMachineGui();
        return;
      }

      const state = container.debugState;
      this.hud.setFurnaceGui(null);
      this.hud.setDrillGui(null);
      this.programmableMachineGui.setView(null);
      this.programmableRouterGui.setView(null);
      this.unloaderGui.setView(null);
      this.containerGui.setView({
        title: target.machineType === "iron_chest" ? "Iron Chest" : "Container",
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
      return;
    }

    if (target.machineType === "programmable_machine") {
      const machine = this.getOpenProgrammableMachine();
      if (!machine) {
        this.closeMachineGui();
        return;
      }

      const state = machine.debugState;
      this.hud.setFurnaceGui(null);
      this.hud.setDrillGui(null);
      this.containerGui.setView(null);
      this.programmableRouterGui.setView(null);
      this.unloaderGui.setView(null);
      this.programmableMachineGui.setView({
        gridX: target.x,
        gridY: target.y,
        outputDirection: state.outputDirection,
        inputSlots: state.inputSlots,
        inputTotalCount: state.inputTotalCount,
        inputCapacity: state.inputCapacity,
        outputSlots: state.outputSlots,
        outputCount: state.outputCount,
        outputCapacity: state.outputCapacity,
        programSource: state.programSource,
        programVersion: state.programVersion,
        activeProgramVersion: state.activeProgramVersion,
        compileError: state.compileError,
        runtimeError: state.runtimeError,
        statusText: state.statusText,
      });
      return;
    }

    const unloader = this.getOpenUnloader();
    if (!unloader) {
      this.closeMachineGui();
      return;
    }

    const state = unloader.debugState;
    this.hud.setFurnaceGui(null);
    this.hud.setDrillGui(null);
    this.containerGui.setView(null);
    this.programmableMachineGui.setView(null);
    this.programmableRouterGui.setView(null);
    this.unloaderGui.setView({
      gridX: target.x,
      gridY: target.y,
      filters: state.filters,
      sourceConnected: state.sourceConnected,
      outputBufferCount: state.outputBufferCount,
      outputBufferCapacity: state.outputBufferCapacity,
      cycleSeconds: state.cycleSeconds,
    });
  }

  private closeMachineGui(): void {
    this.openMachineGuiTarget = null;
    this.hud.setFurnaceGui(null);
    this.hud.setDrillGui(null);
    this.containerGui.setView(null);
    this.programmableMachineGui.setView(null);
    this.programmableRouterGui.setView(null);
    this.unloaderGui.setView(null);
  }

  private isMachineOverlayOpen(): boolean {
    return (
      this.hud.isMachineGuiOpen() ||
      this.containerGui.isOpen() ||
      this.programmableMachineGui.isOpen() ||
      this.programmableRouterGui.isOpen() ||
      this.unloaderGui.isOpen()
    );
  }

  private isTextInputFocused(): boolean {
    const activeElement = document.activeElement;
    if (!activeElement) {
      return false;
    }
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      ((activeElement as HTMLElement).isContentEditable ?? false)
    );
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
