import { ITEM_DEFINITIONS, type ItemId } from "../data/items";

export interface UnloaderGuiView {
  gridX: number;
  gridY: number;
  filters: Array<ItemId | null>;
  sourceConnected: boolean;
  outputBufferCount: number;
  outputBufferCapacity: number;
  cycleSeconds: number;
}

export interface UnloaderFilterChangeRequest {
  slotIndex: number;
  itemId: ItemId | null;
}

type UnloaderFilterChangeListener = (request: UnloaderFilterChangeRequest) => void;
type UnloaderCloseListener = () => void;

export class UnloaderGui {
  private readonly overlay: HTMLDivElement;
  private readonly positionLine: HTMLDivElement;
  private readonly sourceLine: HTMLDivElement;
  private readonly throughputLine: HTMLDivElement;
  private readonly filtersRoot: HTMLDivElement;
  private readonly filterRows: HTMLDivElement[] = [];
  private readonly filterSelects: HTMLSelectElement[] = [];
  private readonly filterListeners: UnloaderFilterChangeListener[] = [];
  private readonly closeListeners: UnloaderCloseListener[] = [];
  private suppressChangeEvents = false;
  private open = false;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement("div");
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.display = "none";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.background = "rgba(4, 10, 16, 0.42)";
    this.overlay.style.pointerEvents = "auto";
    this.overlay.style.zIndex = "19";

    const windowRoot = document.createElement("div");
    windowRoot.style.display = "flex";
    windowRoot.style.flexDirection = "column";
    windowRoot.style.gap = "10px";
    windowRoot.style.width = "min(420px, calc(100vw - 24px))";
    windowRoot.style.padding = "12px";
    windowRoot.style.boxSizing = "border-box";
    windowRoot.style.borderRadius = "12px";
    windowRoot.style.border = "1px solid #3a4758";
    windowRoot.style.background = "rgba(8, 13, 20, 0.97)";
    windowRoot.style.color = "#dce7f3";
    windowRoot.style.font = "12px/1.4 monospace";
    this.overlay.appendChild(windowRoot);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.paddingBottom = "8px";
    header.style.borderBottom = "1px solid #273646";
    windowRoot.appendChild(header);

    const title = document.createElement("div");
    title.style.font = "14px/1.2 monospace";
    title.style.color = "#e4edf7";
    title.textContent = "Unloader Filters";
    header.appendChild(title);

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

    this.sourceLine = document.createElement("div");
    this.sourceLine.style.color = "#9cb0c4";
    this.sourceLine.textContent = "Source: -";
    windowRoot.appendChild(this.sourceLine);

    this.throughputLine = document.createElement("div");
    this.throughputLine.style.color = "#9cb0c4";
    this.throughputLine.textContent = "Buffer: -";
    windowRoot.appendChild(this.throughputLine);

    const hint = document.createElement("div");
    hint.style.color = "#8da3b8";
    hint.style.font = "11px/1.35 monospace";
    hint.textContent = "If all filters are empty, unloader takes any item.";
    windowRoot.appendChild(hint);

    this.filtersRoot = document.createElement("div");
    this.filtersRoot.style.display = "flex";
    this.filtersRoot.style.flexDirection = "column";
    this.filtersRoot.style.gap = "8px";
    windowRoot.appendChild(this.filtersRoot);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.emitClose();
      }
    });

    parent.appendChild(this.overlay);
  }

  setView(view: UnloaderGuiView | null): void {
    this.open = view !== null;
    this.overlay.style.display = this.open ? "flex" : "none";
    if (!view) {
      return;
    }

    this.positionLine.textContent = `Cell: (${view.gridX}, ${view.gridY})`;
    this.sourceLine.textContent = `Source: ${view.sourceConnected ? "Container Connected" : "No Container Behind"}`;
    this.sourceLine.style.color = view.sourceConnected ? "#9fd8a8" : "#d89f9f";
    this.throughputLine.textContent =
      `Buffer: ${view.outputBufferCount} / ${view.outputBufferCapacity} | Tick: ${view.cycleSeconds.toFixed(2)}s`;

    this.ensureFilterSlotCount(view.filters.length);
    this.suppressChangeEvents = true;
    for (let i = 0; i < view.filters.length; i += 1) {
      const select = this.filterSelects[i];
      if (!select) {
        continue;
      }
      const itemId = view.filters[i];
      select.value = itemId ?? "__any__";
    }
    this.suppressChangeEvents = false;
  }

  isOpen(): boolean {
    return this.open;
  }

  onFilterChange(listener: UnloaderFilterChangeListener): () => void {
    this.filterListeners.push(listener);
    return () => {
      const index = this.filterListeners.indexOf(listener);
      if (index >= 0) {
        this.filterListeners.splice(index, 1);
      }
    };
  }

  onClose(listener: UnloaderCloseListener): () => void {
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
    this.filterRows.length = 0;
    this.filterSelects.length = 0;
    this.filterListeners.length = 0;
    this.closeListeners.length = 0;
  }

  private ensureFilterSlotCount(slotCount: number): void {
    if (this.filterSelects.length === slotCount) {
      return;
    }

    this.filterRows.length = 0;
    this.filterSelects.length = 0;
    this.filtersRoot.replaceChildren();

    for (let i = 0; i < slotCount; i += 1) {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "74px 1fr";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.border = "1px solid #324356";
      row.style.borderRadius = "8px";
      row.style.padding = "8px";
      row.style.background = "rgba(11, 16, 24, 0.86)";

      const label = document.createElement("div");
      label.style.color = "#c8d7e6";
      label.style.font = "11px/1.2 monospace";
      label.textContent = `Filter #${i + 1}`;
      row.appendChild(label);

      const select = document.createElement("select");
      select.style.border = "1px solid #3f5062";
      select.style.borderRadius = "6px";
      select.style.background = "#101a26";
      select.style.color = "#dce8f5";
      select.style.font = "11px/1.2 monospace";
      select.style.padding = "6px";
      select.style.width = "100%";
      this.populateItemOptions(select);
      select.addEventListener("change", () => {
        if (this.suppressChangeEvents) {
          return;
        }
        const value = select.value;
        this.emitFilterChange({
          slotIndex: i,
          itemId: value === "__any__" ? null : (value as ItemId),
        });
      });
      row.appendChild(select);

      this.filterRows.push(row);
      this.filterSelects.push(select);
      this.filtersRoot.appendChild(row);
    }
  }

  private populateItemOptions(select: HTMLSelectElement): void {
    const anyOption = document.createElement("option");
    anyOption.value = "__any__";
    anyOption.textContent = "Any Item";
    select.appendChild(anyOption);

    const definitions = Object.values(ITEM_DEFINITIONS).sort((a, b) => a.name.localeCompare(b.name));
    for (const definition of definitions) {
      const option = document.createElement("option");
      option.value = definition.id;
      option.textContent = definition.name;
      select.appendChild(option);
    }
  }

  private emitFilterChange(request: UnloaderFilterChangeRequest): void {
    for (const listener of this.filterListeners) {
      listener(request);
    }
  }

  private emitClose(): void {
    for (const listener of this.closeListeners) {
      listener();
    }
  }
}

