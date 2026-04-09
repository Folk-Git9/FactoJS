import { getItemDefinition } from "../data/items";
import type { InventorySlotStack } from "../entities/PlayerInventory";
import type { CraftRecipeView, MachineTransferMode } from "./HUD";

export interface ContainerGuiView {
  title?: string;
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
  private readonly capacityBarFill: HTMLDivElement;
  private readonly slotGrid: HTMLDivElement;
  private readonly recipesRoot: HTMLDivElement;
  private readonly slotViews: ContainerSlotView[] = [];
  private readonly craftRows = new Map<string, ContainerCraftRowView>();
  private readonly takeSlotListeners: ContainerTakeSlotListener[] = [];
  private readonly craftListeners: ContainerCraftRequestListener[] = [];
  private readonly closeListeners: ContainerCloseListener[] = [];

  private isOpenFlag = false;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement("div");
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.display = "none";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.background = "radial-gradient(circle at 50% 30%, rgba(20, 36, 54, 0.52), rgba(5, 9, 14, 0.82))";
    this.overlay.style.backdropFilter = "blur(3px)";
    this.overlay.style.pointerEvents = "auto";
    this.overlay.style.zIndex = "19";

    const windowRoot = document.createElement("div");
    windowRoot.style.display = "flex";
    windowRoot.style.flexDirection = "column";
    windowRoot.style.gap = "14px";
    windowRoot.style.width = "min(1040px, calc(100vw - 24px))";
    windowRoot.style.maxHeight = "calc(100vh - 24px)";
    windowRoot.style.padding = "14px";
    windowRoot.style.boxSizing = "border-box";
    windowRoot.style.borderRadius = "16px";
    windowRoot.style.border = "1px solid rgba(102, 148, 194, 0.46)";
    windowRoot.style.background =
      "linear-gradient(180deg, rgba(9, 17, 27, 0.98) 0%, rgba(7, 13, 21, 0.98) 100%)";
    windowRoot.style.boxShadow = "0 24px 68px rgba(0, 0, 0, 0.42)";
    windowRoot.style.color = "#dbe8f5";
    windowRoot.style.font = "12px/1.4 monospace";
    windowRoot.style.overflow = "auto";
    this.overlay.appendChild(windowRoot);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.paddingBottom = "10px";
    header.style.borderBottom = "1px solid rgba(78, 107, 138, 0.45)";
    windowRoot.appendChild(header);

    const headerLeft = document.createElement("div");
    headerLeft.style.display = "flex";
    headerLeft.style.flexDirection = "column";
    headerLeft.style.gap = "4px";
    header.appendChild(headerLeft);

    this.titleLine = document.createElement("div");
    this.titleLine.style.font = "16px/1.1 monospace";
    this.titleLine.style.letterSpacing = "0.3px";
    this.titleLine.style.color = "#eff7ff";
    this.titleLine.textContent = "Container";
    headerLeft.appendChild(this.titleLine);

