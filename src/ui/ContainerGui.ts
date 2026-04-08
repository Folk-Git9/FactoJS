import { getItemDefinition } from "../data/items";
import type { InventorySlotStack } from "../entities/PlayerInventory";
import type { CraftRecipeView, MachineTransferMode } from "./HUD";

export interface ContainerGuiView {
  gridX: number;
  gridY: number;
  slots: Array<InventorySlotStack | null>;
  maxStackPerSlot: number;
  totalCount: number;
  totalCapacity: number;
}

export interface ContainerTakeSlotRequest {
  slotIndex: number;
  mode: MachineTransferMode;
}

type ContainerTakeSlotListener = (request: ContainerTakeSlotRequest) => void;
type ContainerCraftRequestListener = (recipeId: string) => void;
type ContainerCloseListener = () => void;

interface ContainerSlotView {
  root: HTMLButtonElement;
  swatch: HTMLDivElement;
  name: HTMLDivElement;
  count: HTMLDivElement;
}

interface ContainerCraftRowView {
  root: HTMLDivElement;
  title: HTMLDivElement;
  details: HTMLDivElement;
  button: HTMLButtonElement;
}

export class ContainerGui {
  private readonly overlay: HTMLDivElement;
  private readonly titleLine: HTMLDivElement;
  private readonly positionLine: HTMLDivElement;
  private readonly capacityLine: HTMLDivElement;
  private readonly slotGrid: HTMLDivElement;
  private readonly recipesRoot: HTMLDivElement;
  private readonly slotViews: ContainerSlotView[] = [];
  private readonly craftRows = new Map<string, ContainerCraftRowView>();
  private readonly takeSlotListeners: ContainerTakeSlotListener[] = [];
  private readonly craftListeners: ContainerCraftRequestListener[] = [];
  private readonly closeListeners: ContainerCloseListener[] = [];

  private isOpenFlag = false;
  private currentView: ContainerGuiView | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement("div");
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.display = "none";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.background = "rgba(3, 8, 13, 0.36)";
    this.overlay.style.pointerEvents = "auto";
    this.overlay.style.zIndex = "19";

    const windowRoot = document.createElement("div");
    windowRoot.style.display = "flex";
    windowRoot.style.flexDirection = "column";
    windowRoot.style.gap = "10px";
    windowRoot.style.width = "min(980px, calc(100vw - 24px))";
    windowRoot.style.maxHeight = "calc(100vh - 24px)";
    windowRoot.style.padding = "12px";
    windowRoot.style.boxSizing = "border-box";
    windowRoot.style.borderRadius = "12px";
    windowRoot.style.border = "1px solid #3a4758";
    windowRoot.style.background = "rgba(8, 13, 20, 0.97)";
    windowRoot.style.color = "#dce7f3";
    windowRoot.style.font = "12px/1.4 monospace";
    windowRoot.style.overflow = "auto";
    this.overlay.appendChild(windowRoot);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.paddingBottom = "8px";
    header.style.borderBottom = "1px solid #273646";
    windowRoot.appendChild(header);

