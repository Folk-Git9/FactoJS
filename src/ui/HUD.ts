import type { GridPosition } from "../core/types";
import { ITEM_DEFINITIONS, getItemDefinition, type ItemId } from "../data/items";
import {
  BACKPACK_SLOT_COUNT,
  HOTBAR_SLOT_COUNT,
  type InventorySection,
  type InventorySlotStack,
  type PlayerInventoryView,
} from "../entities/PlayerInventory";

export interface HudStats {
  fps: number;
  tick: number;
  worldItems: number;
}

export interface InventoryTransferRequest {
  fromSection: InventoryUiSection;
  fromIndex: number;
  toSection: InventoryUiSection;
  toIndex: number;
  amount?: number;
  itemId?: ItemId;
}

export interface CraftRecipeView {
  id: string;
  title: string;
  outputLabel: string;
  inputLabel: string;
  craftTimeLabel: string;
  canCraft: boolean;
  categoryId?: string;
  categoryLabel?: string;
}

export interface CraftingStatusView {
  recipeTitle: string | null;
  progress01: number | null;
  remainingSeconds: number | null;
  queuedCount: number;
}

export interface FurnaceGuiView {
  gridX: number;
  gridY: number;
  oreCount: number;
  oreCapacity: number;
  fuelCount: number;
  fuelCapacity: number;
  outputCount: number;
  outputCapacity: number;
  progress01: number;
}

export interface DrillGuiView {
  gridX: number;
  gridY: number;
  resourceType: ItemId | null;
  fuelCount: number;
  fuelCapacity: number;
  outputCount: number;
  outputCapacity: number;
  progress01: number;
}

export type MachineTransferMode = "all" | "half" | "single";

export interface MachineGuiActionRequest {
  action: "insert_ore" | "take_ore" | "insert_fuel" | "take_fuel" | "take_output" | "close";
  mode: MachineTransferMode;
}

type InventoryTransferListener = (request: InventoryTransferRequest) => void;
type CraftRequestListener = (recipeId: string) => void;
type MachineGuiActionListener = (request: MachineGuiActionRequest) => void;

interface InventorySlotView {
  root: HTMLDivElement;
  swatch: HTMLDivElement;
  name: HTMLDivElement;
  count: HTMLDivElement;
}

interface CraftRecipeRowView {
  root: HTMLDivElement;
  title: HTMLDivElement;
  details: HTMLDivElement;
  button: HTMLButtonElement;
}

interface CraftCategoryView {
  id: string;
  label: string;
}

const CRAFT_RECIPES_PER_PAGE = 5;
const CREATIVE_STACK_AMOUNT = 100;

type InventoryUiSection = InventorySection | "creative" | "trash";

interface MachineSlotView {
  root: HTMLButtonElement;
  label: HTMLDivElement;
  swatch: HTMLDivElement;
  name: HTMLDivElement;
  count: HTMLDivElement;
}

export class HUD {
  private readonly root: HTMLDivElement;
  private readonly modeLine: HTMLDivElement;
  private readonly playerLine: HTMLDivElement;
  private readonly cellLine: HTMLDivElement;
  private readonly statsLine: HTMLDivElement;
  private readonly resourceLine: HTMLDivElement;
  private readonly miningLine: HTMLDivElement;
  private readonly miningBarTrack: HTMLDivElement;
  private readonly miningBarFill: HTMLDivElement;
  private readonly craftingLine: HTMLDivElement;
  private readonly craftingBarTrack: HTMLDivElement;
  private readonly craftingBarFill: HTMLDivElement;
  private readonly activityRoot: HTMLDivElement;
  private readonly miningActivityBlock: HTMLDivElement;
  private readonly craftingActivityBlock: HTMLDivElement;
  // private readonly controlsLine: HTMLDivElement;

  private readonly quickbarRoot: HTMLDivElement;
  private readonly quickbarTitle: HTMLDivElement;
  private readonly quickbarSlots: InventorySlotView[] = [];

  private readonly inventoryOverlay: HTMLDivElement;
  private readonly inventoryHeaderTitle: HTMLDivElement;
  private readonly inventoryHeaderHint: HTMLDivElement;
  private readonly inventoryHotbarTitle: HTMLDivElement;
  private readonly inventoryBackpackTitle: HTMLDivElement;
  private readonly inventorySelectionLine: HTMLDivElement;
  private readonly creativePanel: HTMLDivElement;
  private readonly creativeTitle: HTMLDivElement;
  private readonly trashSlot: InventorySlotView;
  private readonly craftCategoriesRoot: HTMLDivElement;
  private readonly craftRecipesRoot: HTMLDivElement;
  private readonly craftPaginationRoot: HTMLDivElement;
  private readonly craftPrevButton: HTMLButtonElement;
  private readonly craftPageLine: HTMLDivElement;
  private readonly craftNextButton: HTMLButtonElement;
  private readonly machineOverlay: HTMLDivElement;
  private readonly machineTitle: HTMLDivElement;
  private readonly machinePositionLine: HTMLDivElement;
  private readonly machineOreSlot: MachineSlotView;
  private readonly machineFuelSlot: MachineSlotView;
  private readonly machineOutputSlot: MachineSlotView;
  private readonly machineProgressLine: HTMLDivElement;
  private readonly machineProgressTrack: HTMLDivElement;
  private readonly machineProgressFill: HTMLDivElement;
  private readonly machineCloseButton: HTMLButtonElement;
  private readonly inventoryHotbarSlots: InventorySlotView[] = [];
  private readonly inventoryBackpackSlots: InventorySlotView[] = [];
  private readonly creativeSlots: InventorySlotView[] = [];
  private readonly creativeItems: ItemId[];

  private readonly inventoryTransferListeners: InventoryTransferListener[] = [];
  private readonly craftRequestListeners: CraftRequestListener[] = [];
  private readonly machineGuiActionListeners: MachineGuiActionListener[] = [];
  private readonly craftRows = new Map<string, CraftRecipeRowView>();
  private readonly craftCategoryButtons = new Map<string, HTMLButtonElement>();
  private readonly craftPageByCategory = new Map<string, number>();
  private readonly craftRecipeMap = new Map<string, CraftRecipeView>();
  private visibleCraftRecipeIds: string[] = [];
  private craftCategoryOrder: CraftCategoryView[] = [];
  private selectedCraftCategoryId: string | null = null;
  private miningActivityVisible = false;
  private craftingActivityVisible = false;

