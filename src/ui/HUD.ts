import type { GridPosition } from "../core/types";
import { getItemDefinition, type ItemId } from "../data/items";
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
  fromSection: InventorySection;
  fromIndex: number;
  toSection: InventorySection;
  toIndex: number;
}

export interface CraftRecipeView {
  id: string;
  title: string;
  outputLabel: string;
  inputLabel: string;
  canCraft: boolean;
}

type InventoryTransferListener = (request: InventoryTransferRequest) => void;
type CraftRequestListener = (recipeId: string) => void;

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
  private readonly controlsLine: HTMLDivElement;

  private readonly quickbarRoot: HTMLDivElement;
  private readonly quickbarTitle: HTMLDivElement;
  private readonly quickbarSlots: InventorySlotView[] = [];

  private readonly inventoryOverlay: HTMLDivElement;
  private readonly inventoryHotbarTitle: HTMLDivElement;
  private readonly inventoryBackpackTitle: HTMLDivElement;
  private readonly inventorySelectionLine: HTMLDivElement;
  private readonly craftRecipesRoot: HTMLDivElement;
  private readonly inventoryHotbarSlots: InventorySlotView[] = [];
  private readonly inventoryBackpackSlots: InventorySlotView[] = [];

  private readonly inventoryTransferListeners: InventoryTransferListener[] = [];
  private readonly craftRequestListeners: CraftRequestListener[] = [];
  private readonly craftRows = new Map<string, CraftRecipeRowView>();

  private dragSourceSlot: { section: InventorySection; index: number } | null = null;
  private dragTargetSlot: { section: InventorySection; index: number } | null = null;
  private selectedQuickbarIndex = 0;
  private inventoryOpen = false;

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
    this.controlsLine = document.createElement("div");
    this.controlsLine.style.marginTop = "8px";
    this.controlsLine.style.color = "#a6b4c4";
    this.controlsLine.textContent =
      "WASD move, hold RMB mine, LMB place/insert, 1-0 select slot, F collect, Q/E or wheel zoom, TAB inventory";

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

    this.root.append(
      this.modeLine,
      this.playerLine,
      this.cellLine,
      this.statsLine,
      this.resourceLine,
      this.miningLine,
      this.miningBarTrack,
      this.controlsLine
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

    const headerTitle = document.createElement("div");
    headerTitle.style.font = "14px/1.2 monospace";
    headerTitle.style.color = "#e4edf7";
    headerTitle.textContent = "Inventory";

    const headerHint = document.createElement("div");
    headerHint.style.color = "#9ab0c6";
    headerHint.textContent = "Tab close, drag stack from source slot to target slot";

    header.append(headerTitle, headerHint);
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
    craftHint.textContent = "Craft result goes to inventory.";
    craftPanel.appendChild(craftHint);

    this.craftRecipesRoot = document.createElement("div");
    this.craftRecipesRoot.style.display = "flex";
    this.craftRecipesRoot.style.flexDirection = "column";
    this.craftRecipesRoot.style.gap = "8px";
    craftPanel.appendChild(this.craftRecipesRoot);

    this.inventoryOverlay.addEventListener("click", (event) => {
      if (event.target === this.inventoryOverlay) {
        this.clearDragState();
      }
    });
    this.inventoryOverlay.addEventListener("dragover", this.handleInventoryOverlayDragOver);
    this.inventoryOverlay.addEventListener("drop", this.handleInventoryOverlayDrop);

    parent.appendChild(this.inventoryOverlay);
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
      return;
    }

    const clamped = Math.min(Math.max(progress, 0), 1);
    this.miningLine.textContent = `${label}: ${Math.round(clamped * 100)}%`;
    this.miningBarFill.style.width = `${(clamped * 100).toFixed(1)}%`;
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

    for (const [id, row] of this.craftRows.entries()) {
      if (recipeIds.has(id)) {
        continue;
      }
      row.root.remove();
      this.craftRows.delete(id);
    }

    for (const recipe of recipes) {
      let row = this.craftRows.get(recipe.id);
      if (!row) {
        row = this.createCraftRecipeRow(recipe.id);
        this.craftRows.set(recipe.id, row);
        this.craftRecipesRoot.appendChild(row.root);
      }

      row.title.textContent = recipe.title;
      row.details.textContent = `${recipe.outputLabel} | ${recipe.inputLabel}`;
      row.button.disabled = !recipe.canCraft;
      row.button.textContent = recipe.canCraft ? "Craft" : "Need Items";
    }
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

  toggleInventory(): boolean {
    this.setInventoryOpen(!this.inventoryOpen);
    return this.inventoryOpen;
  }

  setInventoryOpen(isOpen: boolean): void {
    this.inventoryOpen = isOpen;
    this.inventoryOverlay.style.display = isOpen ? "flex" : "none";
    if (!isOpen) {
      this.clearDragState();
    } else {
      this.updateDragUi();
    }
  }

  dispose(): void {
    this.root.remove();
    this.quickbarRoot.remove();
    this.inventoryOverlay.remove();
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

  private sumSlots(slots: Array<InventorySlotStack | null>): number {
    let total = 0;
    for (const slot of slots) {
      total += slot?.count ?? 0;
    }
    return total;
  }

  private registerInventoryDragSlot(view: InventorySlotView, section: InventorySection, index: number): void {
    view.root.dataset.inventorySlot = "1";
    view.root.dataset.inventorySection = section;
    view.root.dataset.inventoryIndex = String(index);
    view.root.draggable = true;
    view.root.style.cursor = "grab";
    view.root.title = "Drag stack";

    view.root.addEventListener("dragstart", (event) => this.handleSlotDragStart(event, section, index));
    view.root.addEventListener("dragend", () => this.clearDragState());
  }

  private handleSlotDragStart(event: DragEvent, section: InventorySection, index: number): void {
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
    this.updateDragUi();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("text/plain", `${section}:${index}`);
    }
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

    if (target && !this.isSameSlot(source, target)) {
      const request: InventoryTransferRequest = {
        fromSection: source.section,
        fromIndex: source.index,
        toSection: target.section,
        toIndex: target.index,
      };

      for (const listener of this.inventoryTransferListeners) {
        listener(request);
      }
    }

    this.clearDragState();
  };

  private getSlotStack(section: InventorySection, index: number): InventorySlotStack | null {
    const slots = section === "hotbar" ? this.lastInventoryView.hotbar : this.lastInventoryView.backpack;
    if (index < 0 || index >= slots.length) {
      return null;
    }
    return slots[index] ?? null;
  }

  private clearDragState(): void {
    this.dragSourceSlot = null;
    this.dragTargetSlot = null;
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
    const sourceLabel = this.getSlotLabel(this.dragSourceSlot.section, this.dragSourceSlot.index);
    if (this.dragTargetSlot) {
      const targetLabel = this.getSlotLabel(this.dragTargetSlot.section, this.dragTargetSlot.index);
      this.inventorySelectionLine.textContent =
        `Drag: ${definition.name} x${stack.count} (${sourceLabel} -> ${targetLabel})`;
    } else {
      this.inventorySelectionLine.textContent =
        `Drag: ${definition.name} x${stack.count} from ${sourceLabel}`;
    }
    this.applyDragHighlights(this.dragSourceSlot, this.dragTargetSlot);
  }

  private applyDragHighlights(
    source: { section: InventorySection; index: number } | null,
    target: { section: InventorySection; index: number } | null
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

  private getInventorySlotView(slot: { section: InventorySection; index: number }): InventorySlotView | null {
    const views = slot.section === "hotbar" ? this.inventoryHotbarSlots : this.inventoryBackpackSlots;
    if (slot.index < 0 || slot.index >= views.length) {
      return null;
    }
    return views[slot.index] ?? null;
  }

  private getSlotLabel(section: InventorySection, index: number): string {
    const sectionName = section === "hotbar" ? "Quickbar" : "Backpack";
    return `${sectionName} #${index + 1}`;
  }

  private extractSlotFromTarget(target: EventTarget | null): { section: InventorySection; index: number } | null {
    if (!target || !(target instanceof Element)) {
      return null;
    }

    const slotNode = target.closest("[data-inventory-slot='1']");
    if (!(slotNode instanceof HTMLElement)) {
      return null;
    }

    const sectionData = slotNode.dataset.inventorySection;
    if (sectionData !== "hotbar" && sectionData !== "backpack") {
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
    left: { section: InventorySection; index: number },
    right: { section: InventorySection; index: number }
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