    this.titleLine = document.createElement("div");
    this.titleLine.style.font = "14px/1.2 monospace";
    this.titleLine.style.color = "#e4edf7";
    this.titleLine.textContent = "Container";
    header.appendChild(this.titleLine);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.style.border = "1px solid #3f5062";
    closeButton.style.borderRadius = "6px";
    closeButton.style.background = "#1b2735";
    closeButton.style.color = "#dce8f5";
    closeButton.style.font = "11px/1.2 monospace";
    closeButton.style.padding = "4px 8px";
    closeButton.style.cursor = "pointer";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => this.emitClose());
    header.appendChild(closeButton);

    this.positionLine = document.createElement("div");
    this.positionLine.style.color = "#9cb0c4";
    this.positionLine.textContent = "Cell: -";
    windowRoot.appendChild(this.positionLine);

    this.capacityLine = document.createElement("div");
    this.capacityLine.style.color = "#9cb0c4";
    this.capacityLine.textContent = "Stored: 0 / 0";
    windowRoot.appendChild(this.capacityLine);

    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.alignItems = "stretch";
    content.style.gap = "12px";
    windowRoot.appendChild(content);

    const slotsPanel = document.createElement("div");
    slotsPanel.style.flex = "1 1 auto";
    slotsPanel.style.display = "flex";
    slotsPanel.style.flexDirection = "column";
    slotsPanel.style.gap = "8px";
    slotsPanel.style.border = "1px solid #324356";
    slotsPanel.style.borderRadius = "10px";
    slotsPanel.style.padding = "10px";
    slotsPanel.style.background = "rgba(11, 16, 24, 0.86)";
    content.appendChild(slotsPanel);

    const slotsTitle = document.createElement("div");
    slotsTitle.style.color = "#dce8f5";
    slotsTitle.style.font = "12px/1.2 monospace";
    slotsTitle.textContent = "Storage Slots";
    slotsPanel.appendChild(slotsTitle);

    const slotsHint = document.createElement("div");
    slotsHint.style.color = "#8da3b8";
    slotsHint.style.font = "11px/1.3 monospace";
    slotsHint.textContent = "LMB/RMB take stack, Shift = half, Ctrl = one.";
    slotsPanel.appendChild(slotsHint);

    this.slotGrid = document.createElement("div");
    this.slotGrid.style.display = "grid";
    this.slotGrid.style.gridTemplateColumns = "repeat(8, minmax(64px, 1fr))";
    this.slotGrid.style.gap = "6px";
    slotsPanel.appendChild(this.slotGrid);

    const craftPanel = document.createElement("div");
    craftPanel.style.flex = "0 0 280px";
    craftPanel.style.display = "flex";
    craftPanel.style.flexDirection = "column";
    craftPanel.style.border = "1px solid #324356";
    craftPanel.style.borderRadius = "10px";
    craftPanel.style.padding = "10px";
    craftPanel.style.background = "rgba(11, 16, 24, 0.86)";
    content.appendChild(craftPanel);

    const craftTitle = document.createElement("div");
    craftTitle.style.color = "#dce8f5";
    craftTitle.style.font = "12px/1.2 monospace";
    craftTitle.style.marginBottom = "8px";
    craftTitle.textContent = "Crafting";
    craftPanel.appendChild(craftTitle);

    const craftHint = document.createElement("div");
    craftHint.style.color = "#8da3b8";
    craftHint.style.font = "11px/1.3 monospace";
    craftHint.style.marginBottom = "8px";
    craftHint.textContent = "Crafts use items from this container.";
    craftPanel.appendChild(craftHint);

    this.recipesRoot = document.createElement("div");
    this.recipesRoot.style.display = "flex";
    this.recipesRoot.style.flexDirection = "column";
    this.recipesRoot.style.gap = "8px";
    craftPanel.appendChild(this.recipesRoot);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.emitClose();
      }
    });

    parent.appendChild(this.overlay);
  }

  setView(view: ContainerGuiView | null): void {
    this.currentView = view;
    this.isOpenFlag = view !== null;
    this.overlay.style.display = this.isOpenFlag ? "flex" : "none";

    if (!view) {
      return;
    }

    this.positionLine.textContent = `Cell: (${view.gridX}, ${view.gridY})`;
    this.capacityLine.textContent =
      `Stored: ${view.totalCount} / ${view.totalCapacity} | Stack cap: ${view.maxStackPerSlot}`;

    this.ensureSlotCount(view.slots.length);
    for (let i = 0; i < view.slots.length; i += 1) {
      const slotView = this.slotViews[i];
      if (!slotView) {
        continue;
      }
      this.renderSlot(slotView, view.slots[i] ?? null, view.maxStackPerSlot);
    }
  }

  setCraftingRecipes(recipes: CraftRecipeView[]): void {
    const activeIds = new Set(recipes.map((recipe) => recipe.id));

    for (const [id, row] of this.craftRows.entries()) {
      if (activeIds.has(id)) {
        continue;
      }
      row.root.remove();
      this.craftRows.delete(id);
    }

    for (const recipe of recipes) {
      let row = this.craftRows.get(recipe.id);
      if (!row) {
        row = this.createCraftRow(recipe.id);
        this.craftRows.set(recipe.id, row);
        this.recipesRoot.appendChild(row.root);
      }

      row.title.textContent = recipe.title;
      row.details.textContent = `${recipe.outputLabel} | ${recipe.inputLabel}`;
      row.button.disabled = !recipe.canCraft;
      row.button.textContent = recipe.canCraft ? "Craft" : "Need Items";
    }
  }

  isOpen(): boolean {
    return this.isOpenFlag;
  }

  onTakeSlot(listener: ContainerTakeSlotListener): () => void {
    this.takeSlotListeners.push(listener);
    return () => {
      const index = this.takeSlotListeners.indexOf(listener);
      if (index >= 0) {
        this.takeSlotListeners.splice(index, 1);
      }
    };
  }

  onCraftRequest(listener: ContainerCraftRequestListener): () => void {
    this.craftListeners.push(listener);
    return () => {
      const index = this.craftListeners.indexOf(listener);
      if (index >= 0) {
        this.craftListeners.splice(index, 1);
      }
    };
  }

  onClose(listener: ContainerCloseListener): () => void {
    this.closeListeners.push(listener);
    return () => {
      const index = this.closeListeners.indexOf(listener);
      if (index >= 0) {
        this.closeListeners.splice(index, 1);
      }
    };
  }

  dispose(): void {
    this.overlay.remove();
    this.takeSlotListeners.length = 0;
    this.craftListeners.length = 0;
    this.closeListeners.length = 0;
    this.craftRows.clear();
    this.slotViews.length = 0;
  }

  private ensureSlotCount(slotCount: number): void {
    if (this.slotViews.length === slotCount) {
      return;
    }

    this.slotViews.length = 0;
    this.slotGrid.replaceChildren();

    for (let i = 0; i < slotCount; i += 1) {
      const view = this.createSlotView(i);
      this.slotViews.push(view);
      this.slotGrid.appendChild(view.root);
    }
  }

  private createSlotView(index: number): ContainerSlotView {
    const root = document.createElement("button");
    root.type = "button";
    root.style.border = "1px solid #3a4758";
    root.style.borderRadius = "8px";
    root.style.background = "rgba(8, 12, 18, 0.86)";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.justifyContent = "space-between";
    root.style.alignItems = "stretch";
    root.style.padding = "6px";
    root.style.minHeight = "72px";
    root.style.cursor = "pointer";
    root.style.color = "#dce8f5";
    root.style.font = "11px/1.3 monospace";
    root.style.textAlign = "left";
    root.title = "Take items (Shift: half, Ctrl: one)";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";
    top.style.gap = "6px";
    root.appendChild(top);

    const indexLabel = document.createElement("div");
    indexLabel.style.color = "#6f8296";
    indexLabel.style.font = "10px/1 monospace";
    indexLabel.textContent = `${index + 1}`;
    top.appendChild(indexLabel);

    const swatch = document.createElement("div");
    swatch.style.width = "10px";
    swatch.style.height = "10px";
    swatch.style.borderRadius = "50%";
    swatch.style.display = "none";
    top.appendChild(swatch);

    const name = document.createElement("div");
    name.style.color = "#94a7bc";
    name.style.font = "10px/1.15 monospace";
    name.style.wordBreak = "break-word";
    name.style.minHeight = "24px";
    name.textContent = "";
    root.appendChild(name);

    const count = document.createElement("div");
    count.style.color = "#dce7f3";
    count.style.font = "11px/1.1 monospace";
    count.style.textAlign = "right";
    count.textContent = "";
    root.appendChild(count);

    const onClick = (event: MouseEvent): void => {
      event.preventDefault();
      this.emitTakeSlot({
        slotIndex: index,
        mode: this.resolveTransferMode(event),
      });
    };
    root.addEventListener("click", onClick);
    root.addEventListener("contextmenu", onClick);

    return {
      root,
      swatch,
      name,
      count,
    };
  }

  private renderSlot(view: ContainerSlotView, stack: InventorySlotStack | null, maxStack: number): void {
    if (!stack) {
      view.root.style.borderColor = "#3a4758";
      view.root.style.background = "rgba(8, 12, 18, 0.86)";
      view.root.disabled = true;
      view.root.style.opacity = "0.7";
      view.swatch.style.display = "none";
      view.name.textContent = "";
      view.count.textContent = "";
      return;
    }

    const definition = getItemDefinition(stack.itemId);
    const color = this.toCssColor(definition.color);
    view.root.style.borderColor = color;
    view.root.style.background = "rgba(12, 19, 29, 0.95)";
    view.root.disabled = false;
    view.root.style.opacity = "1";
    view.swatch.style.display = "block";
    view.swatch.style.background = color;
    view.name.textContent = definition.name;
    view.count.textContent = `x${stack.count} / ${maxStack}`;
  }

  private createCraftRow(recipeId: string): ContainerCraftRowView {
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

  private resolveTransferMode(event: MouseEvent): MachineTransferMode {
    if (event.ctrlKey) {
      return "single";
    }
    if (event.shiftKey) {
      return "half";
    }
    return "all";
  }

  private emitTakeSlot(request: ContainerTakeSlotRequest): void {
    for (const listener of this.takeSlotListeners) {
      listener(request);
    }
  }

  private emitCraftRequest(recipeId: string): void {
    for (const listener of this.craftListeners) {
      listener(recipeId);
    }
  }

  private emitClose(): void {
    for (const listener of this.closeListeners) {
      listener();
    }
  }

  private toCssColor(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }
}