    this.positionLine = document.createElement("div");
    this.positionLine.style.color = "#9bb4cb";
    this.positionLine.style.font = "11px/1.2 monospace";
    this.positionLine.textContent = "Position: -";
    headerLeft.appendChild(this.positionLine);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.style.border = "1px solid rgba(128, 168, 210, 0.55)";
    closeButton.style.borderRadius = "8px";
    closeButton.style.background = "linear-gradient(180deg, rgba(28, 48, 69, 0.95), rgba(20, 35, 53, 0.95))";
    closeButton.style.color = "#dbe9f7";
    closeButton.style.font = "11px/1 monospace";
    closeButton.style.padding = "7px 11px";
    closeButton.style.cursor = "pointer";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => this.emitClose());
    header.appendChild(closeButton);

    const capacityPanel = document.createElement("div");
    capacityPanel.style.display = "flex";
    capacityPanel.style.flexDirection = "column";
    capacityPanel.style.gap = "6px";
    capacityPanel.style.border = "1px solid rgba(78, 107, 138, 0.4)";
    capacityPanel.style.borderRadius = "10px";
    capacityPanel.style.padding = "10px";
    capacityPanel.style.background = "rgba(10, 19, 31, 0.8)";
    windowRoot.appendChild(capacityPanel);

    this.capacityLine = document.createElement("div");
    this.capacityLine.style.color = "#c4d6ea";
    this.capacityLine.textContent = "Stored: 0 / 0";
    capacityPanel.appendChild(this.capacityLine);

    const capacityBarTrack = document.createElement("div");
    capacityBarTrack.style.height = "7px";
    capacityBarTrack.style.borderRadius = "999px";
    capacityBarTrack.style.overflow = "hidden";
    capacityBarTrack.style.background = "rgba(53, 77, 103, 0.8)";
    capacityPanel.appendChild(capacityBarTrack);

    this.capacityBarFill = document.createElement("div");
    this.capacityBarFill.style.width = "0%";
    this.capacityBarFill.style.height = "100%";
    this.capacityBarFill.style.background = "linear-gradient(90deg, #62b3ff, #8edbff)";
    capacityBarTrack.appendChild(this.capacityBarFill);

    const content = document.createElement("div");
    content.style.display = "grid";
    content.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
    content.style.gap = "12px";
    windowRoot.appendChild(content);

    const slotsPanel = document.createElement("div");
    slotsPanel.style.display = "flex";
    slotsPanel.style.flexDirection = "column";
    slotsPanel.style.gap = "8px";
    slotsPanel.style.border = "1px solid rgba(78, 107, 138, 0.42)";
    slotsPanel.style.borderRadius = "12px";
    slotsPanel.style.padding = "10px";
    slotsPanel.style.background =
      "linear-gradient(180deg, rgba(11, 19, 31, 0.85) 0%, rgba(9, 15, 25, 0.9) 100%)";
    content.appendChild(slotsPanel);

    const slotsTitle = document.createElement("div");
    slotsTitle.style.color = "#e5f0fa";
    slotsTitle.style.font = "13px/1.2 monospace";
    slotsTitle.textContent = "Storage Slots";
    slotsPanel.appendChild(slotsTitle);

    const slotsHint = document.createElement("div");
    slotsHint.style.color = "#8ea7bf";
    slotsHint.style.font = "11px/1.3 monospace";
    slotsHint.textContent = "LMB/RMB: take all, Shift: half, Ctrl: one";
    slotsPanel.appendChild(slotsHint);

    this.slotGrid = document.createElement("div");
    this.slotGrid.style.display = "grid";
    this.slotGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(82px, 1fr))";
    this.slotGrid.style.gap = "7px";
    slotsPanel.appendChild(this.slotGrid);

    const craftPanel = document.createElement("div");
    craftPanel.style.display = "flex";
    craftPanel.style.flexDirection = "column";
    craftPanel.style.gap = "8px";
    craftPanel.style.border = "1px solid rgba(78, 107, 138, 0.42)";
    craftPanel.style.borderRadius = "12px";
    craftPanel.style.padding = "10px";
    craftPanel.style.background =
      "linear-gradient(180deg, rgba(12, 22, 34, 0.88) 0%, rgba(9, 17, 28, 0.9) 100%)";
    content.appendChild(craftPanel);

    const craftTitle = document.createElement("div");
    craftTitle.style.color = "#e5f0fa";
    craftTitle.style.font = "13px/1.2 monospace";
    craftTitle.textContent = "Crafting Queue";
    craftPanel.appendChild(craftTitle);

    const craftHint = document.createElement("div");
    craftHint.style.color = "#8ea7bf";
    craftHint.style.font = "11px/1.3 monospace";
    craftHint.textContent = "Uses resources from this container";
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
    this.isOpenFlag = view !== null;
    this.overlay.style.display = this.isOpenFlag ? "flex" : "none";

    if (!view) {
      return;
    }

    this.titleLine.textContent = view.title ?? "Container";
    this.positionLine.textContent = `Position: (${view.gridX}, ${view.gridY})`;
    this.capacityLine.textContent =
      `Stored: ${view.totalCount} / ${view.totalCapacity} | Max stack: ${view.maxStackPerSlot}`;
    const fill01 = view.totalCapacity > 0 ? Math.min(Math.max(view.totalCount / view.totalCapacity, 0), 1) : 0;
    this.capacityBarFill.style.width = `${(fill01 * 100).toFixed(1)}%`;

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
      row.button.disabled = false;
      row.button.textContent = recipe.canCraft ? "Craft" : "Missing";
      row.button.style.opacity = recipe.canCraft ? "1" : "0.7";
      row.root.style.borderColor = recipe.canCraft ? "rgba(102, 154, 202, 0.56)" : "rgba(69, 84, 101, 0.65)";
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
    root.style.border = "1px solid rgba(63, 86, 111, 0.75)";
    root.style.borderRadius = "10px";
    root.style.background = "linear-gradient(180deg, rgba(15, 25, 38, 0.92), rgba(10, 18, 30, 0.96))";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.justifyContent = "space-between";
    root.style.alignItems = "stretch";
    root.style.padding = "6px";
    root.style.minHeight = "78px";
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
    indexLabel.style.color = "#7f96ae";
    indexLabel.style.font = "10px/1 monospace";
    indexLabel.textContent = `${index + 1}`;
    top.appendChild(indexLabel);

    const swatch = document.createElement("div");
    swatch.style.width = "12px";
    swatch.style.height = "12px";
    swatch.style.borderRadius = "3px";
    swatch.style.display = "none";
    top.appendChild(swatch);

    const name = document.createElement("div");
    name.style.color = "#9fb6cc";
    name.style.font = "10px/1.2 monospace";
    name.style.wordBreak = "break-word";
    name.style.minHeight = "26px";
    name.textContent = "";
    root.appendChild(name);

    const count = document.createElement("div");
    count.style.color = "#e6f1fb";
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
      view.root.style.borderColor = "rgba(63, 86, 111, 0.75)";
      view.root.style.background = "linear-gradient(180deg, rgba(15, 25, 38, 0.92), rgba(10, 18, 30, 0.96))";
      view.root.disabled = true;
      view.root.style.opacity = "0.7";
      view.swatch.style.display = "none";
      view.name.textContent = "Empty";
      view.count.textContent = "";
      return;
    }

    const definition = getItemDefinition(stack.itemId);
    const color = this.toCssColor(definition.color);
    view.root.style.borderColor = color;
    view.root.style.background = "linear-gradient(180deg, rgba(16, 28, 43, 0.95), rgba(10, 20, 33, 0.98))";
    view.root.disabled = false;
    view.root.style.opacity = "1";
    view.swatch.style.display = "block";
    view.swatch.style.background = color;
    view.name.textContent = definition.name;
    view.count.textContent = `${stack.count} / ${maxStack}`;
  }

  private createCraftRow(recipeId: string): ContainerCraftRowView {
    const root = document.createElement("div");
    root.style.border = "1px solid rgba(69, 84, 101, 0.65)";
    root.style.borderRadius = "9px";
    root.style.background = "linear-gradient(180deg, rgba(15, 26, 39, 0.88), rgba(10, 19, 31, 0.9))";
    root.style.padding = "8px";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "6px";

    const title = document.createElement("div");
    title.style.color = "#e2edf8";
    title.style.font = "12px/1.2 monospace";
    root.appendChild(title);

    const details = document.createElement("div");
    details.style.color = "#95afc7";
    details.style.font = "11px/1.3 monospace";
    details.style.wordBreak = "break-word";
    root.appendChild(details);

    const button = document.createElement("button");
    button.type = "button";
    button.style.alignSelf = "flex-start";
    button.style.border = "1px solid rgba(128, 168, 210, 0.58)";
    button.style.borderRadius = "7px";
    button.style.background = "linear-gradient(180deg, rgba(32, 55, 79, 0.95), rgba(22, 40, 61, 0.95))";
    button.style.color = "#deecfa";
    button.style.font = "11px/1.2 monospace";
    button.style.padding = "5px 9px";
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