  private dragSourceSlot: { section: InventoryUiSection; index: number } | null = null;
  private dragTargetSlot: { section: InventoryUiSection; index: number } | null = null;
  private dragAmount: number | null = null;
  private pendingDragModifiers: {
    section: InventoryUiSection;
    index: number;
    shiftKey: boolean;
    ctrlKey: boolean;
  } | null = null;
  private isShiftHeld = false;
  private isCtrlHeld = false;
  private selectedQuickbarIndex = 0;
  private inventoryOpen = false;
  private creativeMenuOpen = false;
  private machineGuiOpen = false;
  private machineGuiView: FurnaceGuiView | DrillGuiView | null = null;
  private readonly onWindowResize = (): void => {
    this.updateActivityAnchor();
  };
  private readonly onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Shift") {
      this.isShiftHeld = true;
    }
    if (event.key === "Control") {
      this.isCtrlHeld = true;
    }
  };
  private readonly onWindowKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Shift") {
      this.isShiftHeld = false;
    }
    if (event.key === "Control") {
      this.isCtrlHeld = false;
    }
  };

  private lastInventoryView: PlayerInventoryView = {
    hotbar: Array.from({ length: HOTBAR_SLOT_COUNT }, () => null),
    backpack: Array.from({ length: BACKPACK_SLOT_COUNT }, () => null),
    totalCount: 0,
  };

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.style.position = "fixed";
    this.root.style.left = "12px";
    this.root.style.top = "12px";
    this.root.style.padding = "10px 12px";
    this.root.style.border = "1px solid #3a4758";
    this.root.style.borderRadius = "8px";
    this.root.style.background = "rgba(13, 17, 23, 0.86)";
    this.root.style.color = "#dce7f3";
    this.root.style.font = "12px/1.5 monospace";
    this.root.style.pointerEvents = "none";
    this.root.style.minWidth = "300px";
    this.root.style.backdropFilter = "blur(2px)";

    this.modeLine = document.createElement("div");
    this.playerLine = document.createElement("div");
    this.cellLine = document.createElement("div");
    this.statsLine = document.createElement("div");
    this.resourceLine = document.createElement("div");
    this.miningLine = document.createElement("div");
    this.miningBarTrack = document.createElement("div");
    this.miningBarFill = document.createElement("div");
    this.craftingLine = document.createElement("div");
    this.craftingBarTrack = document.createElement("div");
    this.craftingBarFill = document.createElement("div");
    // this.controlsLine = document.createElement("div");
    // this.controlsLine.style.marginTop = "8px";
    // this.controlsLine.style.color = "#a6b4c4";
    // this.controlsLine.textContent =
    //   "WASD move, hold RMB mine/pick building, LMB place/insert, R rotate build, 1-0 select slot, F collect, Q/E or wheel zoom, TAB inventory";

    this.modeLine.textContent = "Mode: Mining";
    this.resourceLine.textContent = "Resource: -";
    this.miningLine.textContent = "Mining: -";
    this.miningBarTrack.style.height = "6px";
    this.miningBarTrack.style.marginTop = "4px";
    this.miningBarTrack.style.borderRadius = "999px";
    this.miningBarTrack.style.background = "rgba(58, 71, 88, 0.7)";
    this.miningBarTrack.style.overflow = "hidden";
    this.miningBarFill.style.width = "0%";
    this.miningBarFill.style.height = "100%";
    this.miningBarFill.style.background = "linear-gradient(90deg, #4aa3ff, #5bd4ff)";
    this.miningBarTrack.appendChild(this.miningBarFill);

    this.craftingLine.textContent = "Crafting: -";
    this.craftingBarTrack.style.height = "6px";
    this.craftingBarTrack.style.marginTop = "4px";
    this.craftingBarTrack.style.borderRadius = "999px";
    this.craftingBarTrack.style.background = "rgba(58, 71, 88, 0.7)";
    this.craftingBarTrack.style.overflow = "hidden";
    this.craftingBarFill.style.width = "0%";
    this.craftingBarFill.style.height = "100%";
    this.craftingBarFill.style.background = "linear-gradient(90deg, #f5a524, #ffd37a)";
    this.craftingBarTrack.appendChild(this.craftingBarFill);

    this.root.append(
      this.modeLine,
      this.playerLine,
      this.cellLine,
      this.statsLine,
      this.resourceLine,
      // this.controlsLine
    );
    parent.appendChild(this.root);

    this.quickbarRoot = document.createElement("div");
    this.quickbarRoot.style.position = "fixed";
    this.quickbarRoot.style.left = "50%";
    this.quickbarRoot.style.bottom = "12px";
    this.quickbarRoot.style.transform = "translateX(-50%)";
    this.quickbarRoot.style.display = "flex";
    this.quickbarRoot.style.flexDirection = "column";
    this.quickbarRoot.style.alignItems = "center";
    this.quickbarRoot.style.gap = "8px";
    this.quickbarRoot.style.padding = "10px 12px";
    this.quickbarRoot.style.border = "1px solid #3a4758";
    this.quickbarRoot.style.borderRadius = "10px";
    this.quickbarRoot.style.background = "rgba(13, 17, 23, 0.9)";
    this.quickbarRoot.style.pointerEvents = "none";
    this.quickbarRoot.style.backdropFilter = "blur(2px)";
    this.quickbarRoot.style.maxWidth = "calc(100vw - 16px)";

    this.quickbarTitle = document.createElement("div");
    this.quickbarTitle.style.color = "#c8d7e6";
    this.quickbarTitle.style.font = "12px/1.3 monospace";
    this.quickbarTitle.textContent = "Quickbar (0)";
    this.quickbarRoot.appendChild(this.quickbarTitle);

    const quickbarRow = document.createElement("div");
    quickbarRow.style.display = "flex";
    quickbarRow.style.justifyContent = "center";
    quickbarRow.style.flexWrap = "wrap";
    quickbarRow.style.gap = "6px";
    this.quickbarRoot.appendChild(quickbarRow);

    for (let i = 0; i < HOTBAR_SLOT_COUNT; i += 1) {
      const slot = this.createSlotView(62, i + 1, false);
      quickbarRow.appendChild(slot.root);
      this.quickbarSlots.push(slot);
    }

    parent.appendChild(this.quickbarRoot);

    this.activityRoot = document.createElement("div");
    this.activityRoot.style.position = "fixed";
    this.activityRoot.style.left = "50%";
    this.activityRoot.style.transform = "translateX(-50%)";
    this.activityRoot.style.display = "none";
    this.activityRoot.style.flexDirection = "column";
    this.activityRoot.style.gap = "6px";
    this.activityRoot.style.padding = "8px 10px";
    this.activityRoot.style.border = "1px solid #3a4758";
    this.activityRoot.style.borderRadius = "10px";
    this.activityRoot.style.background = "rgba(13, 17, 23, 0.9)";
    this.activityRoot.style.color = "#dce7f3";
    this.activityRoot.style.font = "12px/1.5 monospace";
    this.activityRoot.style.pointerEvents = "none";
    this.activityRoot.style.backdropFilter = "blur(2px)";
    this.activityRoot.style.minWidth = "300px";
    this.activityRoot.style.maxWidth = "calc(100vw - 16px)";
    this.activityRoot.style.zIndex = "12";

    this.miningActivityBlock = document.createElement("div");
    this.miningActivityBlock.style.display = "none";
    this.miningActivityBlock.style.flexDirection = "column";
    this.miningActivityBlock.style.gap = "4px";
    this.miningActivityBlock.append(this.miningLine, this.miningBarTrack);
    this.activityRoot.appendChild(this.miningActivityBlock);

    this.craftingActivityBlock = document.createElement("div");
    this.craftingActivityBlock.style.display = "none";
    this.craftingActivityBlock.style.flexDirection = "column";
    this.craftingActivityBlock.style.gap = "4px";
    this.craftingActivityBlock.append(this.craftingLine, this.craftingBarTrack);
    this.activityRoot.appendChild(this.craftingActivityBlock);

    parent.appendChild(this.activityRoot);
    this.updateActivityVisibility();
    this.updateActivityAnchor();
    window.addEventListener("resize", this.onWindowResize);
    window.addEventListener("keydown", this.onWindowKeyDown);
    window.addEventListener("keyup", this.onWindowKeyUp);

    this.inventoryOverlay = document.createElement("div");
    this.inventoryOverlay.style.position = "fixed";
    this.inventoryOverlay.style.inset = "0";
    this.inventoryOverlay.style.display = "none";
    this.inventoryOverlay.style.alignItems = "center";
    this.inventoryOverlay.style.justifyContent = "center";
    this.inventoryOverlay.style.background = "rgba(3, 8, 13, 0.44)";
    this.inventoryOverlay.style.pointerEvents = "auto";
    this.inventoryOverlay.style.zIndex = "20";

    const inventoryWindow = document.createElement("div");
    inventoryWindow.style.display = "flex";
    inventoryWindow.style.flexDirection = "column";
    inventoryWindow.style.gap = "14px";
    inventoryWindow.style.width = "min(1020px, calc(100vw - 28px))";
    inventoryWindow.style.maxHeight = "calc(100vh - 32px)";
    inventoryWindow.style.padding = "14px";
    inventoryWindow.style.boxSizing = "border-box";
    inventoryWindow.style.borderRadius = "12px";
    inventoryWindow.style.border = "1px solid #3a4758";
    inventoryWindow.style.background = "rgba(8, 13, 20, 0.96)";
    inventoryWindow.style.color = "#dce7f3";
    inventoryWindow.style.font = "12px/1.4 monospace";
    inventoryWindow.style.backdropFilter = "blur(2px)";
    inventoryWindow.style.overflow = "auto";
    this.inventoryOverlay.appendChild(inventoryWindow);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.paddingBottom = "8px";
    header.style.borderBottom = "1px solid #273646";

    this.inventoryHeaderTitle = document.createElement("div");
    this.inventoryHeaderTitle.style.font = "14px/1.2 monospace";
    this.inventoryHeaderTitle.style.color = "#e4edf7";
    this.inventoryHeaderTitle.textContent = "Inventory";

    this.inventoryHeaderHint = document.createElement("div");
    this.inventoryHeaderHint.style.color = "#9ab0c6";
    this.inventoryHeaderHint.textContent = "Drag stacks; Shift+LMB half, Ctrl+LMB one";

    header.append(this.inventoryHeaderTitle, this.inventoryHeaderHint);
    inventoryWindow.appendChild(header);

    this.inventorySelectionLine = document.createElement("div");
    this.inventorySelectionLine.style.color = "#8da4bb";
    this.inventorySelectionLine.style.marginTop = "-4px";
    this.inventorySelectionLine.textContent = "Drag: -";
    inventoryWindow.appendChild(this.inventorySelectionLine);

    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.gap = "14px";
    content.style.alignItems = "stretch";
    content.style.minHeight = "340px";
    inventoryWindow.appendChild(content);

    const leftPanel = document.createElement("div");
    leftPanel.style.display = "flex";
    leftPanel.style.flexDirection = "column";
    leftPanel.style.gap = "12px";
    leftPanel.style.flex = "1 1 auto";
    content.appendChild(leftPanel);
    this.creativeItems = Object.keys(ITEM_DEFINITIONS) as ItemId[];

    const hotbarBlock = document.createElement("div");
    hotbarBlock.style.border = "1px solid #2b3a4c";
    hotbarBlock.style.borderRadius = "10px";
    hotbarBlock.style.padding = "10px";
    hotbarBlock.style.background = "rgba(15, 21, 31, 0.8)";
    leftPanel.appendChild(hotbarBlock);

    this.inventoryHotbarTitle = document.createElement("div");
    this.inventoryHotbarTitle.style.color = "#c8d7e6";
    this.inventoryHotbarTitle.style.marginBottom = "8px";
    this.inventoryHotbarTitle.textContent = "Quickbar (0)";
    hotbarBlock.appendChild(this.inventoryHotbarTitle);

    const hotbarGrid = document.createElement("div");
    hotbarGrid.style.display = "grid";
    hotbarGrid.style.gridTemplateColumns = "repeat(10, 54px)";
    hotbarGrid.style.gap = "6px";
    hotbarGrid.style.maxWidth = "100%";
    hotbarGrid.style.overflowX = "auto";
    hotbarBlock.appendChild(hotbarGrid);

    for (let i = 0; i < HOTBAR_SLOT_COUNT; i += 1) {
      const slot = this.createSlotView(54, i + 1, true);
      this.registerInventoryDragSlot(slot, "hotbar", i);
      hotbarGrid.appendChild(slot.root);
      this.inventoryHotbarSlots.push(slot);
    }

    const backpackBlock = document.createElement("div");
    backpackBlock.style.border = "1px solid #2b3a4c";
    backpackBlock.style.borderRadius = "10px";
    backpackBlock.style.padding = "10px";
    backpackBlock.style.background = "rgba(15, 21, 31, 0.8)";
    leftPanel.appendChild(backpackBlock);

    this.inventoryBackpackTitle = document.createElement("div");
    this.inventoryBackpackTitle.style.color = "#c8d7e6";
    this.inventoryBackpackTitle.style.marginBottom = "8px";
    this.inventoryBackpackTitle.textContent = "Backpack (0)";
    backpackBlock.appendChild(this.inventoryBackpackTitle);

    const backpackGrid = document.createElement("div");
    backpackGrid.style.display = "grid";
    backpackGrid.style.gridTemplateColumns = "repeat(8, minmax(54px, 1fr))";
    backpackGrid.style.gap = "6px";
    backpackBlock.appendChild(backpackGrid);

    for (let i = 0; i < BACKPACK_SLOT_COUNT; i += 1) {
      const slot = this.createSlotView(54, i + 1, true);
      this.registerInventoryDragSlot(slot, "backpack", i);
      backpackGrid.appendChild(slot.root);
      this.inventoryBackpackSlots.push(slot);
    }

    const trashBlock = document.createElement("div");
    trashBlock.style.border = "1px solid #4d3131";
    trashBlock.style.borderRadius = "10px";
    trashBlock.style.padding = "10px";
    trashBlock.style.background = "rgba(35, 18, 18, 0.68)";
    leftPanel.appendChild(trashBlock);

    const trashTitle = document.createElement("div");
    trashTitle.style.color = "#f4b7b7";
    trashTitle.style.marginBottom = "8px";
    trashTitle.textContent = "Trash";
    trashBlock.appendChild(trashTitle);

    this.trashSlot = this.createSlotView(62, 1, false);
    this.trashSlot.root.dataset.inventorySlot = "1";
    this.trashSlot.root.dataset.inventorySection = "trash";
    this.trashSlot.root.dataset.inventoryIndex = "0";
    this.trashSlot.root.style.cursor = "not-allowed";
    this.trashSlot.root.style.borderColor = "#a04f4f";
    this.trashSlot.root.style.background = "rgba(56, 25, 25, 0.92)";
    this.trashSlot.swatch.style.display = "block";
    this.trashSlot.swatch.style.background = "#d96a6a";
    this.trashSlot.name.textContent = "Drop Here";
    this.trashSlot.count.textContent = "Delete";
    trashBlock.appendChild(this.trashSlot.root);

    this.creativePanel = document.createElement("div");
    this.creativePanel.style.flex = "0 0 280px";
    this.creativePanel.style.display = "none";
    this.creativePanel.style.flexDirection = "column";
    this.creativePanel.style.border = "1px solid #2b3a4c";
    this.creativePanel.style.borderRadius = "10px";
    this.creativePanel.style.padding = "10px";
    this.creativePanel.style.background = "rgba(16, 29, 44, 0.86)";
    content.appendChild(this.creativePanel);

    this.creativeTitle = document.createElement("div");
    this.creativeTitle.style.color = "#e7f0fa";
    this.creativeTitle.style.font = "13px/1.2 monospace";
    this.creativeTitle.style.marginBottom = "8px";
    this.creativeTitle.textContent = "Creative Supply";
    this.creativePanel.appendChild(this.creativeTitle);

    const creativeHint = document.createElement("div");
    creativeHint.style.color = "#9bb0c5";
    creativeHint.style.marginBottom = "8px";
    creativeHint.textContent = "Drag to inventory: Ctrl=1, Shift=half, no modifier=stack";
    this.creativePanel.appendChild(creativeHint);

    const creativeGrid = document.createElement("div");
    creativeGrid.style.display = "grid";
    creativeGrid.style.gridTemplateColumns = "repeat(4, minmax(54px, 1fr))";
    creativeGrid.style.gap = "6px";
    this.creativePanel.appendChild(creativeGrid);

    for (let i = 0; i < this.creativeItems.length; i += 1) {
      const itemId = this.creativeItems[i];
      const slot = this.createSlotView(54, i + 1, true);
      this.renderCreativeSlot(slot, itemId);
      this.registerInventoryDragSlot(slot, "creative", i);
      creativeGrid.appendChild(slot.root);
      this.creativeSlots.push(slot);
    }

    const craftPanel = document.createElement("div");
    craftPanel.style.flex = "0 0 280px";
    craftPanel.style.display = "flex";
    craftPanel.style.flexDirection = "column";
    craftPanel.style.border = "1px solid #2b3a4c";
    craftPanel.style.borderRadius = "10px";
    craftPanel.style.padding = "10px";
    craftPanel.style.background = "rgba(15, 21, 31, 0.85)";
    content.appendChild(craftPanel);

    const craftTitle = document.createElement("div");
    craftTitle.style.color = "#e7f0fa";
    craftTitle.style.font = "13px/1.2 monospace";
    craftTitle.style.marginBottom = "8px";
    craftTitle.textContent = "Crafting";
    craftPanel.appendChild(craftTitle);

    const craftHint = document.createElement("div");
    craftHint.style.color = "#9bb0c5";
    craftHint.style.marginBottom = "8px";
    craftHint.textContent = "Sections + pages. Crafts are queued.";
    craftPanel.appendChild(craftHint);

    this.craftCategoriesRoot = document.createElement("div");
    this.craftCategoriesRoot.style.display = "flex";
    this.craftCategoriesRoot.style.flexWrap = "wrap";
    this.craftCategoriesRoot.style.gap = "6px";
    this.craftCategoriesRoot.style.marginBottom = "8px";
    craftPanel.appendChild(this.craftCategoriesRoot);

    this.craftRecipesRoot = document.createElement("div");
    this.craftRecipesRoot.style.display = "flex";
    this.craftRecipesRoot.style.flexDirection = "column";
    this.craftRecipesRoot.style.gap = "8px";
    craftPanel.appendChild(this.craftRecipesRoot);

    this.craftPaginationRoot = document.createElement("div");
    this.craftPaginationRoot.style.display = "flex";
    this.craftPaginationRoot.style.alignItems = "center";
    this.craftPaginationRoot.style.justifyContent = "space-between";
    this.craftPaginationRoot.style.gap = "8px";
    this.craftPaginationRoot.style.marginTop = "8px";
    craftPanel.appendChild(this.craftPaginationRoot);

    this.craftPrevButton = document.createElement("button");
    this.craftPrevButton.type = "button";
    this.craftPrevButton.style.border = "1px solid #3f5062";
    this.craftPrevButton.style.borderRadius = "6px";
    this.craftPrevButton.style.background = "#1b2735";
    this.craftPrevButton.style.color = "#dce8f5";
    this.craftPrevButton.style.font = "11px/1.2 monospace";
    this.craftPrevButton.style.padding = "4px 8px";
    this.craftPrevButton.style.cursor = "pointer";
    this.craftPrevButton.textContent = "Prev";
    this.craftPrevButton.addEventListener("click", () => {
      if (!this.selectedCraftCategoryId) {
        return;
      }
      const current = this.craftPageByCategory.get(this.selectedCraftCategoryId) ?? 0;
      this.craftPageByCategory.set(this.selectedCraftCategoryId, Math.max(0, current - 1));
      this.renderCraftRecipes();
    });
    this.craftPaginationRoot.appendChild(this.craftPrevButton);

    this.craftPageLine = document.createElement("div");
    this.craftPageLine.style.color = "#9bb0c5";
    this.craftPageLine.style.font = "11px/1.2 monospace";
    this.craftPageLine.textContent = "Page 1 / 1";
    this.craftPaginationRoot.appendChild(this.craftPageLine);

    this.craftNextButton = document.createElement("button");
    this.craftNextButton.type = "button";
    this.craftNextButton.style.border = "1px solid #3f5062";
    this.craftNextButton.style.borderRadius = "6px";
    this.craftNextButton.style.background = "#1b2735";
    this.craftNextButton.style.color = "#dce8f5";
    this.craftNextButton.style.font = "11px/1.2 monospace";
    this.craftNextButton.style.padding = "4px 8px";
    this.craftNextButton.style.cursor = "pointer";
    this.craftNextButton.textContent = "Next";
    this.craftNextButton.addEventListener("click", () => {
      if (!this.selectedCraftCategoryId) {
        return;
      }
      const current = this.craftPageByCategory.get(this.selectedCraftCategoryId) ?? 0;
      this.craftPageByCategory.set(this.selectedCraftCategoryId, current + 1);
      this.renderCraftRecipes();
    });
    this.craftPaginationRoot.appendChild(this.craftNextButton);

    this.inventoryOverlay.addEventListener("click", (event) => {
      if (event.target === this.inventoryOverlay) {
        this.clearDragState();
      }
    });
    this.inventoryOverlay.addEventListener("dragover", this.handleInventoryOverlayDragOver);
    this.inventoryOverlay.addEventListener("drop", this.handleInventoryOverlayDrop);

    parent.appendChild(this.inventoryOverlay);

    this.machineOverlay = document.createElement("div");
    this.machineOverlay.style.position = "fixed";
    this.machineOverlay.style.inset = "0";
    this.machineOverlay.style.display = "none";
    this.machineOverlay.style.alignItems = "center";
    this.machineOverlay.style.justifyContent = "center";
    this.machineOverlay.style.background = "rgba(3, 8, 13, 0.36)";
    this.machineOverlay.style.pointerEvents = "auto";
    this.machineOverlay.style.zIndex = "19";

    const machineWindow = document.createElement("div");
    machineWindow.style.display = "flex";
    machineWindow.style.flexDirection = "column";
    machineWindow.style.gap = "10px";
    machineWindow.style.width = "min(440px, calc(100vw - 24px))";
    machineWindow.style.padding = "12px";
    machineWindow.style.boxSizing = "border-box";
    machineWindow.style.borderRadius = "12px";
    machineWindow.style.border = "1px solid #3a4758";
    machineWindow.style.background = "rgba(8, 13, 20, 0.97)";
    machineWindow.style.color = "#dce7f3";
    machineWindow.style.font = "12px/1.4 monospace";
    this.machineOverlay.appendChild(machineWindow);

    const machineHeader = document.createElement("div");
    machineHeader.style.display = "flex";
    machineHeader.style.justifyContent = "space-between";
    machineHeader.style.alignItems = "center";
    machineHeader.style.gap = "8px";
    machineHeader.style.paddingBottom = "8px";
    machineHeader.style.borderBottom = "1px solid #273646";
    machineWindow.appendChild(machineHeader);

    this.machineTitle = document.createElement("div");
    this.machineTitle.style.font = "14px/1.2 monospace";
    this.machineTitle.style.color = "#e4edf7";
    this.machineTitle.textContent = "Machine";
    machineHeader.appendChild(this.machineTitle);

    this.machineCloseButton = document.createElement("button");
    this.machineCloseButton.type = "button";
    this.machineCloseButton.style.border = "1px solid #3f5062";
    this.machineCloseButton.style.borderRadius = "6px";
    this.machineCloseButton.style.background = "#1b2735";
    this.machineCloseButton.style.color = "#dce8f5";
    this.machineCloseButton.style.font = "11px/1.2 monospace";
    this.machineCloseButton.style.padding = "4px 8px";
    this.machineCloseButton.style.cursor = "pointer";
    this.machineCloseButton.textContent = "Close";
    this.machineCloseButton.addEventListener("click", () => this.emitMachineGuiAction({ action: "close", mode: "all" }));
    machineHeader.appendChild(this.machineCloseButton);

    this.machinePositionLine = document.createElement("div");
    this.machinePositionLine.style.color = "#9cb0c4";
    this.machinePositionLine.textContent = "Cell: -";
    machineWindow.appendChild(this.machinePositionLine);

    const machineSlotsRow = document.createElement("div");
    machineSlotsRow.style.display = "grid";
    machineSlotsRow.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
    machineSlotsRow.style.gap = "8px";
    machineWindow.appendChild(machineSlotsRow);

    const makeMachineSlot = (labelText: string, itemId: ItemId): MachineSlotView => {
      const definition = getItemDefinition(itemId);
      const itemColor = this.toCssColor(definition.color);

      const root = document.createElement("button");
      root.type = "button";
      root.style.border = "1px solid #3a4758";
      root.style.borderRadius = "8px";
      root.style.background = "rgba(11, 16, 24, 0.86)";
      root.style.display = "flex";
      root.style.flexDirection = "column";
      root.style.justifyContent = "space-between";
      root.style.alignItems = "stretch";
      root.style.gap = "6px";
      root.style.padding = "8px";
      root.style.minHeight = "92px";
      root.style.cursor = "pointer";
      root.style.color = "#dce8f5";
      root.style.font = "12px/1.3 monospace";
      root.style.textAlign = "left";

      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.alignItems = "center";
      top.style.justifyContent = "space-between";
      top.style.gap = "8px";
      root.appendChild(top);

      const label = document.createElement("div");
      label.style.color = "#95abc1";
      label.style.font = "10px/1.1 monospace";
      label.textContent = labelText;
      top.appendChild(label);

      const swatch = document.createElement("div");
      swatch.style.width = "11px";
      swatch.style.height = "11px";
      swatch.style.borderRadius = "50%";
      swatch.style.background = itemColor;
      swatch.style.flex = "0 0 auto";
      top.appendChild(swatch);

      const name = document.createElement("div");
      name.style.color = "#dce8f5";
      name.style.font = "11px/1.2 monospace";
      name.style.wordBreak = "break-word";
      name.textContent = definition.name;
      root.appendChild(name);

      const count = document.createElement("div");
      count.style.color = "#b9cce0";
      count.style.font = "12px/1.2 monospace";
      count.style.textAlign = "right";
      count.textContent = "0 / 0";
      root.appendChild(count);

      return {
        root,
        label,
        swatch,
        name,
        count,
      };
    };

    const bindMachineSlotAction = (
      slot: MachineSlotView,
      primaryAction: MachineGuiActionRequest["action"],
      secondaryAction: MachineGuiActionRequest["action"] | null
    ): void => {
      slot.root.addEventListener("click", (event) => {
        const mode = this.resolveMachineTransferMode(event);
        this.emitMachineGuiAction({ action: primaryAction, mode });
      });
      slot.root.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const mode = this.resolveMachineTransferMode(event);
        const action = secondaryAction ?? primaryAction;
        this.emitMachineGuiAction({ action, mode });
      });
    };

    this.machineOreSlot = makeMachineSlot("Ore", "iron_ore");
    this.machineOreSlot.root.title = "LMB put ore, RMB take ore, Shift half, Ctrl one";
    bindMachineSlotAction(this.machineOreSlot, "insert_ore", "take_ore");
    machineSlotsRow.appendChild(this.machineOreSlot.root);

    this.machineFuelSlot = makeMachineSlot("Fuel", "coal_ore");
    this.machineFuelSlot.root.title = "LMB put fuel, RMB take fuel, Shift half, Ctrl one";
    bindMachineSlotAction(this.machineFuelSlot, "insert_fuel", "take_fuel");
    machineSlotsRow.appendChild(this.machineFuelSlot.root);

    this.machineOutputSlot = makeMachineSlot("Output", "iron_plate");
    this.machineOutputSlot.root.title = "LMB/RMB take output, Shift half, Ctrl one";
    bindMachineSlotAction(this.machineOutputSlot, "take_output", "take_output");
    machineSlotsRow.appendChild(this.machineOutputSlot.root);

    const machineHintLine = document.createElement("div");
    machineHintLine.style.color = "#8da3b8";
    machineHintLine.style.font = "11px/1.35 monospace";
    machineHintLine.textContent = "LMB put, RMB take. Shift = half, Ctrl = one.";
    machineWindow.appendChild(machineHintLine);

    const progressBlock = document.createElement("div");
    progressBlock.style.border = "1px solid #324356";
    progressBlock.style.borderRadius = "8px";
    progressBlock.style.padding = "8px";
    progressBlock.style.background = "rgba(11, 16, 24, 0.86)";
    progressBlock.style.display = "flex";
    progressBlock.style.flexDirection = "column";
    progressBlock.style.gap = "6px";
    machineWindow.appendChild(progressBlock);

    this.machineProgressLine = document.createElement("div");
    this.machineProgressLine.style.color = "#dce8f5";
    this.machineProgressLine.textContent = "Smelt Progress: 0%";
    progressBlock.appendChild(this.machineProgressLine);

    this.machineProgressTrack = document.createElement("div");
    this.machineProgressTrack.style.height = "8px";
    this.machineProgressTrack.style.borderRadius = "999px";
    this.machineProgressTrack.style.background = "rgba(58, 71, 88, 0.7)";
    this.machineProgressTrack.style.overflow = "hidden";
    progressBlock.appendChild(this.machineProgressTrack);

    this.machineProgressFill = document.createElement("div");
    this.machineProgressFill.style.width = "0%";
    this.machineProgressFill.style.height = "100%";
    this.machineProgressFill.style.background = "linear-gradient(90deg, #f5a524, #ffd37a)";
    this.machineProgressTrack.appendChild(this.machineProgressFill);

    this.machineOverlay.addEventListener("click", (event) => {
      if (event.target === this.machineOverlay) {
        this.emitMachineGuiAction({ action: "close", mode: "all" });
      }
    });

    parent.appendChild(this.machineOverlay);
    this.updateInventoryModeUi();
  }

  setHoveredCell(position: GridPosition | null): void {
    this.cellLine.textContent = position ? `Cursor: (${position.x}, ${position.y})` : "Cursor: -";
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerLine.textContent = `Player: (${x.toFixed(2)}, ${y.toFixed(2)})`;
  }

  setStats(stats: HudStats): void {
    this.statsLine.textContent = `FPS: ${stats.fps.toFixed(1)} | Tick: ${stats.tick} | Items on conveyors: ${stats.worldItems}`;
  }

  setHoveredResource(resource: { type: ItemId; amount: number } | null): void {
    if (!resource) {
      this.resourceLine.textContent = "Resource: -";
      return;
    }
    const definition = getItemDefinition(resource.type);
    this.resourceLine.textContent = `Resource: ${definition.name} (${resource.amount})`;
  }

  setMiningProgress(progress: number | null, label = "Mining"): void {
    if (progress === null || Number.isNaN(progress)) {
      this.miningLine.textContent = "Mining: -";
      this.miningBarFill.style.width = "0%";
      this.miningActivityVisible = false;
      this.updateActivityVisibility();
      return;
    }

    const clamped = Math.min(Math.max(progress, 0), 1);
    this.miningLine.textContent = `${label}: ${Math.round(clamped * 100)}%`;
    this.miningBarFill.style.width = `${(clamped * 100).toFixed(1)}%`;
    this.miningActivityVisible = true;
    this.updateActivityVisibility();
  }

  setCraftingStatus(status: CraftingStatusView): void {
    const queueLabel = status.queuedCount > 0 ? ` | Queue: ${status.queuedCount}` : "";
    if (!status.recipeTitle || status.progress01 === null || Number.isNaN(status.progress01)) {
      this.craftingLine.textContent = `Crafting: -${queueLabel}`;
      this.craftingBarFill.style.width = "0%";
      this.craftingActivityVisible = false;
      this.updateActivityVisibility();
      return;
    }

    const clamped = Math.min(Math.max(status.progress01, 0), 1);
    const remainingLabel = status.remainingSeconds !== null && Number.isFinite(status.remainingSeconds)
      ? `${Math.max(status.remainingSeconds, 0).toFixed(1)}s left`
      : "working";
    this.craftingLine.textContent =
      `Crafting: ${status.recipeTitle} (${Math.round(clamped * 100)}%, ${remainingLabel})${queueLabel}`;
    this.craftingBarFill.style.width = `${(clamped * 100).toFixed(1)}%`;
    this.craftingActivityVisible = true;
    this.updateActivityVisibility();
  }

  setFurnaceGui(view: FurnaceGuiView | null): void {
    this.machineGuiView = view;
    this.machineGuiOpen = view !== null;
    this.machineOverlay.style.display = this.machineGuiOpen ? "flex" : "none";
    if (!view) {
      return;
    }

    this.machineTitle.textContent = "Stone Furnace";
    this.machinePositionLine.textContent = `Cell: (${view.gridX}, ${view.gridY})`;
    this.machineOreSlot.label.textContent = "Ore";
    this.machineOreSlot.swatch.style.display = "block";
    this.machineOreSlot.swatch.style.background = this.toCssColor(getItemDefinition("iron_ore").color);
    this.machineOreSlot.name.textContent = getItemDefinition("iron_ore").name;
    this.machineFuelSlot.label.textContent = "Fuel";
    this.machineFuelSlot.swatch.style.display = "block";
    this.machineFuelSlot.swatch.style.background = this.toCssColor(getItemDefinition("coal_ore").color);
    this.machineFuelSlot.name.textContent = getItemDefinition("coal_ore").name;
    this.machineOutputSlot.label.textContent = "Output";
    this.machineOutputSlot.swatch.style.display = "block";
    this.machineOutputSlot.swatch.style.background = this.toCssColor(getItemDefinition("iron_plate").color);
    this.machineOutputSlot.name.textContent = getItemDefinition("iron_plate").name;
    this.machineOreSlot.count.textContent = `${view.oreCount} / ${view.oreCapacity}`;
    this.machineFuelSlot.count.textContent = `${view.fuelCount} / ${view.fuelCapacity}`;
    this.machineOutputSlot.count.textContent = `${view.outputCount} / ${view.outputCapacity}`;
    const progress01 = Math.min(Math.max(view.progress01, 0), 1);
    this.machineProgressLine.textContent = `Smelt Progress: ${Math.round(progress01 * 100)}%`;
    this.machineProgressFill.style.width = `${(progress01 * 100).toFixed(1)}%`;

    this.machineOreSlot.root.disabled = false;
    this.machineOreSlot.root.style.opacity = "1";
    this.machineFuelSlot.root.disabled = false;
    this.machineFuelSlot.root.style.opacity = "1";
    this.machineOutputSlot.root.disabled = view.outputCount <= 0;
    this.machineOutputSlot.root.style.opacity = view.outputCount > 0 ? "1" : "0.6";
  }

  setDrillGui(view: DrillGuiView | null): void {
    this.machineGuiView = view;
    this.machineGuiOpen = view !== null;
    this.machineOverlay.style.display = this.machineGuiOpen ? "flex" : "none";
    if (!view) {
      return;
    }

    this.machineTitle.textContent = "Burner Drill";
    this.machinePositionLine.textContent = `Cell: (${view.gridX}, ${view.gridY})`;

    const resourceDefinition = view.resourceType ? getItemDefinition(view.resourceType) : null;
    this.machineOreSlot.label.textContent = "Deposit";
    this.machineOreSlot.name.textContent = resourceDefinition?.name ?? "No Resource";
    this.machineOreSlot.count.textContent = resourceDefinition ? "Connected" : "-";
    this.machineOreSlot.swatch.style.display = resourceDefinition ? "block" : "none";
    if (resourceDefinition) {
      this.machineOreSlot.swatch.style.background = this.toCssColor(resourceDefinition.color);
    }

    this.machineFuelSlot.label.textContent = "Fuel";
    this.machineFuelSlot.swatch.style.display = "block";
    this.machineFuelSlot.swatch.style.background = this.toCssColor(getItemDefinition("coal_ore").color);
    this.machineFuelSlot.name.textContent = getItemDefinition("coal_ore").name;
    this.machineFuelSlot.count.textContent = `${view.fuelCount} / ${view.fuelCapacity}`;

    const outputDefinition = resourceDefinition ?? getItemDefinition("stone");
    this.machineOutputSlot.label.textContent = "Output";
    this.machineOutputSlot.swatch.style.display = "block";
    this.machineOutputSlot.swatch.style.background = this.toCssColor(outputDefinition.color);
    this.machineOutputSlot.name.textContent = outputDefinition.name;
    this.machineOutputSlot.count.textContent = `${view.outputCount} / ${view.outputCapacity}`;

    const progress01 = Math.min(Math.max(view.progress01, 0), 1);
    this.machineProgressLine.textContent = `Mine Progress: ${Math.round(progress01 * 100)}%`;
    this.machineProgressFill.style.width = `${(progress01 * 100).toFixed(1)}%`;

    this.machineOreSlot.root.disabled = true;
    this.machineOreSlot.root.style.opacity = "0.55";
    this.machineFuelSlot.root.disabled = false;
    this.machineFuelSlot.root.style.opacity = "1";
    this.machineOutputSlot.root.disabled = view.outputCount <= 0;
    this.machineOutputSlot.root.style.opacity = view.outputCount > 0 ? "1" : "0.6";
  }

  isMachineGuiOpen(): boolean {
    return this.machineGuiOpen;
  }

  onMachineGuiAction(listener: MachineGuiActionListener): () => void {
    this.machineGuiActionListeners.push(listener);
    return () => {
      const index = this.machineGuiActionListeners.indexOf(listener);
      if (index >= 0) {
        this.machineGuiActionListeners.splice(index, 1);
      }
    };
  }

  setPlayerInventory(view: PlayerInventoryView): void {
    this.lastInventoryView = {
      hotbar: view.hotbar.map((slot) => this.cloneSlot(slot)),
      backpack: view.backpack.map((slot) => this.cloneSlot(slot)),
      totalCount: view.totalCount,
    };

    const hotbarCount = this.sumSlots(view.hotbar);
    const backpackCount = this.sumSlots(view.backpack);

    this.quickbarTitle.textContent = `Quickbar (${hotbarCount})`;
    this.inventoryHotbarTitle.textContent = `Quickbar (${hotbarCount})`;
    this.inventoryBackpackTitle.textContent = `Backpack (${backpackCount})`;

    for (let i = 0; i < HOTBAR_SLOT_COUNT; i += 1) {
      const stack = view.hotbar[i] ?? null;
      this.renderSlot(this.quickbarSlots[i], stack);
      this.renderSlot(this.inventoryHotbarSlots[i], stack);
    }
    this.applyQuickbarSelection();

    for (let i = 0; i < BACKPACK_SLOT_COUNT; i += 1) {
      const stack = view.backpack[i] ?? null;
      this.renderSlot(this.inventoryBackpackSlots[i], stack);
    }

    if (this.dragSourceSlot && !this.getSlotStack(this.dragSourceSlot.section, this.dragSourceSlot.index)) {
      this.clearDragState();
    } else {
      this.updateDragUi();
    }
    this.updateActivityAnchor();
  }

  setSelectedQuickbarIndex(index: number): void {
    const clamped = Math.min(Math.max(index, 0), HOTBAR_SLOT_COUNT - 1);
    if (this.selectedQuickbarIndex === clamped) {
      return;
    }
    this.selectedQuickbarIndex = clamped;
    this.applyQuickbarSelection();
  }

  setCraftingRecipes(recipes: CraftRecipeView[]): void {
    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    this.craftRecipeMap.clear();

    for (const [id, row] of this.craftRows.entries()) {
      if (recipeIds.has(id)) {
        continue;
      }
      row.root.remove();
      this.craftRows.delete(id);
    }

    for (const recipe of recipes) {
      this.craftRecipeMap.set(recipe.id, recipe);

      let row = this.craftRows.get(recipe.id);
      if (!row) {
        row = this.createCraftRecipeRow(recipe.id);
        this.craftRows.set(recipe.id, row);
      }

      row.title.textContent = recipe.title;
      row.details.textContent = `${recipe.outputLabel} | ${recipe.inputLabel} | ${recipe.craftTimeLabel}`;
      row.button.disabled = false;
      row.button.textContent = recipe.canCraft ? "Craft" : "Need Items";
      row.button.style.opacity = recipe.canCraft ? "1" : "0.7";
    }

    const categories = this.resolveCraftCategories(recipes);
    this.craftCategoryOrder = categories;
    if (categories.length === 0) {
      this.selectedCraftCategoryId = null;
    } else if (!this.selectedCraftCategoryId || !categories.some((entry) => entry.id === this.selectedCraftCategoryId)) {
      this.selectedCraftCategoryId = categories[0]?.id ?? null;
    }

    this.renderCraftCategoryTabs();
    this.renderCraftRecipes();
  }

  onInventoryTransfer(listener: InventoryTransferListener): () => void {
    this.inventoryTransferListeners.push(listener);
    return () => {
      const index = this.inventoryTransferListeners.indexOf(listener);
      if (index >= 0) {
        this.inventoryTransferListeners.splice(index, 1);
      }
    };
  }

  onCraftRequest(listener: CraftRequestListener): () => void {
    this.craftRequestListeners.push(listener);
    return () => {
      const index = this.craftRequestListeners.indexOf(listener);
      if (index >= 0) {
        this.craftRequestListeners.splice(index, 1);
      }
    };
  }

  isInventoryOpen(): boolean {
    return this.inventoryOpen;
  }

  isCreativeMenuOpen(): boolean {
    return this.inventoryOpen && this.creativeMenuOpen;
  }

  toggleInventory(): boolean {
    if (this.inventoryOpen) {
      this.setInventoryOpen(false);
    } else {
      this.creativeMenuOpen = false;
      this.setInventoryOpen(true);
    }
    return this.inventoryOpen;
  }

  toggleCreativeMenu(): boolean {
    if (this.inventoryOpen && this.creativeMenuOpen) {
      this.setInventoryOpen(false);
      return false;
    }
    this.creativeMenuOpen = true;
    this.setInventoryOpen(true);
    return true;
  }

  setInventoryOpen(isOpen: boolean): void {
    this.inventoryOpen = isOpen;
    if (!isOpen) {
      this.creativeMenuOpen = false;
    }
    this.inventoryOverlay.style.display = isOpen ? "flex" : "none";
    if (!isOpen) {
      this.clearDragState();
    } else {
      this.updateDragUi();
    }
    this.updateInventoryModeUi();
  }

  private updateInventoryModeUi(): void {
    const creativeEnabled = this.inventoryOpen && this.creativeMenuOpen;
    this.creativePanel.style.display = creativeEnabled ? "flex" : "none";
    this.inventoryHeaderTitle.textContent = creativeEnabled ? "Inventory + Creative" : "Inventory";
    this.inventoryHeaderHint.textContent = creativeEnabled
      ? "Drag from Creative panel; Shift=half, Ctrl=one, default=stack"
      : "Drag stacks; Shift+LMB half, Ctrl+LMB one";
  }

  dispose(): void {
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("keydown", this.onWindowKeyDown);
    window.removeEventListener("keyup", this.onWindowKeyUp);
    this.root.remove();
    this.quickbarRoot.remove();
    this.activityRoot.remove();
    this.inventoryOverlay.remove();
    this.machineOverlay.remove();
  }

  private updateActivityVisibility(): void {
    this.miningActivityBlock.style.display = this.miningActivityVisible ? "flex" : "none";
    this.craftingActivityBlock.style.display = this.craftingActivityVisible ? "flex" : "none";

    const isVisible = this.miningActivityVisible || this.craftingActivityVisible;
    this.activityRoot.style.display = isVisible ? "flex" : "none";
    if (isVisible) {
      this.updateActivityAnchor();
    }
  }

  private updateActivityAnchor(): void {
    if (!this.quickbarRoot.isConnected || !this.activityRoot.isConnected) {
      return;
    }

    const quickbarRect = this.quickbarRoot.getBoundingClientRect();
    if (quickbarRect.height <= 0) {
      return;
    }

    const bottom = Math.max(12, window.innerHeight - quickbarRect.top + 8);
    this.activityRoot.style.bottom = `${bottom.toFixed(0)}px`;
  }

  private createSlotView(sizePx: number, index: number, interactive: boolean): InventorySlotView {
    const slot = document.createElement("div");
    slot.style.width = `${sizePx}px`;
    slot.style.height = `${sizePx}px`;
    slot.style.borderRadius = "8px";
    slot.style.border = "1px solid #3a4758";
    slot.style.background = "rgba(8, 12, 18, 0.86)";
    slot.style.display = "flex";
    slot.style.flexDirection = "column";
    slot.style.justifyContent = "space-between";
    slot.style.padding = "5px";
    slot.style.boxSizing = "border-box";
    slot.style.userSelect = "none";
    if (interactive) {
      slot.style.cursor = "pointer";
    }

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";

    const indexLabel = document.createElement("div");
    indexLabel.style.color = "#6f8296";
    indexLabel.style.font = "10px/1 monospace";
    indexLabel.textContent = `${index}`;
    top.appendChild(indexLabel);

    const swatch = document.createElement("div");
    swatch.style.width = "11px";
    swatch.style.height = "11px";
    swatch.style.borderRadius = "50%";
    swatch.style.display = "none";
    top.appendChild(swatch);

    const name = document.createElement("div");
    name.style.color = "#94a7bc";
    name.style.font = "9px/1.15 monospace";
    name.style.wordBreak = "break-word";
    name.style.minHeight = "18px";
    name.textContent = "";

    const count = document.createElement("div");
    count.style.color = "#dce7f3";
    count.style.font = "11px/1.1 monospace";
    count.style.alignSelf = "flex-end";
    count.textContent = "";

    slot.append(top, name, count);

    return {
      root: slot,
      swatch,
      name,
      count,
    };
  }

  private renderSlot(view: InventorySlotView, stack: InventorySlotStack | null): void {
    if (!stack) {
      view.root.style.borderColor = "#3a4758";
      view.root.style.background = "rgba(8, 12, 18, 0.86)";
      view.swatch.style.display = "none";
      view.name.textContent = "";
      view.count.textContent = "";
      return;
    }

    const definition = getItemDefinition(stack.itemId);
    const color = this.toCssColor(definition.color);
    view.root.style.borderColor = color;
    view.root.style.background = "rgba(12, 19, 29, 0.95)";
    view.swatch.style.display = "block";
    view.swatch.style.background = color;
    view.name.textContent = definition.name;
    view.count.textContent = `x${stack.count}`;
  }

  private renderCreativeSlot(view: InventorySlotView, itemId: ItemId): void {
    const definition = getItemDefinition(itemId);
    const color = this.toCssColor(definition.color);
    view.root.style.borderColor = color;
    view.root.style.background = "rgba(17, 27, 40, 0.95)";
    view.swatch.style.display = "block";
    view.swatch.style.background = color;
    view.name.textContent = definition.name;
    view.count.textContent = "x∞";
    view.root.title = "Creative source (drag to inventory)";
  }

  private sumSlots(slots: Array<InventorySlotStack | null>): number {
    let total = 0;
    for (const slot of slots) {
      total += slot?.count ?? 0;
    }
    return total;
  }

  private registerInventoryDragSlot(view: InventorySlotView, section: InventoryUiSection, index: number): void {
    view.root.dataset.inventorySlot = "1";
    view.root.dataset.inventorySection = section;
    view.root.dataset.inventoryIndex = String(index);
    view.root.draggable = true;
    view.root.style.cursor = "grab";
    view.root.title = "Drag stack (Shift: half, Ctrl: one)";

    view.root.addEventListener("dragstart", (event) => this.handleSlotDragStart(event, section, index));
    view.root.addEventListener("dragend", () => this.clearDragState());
    view.root.addEventListener("pointerdown", (event) => this.handleSlotPointerDown(event, section, index));
  }

  private handleSlotDragStart(event: DragEvent, section: InventoryUiSection, index: number): void {
    if (!this.inventoryOpen) {
      event.preventDefault();
      return;
    }

    const stack = this.getSlotStack(section, index);
    if (!stack) {
      event.preventDefault();
      return;
    }

    this.dragSourceSlot = { section, index };
    this.dragTargetSlot = null;
    const pending = this.pendingDragModifiers;
    const usePending =
      pending !== null &&
      pending.section === section &&
      pending.index === index;
    const shiftKey = (usePending ? pending.shiftKey : false) || event.shiftKey || this.isShiftHeld;
    const ctrlKey = (usePending ? pending.ctrlKey : false) || event.ctrlKey || this.isCtrlHeld;
    this.dragAmount = this.resolveDragAmount(stack.count, shiftKey, ctrlKey);
    this.updateDragUi();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", `${section}:${index}`);
    }
  }

  private handleSlotPointerDown(event: PointerEvent, section: InventoryUiSection, index: number): void {
    if (event.button !== 0) {
      return;
    }
    this.pendingDragModifiers = {
      section,
      index,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
    };
  }

  private readonly handleInventoryOverlayDragOver = (event: DragEvent): void => {
    if (!this.inventoryOpen || !this.dragSourceSlot) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const hovered = this.extractSlotFromTarget(event.target);
    if (!hovered || this.isSameSlot(hovered, this.dragSourceSlot)) {
      if (this.dragTargetSlot) {
        this.dragTargetSlot = null;
        this.updateDragUi();
      }
      return;
    }

    if (!this.dragTargetSlot || !this.isSameSlot(this.dragTargetSlot, hovered)) {
      this.dragTargetSlot = hovered;
      this.updateDragUi();
    }
  };

  private readonly handleInventoryOverlayDrop = (event: DragEvent): void => {
    if (!this.inventoryOpen || !this.dragSourceSlot) {
      return;
    }

    event.preventDefault();
    const target = this.extractSlotFromTarget(event.target);
    const source = this.dragSourceSlot;
    const sourceStack = this.getSlotStack(source.section, source.index);

    if (target && !this.isSameSlot(source, target)) {
      const request: InventoryTransferRequest = {
        fromSection: source.section,
        fromIndex: source.index,
        toSection: target.section,
        toIndex: target.index,
        amount: this.dragAmount ?? undefined,
        itemId: sourceStack?.itemId,
      };

      for (const listener of this.inventoryTransferListeners) {
        listener(request);
      }
    }

    this.clearDragState();
  };

  private getSlotStack(section: InventoryUiSection, index: number): InventorySlotStack | null {
    if (section === "hotbar") {
      if (index < 0 || index >= this.lastInventoryView.hotbar.length) {
        return null;
      }
      return this.lastInventoryView.hotbar[index] ?? null;
    }

    if (section === "backpack") {
      if (index < 0 || index >= this.lastInventoryView.backpack.length) {
        return null;
      }
      return this.lastInventoryView.backpack[index] ?? null;
    }

    if (section === "creative") {
      if (index < 0 || index >= this.creativeItems.length) {
        return null;
      }
      return {
        itemId: this.creativeItems[index] as ItemId,
        count: CREATIVE_STACK_AMOUNT,
      };
    }

    return null;
  }

  private clearDragState(): void {
    this.dragSourceSlot = null;
    this.dragTargetSlot = null;
    this.dragAmount = null;
    this.pendingDragModifiers = null;
    this.updateDragUi();
  }

  private updateDragUi(): void {
    if (!this.inventoryOpen || !this.dragSourceSlot) {
      this.inventorySelectionLine.textContent = "Drag: -";
      this.applyDragHighlights(null, null);
      return;
    }

    const stack = this.getSlotStack(this.dragSourceSlot.section, this.dragSourceSlot.index);
    if (!stack) {
      this.inventorySelectionLine.textContent = "Drag: -";
      this.applyDragHighlights(null, null);
      return;
    }

    const definition = getItemDefinition(stack.itemId);
    const transferCount = this.resolveTransferCount(stack.count);
    const sourceLabel = this.getSlotLabel(this.dragSourceSlot.section, this.dragSourceSlot.index);
    if (this.dragTargetSlot) {
      const targetLabel = this.getSlotLabel(this.dragTargetSlot.section, this.dragTargetSlot.index);
      this.inventorySelectionLine.textContent =
        `Drag: ${definition.name} x${transferCount} (${sourceLabel} -> ${targetLabel})`;
    } else {
      this.inventorySelectionLine.textContent =
        `Drag: ${definition.name} x${transferCount} from ${sourceLabel}`;
    }
    this.applyDragHighlights(this.dragSourceSlot, this.dragTargetSlot);
  }

  private resolveDragAmount(stackCount: number, shiftKey: boolean, ctrlKey: boolean): number {
    if (ctrlKey) {
      return 1;
    }
    if (shiftKey) {
      return Math.max(1, Math.ceil(stackCount / 2));
    }
    return stackCount;
  }

  private resolveTransferCount(stackCount: number): number {
    const requested = this.dragAmount ?? stackCount;
    return Math.max(1, Math.min(stackCount, requested));
  }

  private applyDragHighlights(
    source: { section: InventoryUiSection; index: number } | null,
    target: { section: InventoryUiSection; index: number } | null
  ): void {
    const resetStyle = (slot: InventorySlotView): void => {
      slot.root.style.boxShadow = "none";
      slot.root.style.transform = "none";
    };

    for (const slot of this.inventoryHotbarSlots) {
      resetStyle(slot);
    }
    for (const slot of this.inventoryBackpackSlots) {
      resetStyle(slot);
    }
    for (const slot of this.creativeSlots) {
      resetStyle(slot);
    }
    resetStyle(this.trashSlot);

    if (!source) {
      return;
    }

    const sourceView = this.getInventorySlotView(source);
    if (!sourceView) {
      return;
    }

    sourceView.root.style.boxShadow = "0 0 0 2px #7cc6ff inset, 0 0 16px rgba(124, 198, 255, 0.28)";
    sourceView.root.style.transform = "translateY(-1px)";

    if (!target || this.isSameSlot(source, target)) {
      return;
    }

    const targetView = this.getInventorySlotView(target);
    if (!targetView) {
      return;
    }

    targetView.root.style.boxShadow = "0 0 0 2px #8be9a8 inset, 0 0 16px rgba(139, 233, 168, 0.28)";
    targetView.root.style.transform = "translateY(-1px)";
  }

  private getInventorySlotView(slot: { section: InventoryUiSection; index: number }): InventorySlotView | null {
    if (slot.section === "hotbar") {
      if (slot.index < 0 || slot.index >= this.inventoryHotbarSlots.length) {
        return null;
      }
      return this.inventoryHotbarSlots[slot.index] ?? null;
    }

    if (slot.section === "backpack") {
      if (slot.index < 0 || slot.index >= this.inventoryBackpackSlots.length) {
        return null;
      }
      return this.inventoryBackpackSlots[slot.index] ?? null;
    }

    if (slot.section === "creative") {
      if (slot.index < 0 || slot.index >= this.creativeSlots.length) {
        return null;
      }
      return this.creativeSlots[slot.index] ?? null;
    }

    if (slot.section === "trash") {
      return slot.index === 0 ? this.trashSlot : null;
    }

    return null;
  }

  private getSlotLabel(section: InventoryUiSection, index: number): string {
    if (section === "hotbar") {
      return `Quickbar #${index + 1}`;
    }
    if (section === "backpack") {
      return `Backpack #${index + 1}`;
    }
    if (section === "creative") {
      return `Creative #${index + 1}`;
    }
    return "Trash";
  }

  private extractSlotFromTarget(target: EventTarget | null): { section: InventoryUiSection; index: number } | null {
    if (!target || !(target instanceof Element)) {
      return null;
    }

    const slotNode = target.closest("[data-inventory-slot='1']");
    if (!(slotNode instanceof HTMLElement)) {
      return null;
    }

    const sectionData = slotNode.dataset.inventorySection;
    if (sectionData !== "hotbar" && sectionData !== "backpack" && sectionData !== "creative" && sectionData !== "trash") {
      return null;
    }

    const index = Number(slotNode.dataset.inventoryIndex);
    if (!Number.isInteger(index) || index < 0) {
      return null;
    }

    return {
      section: sectionData,
      index,
    };
  }

  private isSameSlot(
    left: { section: InventoryUiSection; index: number },
    right: { section: InventoryUiSection; index: number }
  ): boolean {
    return left.section === right.section && left.index === right.index;
  }

  private applyQuickbarSelection(): void {
    for (let i = 0; i < this.quickbarSlots.length; i += 1) {
      const slot = this.quickbarSlots[i];
      if (!slot) {
        continue;
      }

      if (i === this.selectedQuickbarIndex) {
        slot.root.style.boxShadow = "0 0 0 2px #ffe48a inset, 0 0 14px rgba(255, 228, 138, 0.25)";
        slot.root.style.transform = "translateY(-1px)";
      } else {
        slot.root.style.boxShadow = "none";
        slot.root.style.transform = "none";
      }
    }
  }

  private resolveCraftCategories(recipes: CraftRecipeView[]): CraftCategoryView[] {
    const categories = new Map<string, string>();
    for (const recipe of recipes) {
      const categoryId = recipe.categoryId ?? "other";
      const categoryLabel = recipe.categoryLabel ?? "Other";
      if (!categories.has(categoryId)) {
        categories.set(categoryId, categoryLabel);
      }
    }
    return [...categories.entries()].map(([id, label]) => ({ id, label }));
  }

  private renderCraftCategoryTabs(): void {
    const activeCategoryIds = new Set(this.craftCategoryOrder.map((entry) => entry.id));
    for (const [id, button] of this.craftCategoryButtons.entries()) {
      if (activeCategoryIds.has(id)) {
        continue;
      }
      button.remove();
      this.craftCategoryButtons.delete(id);
      this.craftPageByCategory.delete(id);
    }

    for (const category of this.craftCategoryOrder) {
      let button = this.craftCategoryButtons.get(category.id);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.style.border = "1px solid #3f5062";
        button.style.borderRadius = "999px";
        button.style.background = "#1b2735";
        button.style.color = "#dce8f5";
        button.style.font = "11px/1.2 monospace";
        button.style.padding = "4px 9px";
        button.style.cursor = "pointer";
        button.addEventListener("click", () => {
          this.selectedCraftCategoryId = category.id;
          if (!this.craftPageByCategory.has(category.id)) {
            this.craftPageByCategory.set(category.id, 0);
          }
          this.renderCraftCategoryTabs();
          this.renderCraftRecipes();
        });
        this.craftCategoryButtons.set(category.id, button);
      }

      button.textContent = category.label;
      if (this.selectedCraftCategoryId === category.id) {
        button.style.background = "#2b3a4c";
        button.style.borderColor = "#6da6dd";
      } else {
        button.style.background = "#1b2735";
        button.style.borderColor = "#3f5062";
      }
      if (button.parentElement !== this.craftCategoriesRoot) {
        this.craftCategoriesRoot.appendChild(button);
      }
    }
  }

  private renderCraftRecipes(): void {
    if (!this.selectedCraftCategoryId) {
      this.craftRecipesRoot.replaceChildren();
      this.visibleCraftRecipeIds = [];
      this.craftPageLine.textContent = "Page 0 / 0";
      this.craftPrevButton.disabled = true;
      this.craftNextButton.disabled = true;
      return;
    }

    const categoryId = this.selectedCraftCategoryId;
    const categoryRecipes = [...this.craftRecipeMap.values()].filter(
      (recipe) => (recipe.categoryId ?? "other") === categoryId
    );
    if (categoryRecipes.length <= 0) {
      const fallbackCategory = this.craftCategoryOrder[0]?.id ?? null;
      if (fallbackCategory && fallbackCategory !== this.selectedCraftCategoryId) {
        this.selectedCraftCategoryId = fallbackCategory;
        this.renderCraftCategoryTabs();
        this.renderCraftRecipes();
        return;
      }
    }
    const totalPages = Math.max(1, Math.ceil(categoryRecipes.length / CRAFT_RECIPES_PER_PAGE));
    const requestedPage = this.craftPageByCategory.get(categoryId) ?? 0;
    const pageIndex = Math.min(Math.max(requestedPage, 0), totalPages - 1);
    this.craftPageByCategory.set(categoryId, pageIndex);

    const start = pageIndex * CRAFT_RECIPES_PER_PAGE;
    const visibleRecipes = categoryRecipes.slice(start, start + CRAFT_RECIPES_PER_PAGE);
    const nextVisibleIds = visibleRecipes.map((recipe) => recipe.id);
    const hasSameVisibleIds =
      nextVisibleIds.length === this.visibleCraftRecipeIds.length &&
      nextVisibleIds.every((id, index) => id === this.visibleCraftRecipeIds[index]);

    if (!hasSameVisibleIds) {
      this.craftRecipesRoot.replaceChildren();
      for (const recipe of visibleRecipes) {
        const row = this.craftRows.get(recipe.id);
        if (!row) {
          continue;
        }
        this.craftRecipesRoot.appendChild(row.root);
      }
      this.visibleCraftRecipeIds = nextVisibleIds;
    }

    this.craftPageLine.textContent = `Page ${pageIndex + 1} / ${totalPages}`;
    this.craftPrevButton.disabled = pageIndex <= 0;
    this.craftNextButton.disabled = pageIndex >= totalPages - 1;
  }

  private createCraftRecipeRow(recipeId: string): CraftRecipeRowView {
    const root = document.createElement("div");
    root.style.border = "1px solid #324356";
    root.style.borderRadius = "8px";
    root.style.background = "rgba(11, 16, 24, 0.86)";
    root.style.padding = "8px";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "6px";

    const title = document.createElement("div");
    title.style.color = "#dce8f5";
    title.style.font = "12px/1.2 monospace";
    root.appendChild(title);

    const details = document.createElement("div");
    details.style.color = "#98adc2";
    details.style.font = "11px/1.3 monospace";
    details.style.wordBreak = "break-word";
    root.appendChild(details);

    const button = document.createElement("button");
    button.type = "button";
    button.style.alignSelf = "flex-start";
    button.style.border = "1px solid #3f5062";
    button.style.borderRadius = "6px";
    button.style.background = "#1b2735";
    button.style.color = "#dce8f5";
    button.style.font = "11px/1.2 monospace";
    button.style.padding = "4px 8px";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => this.emitCraftRequest(recipeId));
    root.appendChild(button);

    return {
      root,
      title,
      details,
      button,
    };
  }

  private emitCraftRequest(recipeId: string): void {
    for (const listener of this.craftRequestListeners) {
      listener(recipeId);
    }
  }

  private emitMachineGuiAction(request: MachineGuiActionRequest): void {
    for (const listener of this.machineGuiActionListeners) {
      listener(request);
    }
  }

  private resolveMachineTransferMode(event: MouseEvent): MachineTransferMode {
    if (event.ctrlKey) {
      return "single";
    }
    if (event.shiftKey) {
      return "half";
    }
    return "all";
  }

  private cloneSlot(slot: InventorySlotStack | null): InventorySlotStack | null {
    if (!slot) {
      return null;
    }
    return {
      itemId: slot.itemId,
      count: slot.count,
    };
  }

  private toCssColor(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }
}
