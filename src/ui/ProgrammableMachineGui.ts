import { getItemDefinition } from "../data/items";
import { ProgrammableMachine } from "../entities/ProgrammableMachine";
import type { InventorySlotStack } from "../entities/PlayerInventory";
import type { MachineTransferMode } from "./HUD";

export interface ProgrammableMachineGuiView {
  gridX: number;
  gridY: number;
  outputDirection: "up" | "right" | "down" | "left";
  inputSlots: Array<InventorySlotStack | null>;
  inputTotalCount: number;
  inputCapacity: number;
  outputSlots: Array<InventorySlotStack | null>;
  outputCount: number;
  outputCapacity: number;
  programSource: string;
  programVersion: number;
  activeProgramVersion: number | null;
  compileError: string | null;
  runtimeError: string | null;
  statusText: string;
}

export interface ProgrammableMachineTakeSlotRequest {
  section: "input" | "output";
  slotIndex: number;
  mode: MachineTransferMode;
}

export interface ProgrammableMachineApplyRequest {
  source: string;
}

type TakeSlotListener = (request: ProgrammableMachineTakeSlotRequest) => void;
type ApplyListener = (request: ProgrammableMachineApplyRequest) => void;
type CloseListener = () => void;

interface SlotView {
  root: HTMLButtonElement;
  swatch: HTMLDivElement;
  name: HTMLDivElement;
  count: HTMLDivElement;
}

export class ProgrammableMachineGui {
  private readonly overlay: HTMLDivElement;
  private readonly positionLine: HTMLDivElement;
  private readonly runtimeLine: HTMLDivElement;
  private readonly bufferLine: HTMLDivElement;
  private readonly programLine: HTMLDivElement;
  private readonly inputSlotsRoot: HTMLDivElement;
  private readonly outputSlotsRoot: HTMLDivElement;
  private readonly sourceEditor: HTMLTextAreaElement;
  private readonly applyButton: HTMLButtonElement;
  private readonly editorHintLine: HTMLDivElement;

  private readonly takeSlotListeners: TakeSlotListener[] = [];
  private readonly applyListeners: ApplyListener[] = [];
  private readonly closeListeners: CloseListener[] = [];
  private readonly inputSlotViews: SlotView[] = [];
  private readonly outputSlotViews: SlotView[] = [];

  private open = false;
  private syncedProgramVersion: number | null = null;
  private syncedMachineKey: string | null = null;
  private syncedSource = "";
  private isDirty = false;
  private lastCompileError: string | null = null;
  private lastRuntimeError: string | null = null;
  private lastActiveProgramVersion: number | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement("div");
    this.overlay.style.position = "fixed";
    this.overlay.style.inset = "0";
    this.overlay.style.display = "none";
    this.overlay.style.alignItems = "center";
    this.overlay.style.justifyContent = "center";
    this.overlay.style.background = "rgba(5, 9, 15, 0.58)";
    this.overlay.style.backdropFilter = "blur(3px)";
    this.overlay.style.pointerEvents = "auto";
    this.overlay.style.zIndex = "19";

    const windowRoot = document.createElement("div");
    windowRoot.style.display = "grid";
    windowRoot.style.gridTemplateColumns = "minmax(300px, 360px) minmax(420px, 1fr)";
    windowRoot.style.gap = "14px";
    windowRoot.style.width = "min(1180px, calc(100vw - 24px))";
    windowRoot.style.maxHeight = "calc(100vh - 24px)";
    windowRoot.style.padding = "14px";
    windowRoot.style.boxSizing = "border-box";
    windowRoot.style.borderRadius = "16px";
    windowRoot.style.border = "1px solid rgba(91, 128, 171, 0.52)";
    windowRoot.style.background =
      "linear-gradient(180deg, rgba(8, 14, 23, 0.98) 0%, rgba(7, 11, 19, 0.98) 100%)";
    windowRoot.style.color = "#dce8f5";
    windowRoot.style.font = "12px/1.4 monospace";
    windowRoot.style.overflow = "auto";
    this.overlay.appendChild(windowRoot);

    const leftColumn = document.createElement("div");
    leftColumn.style.display = "flex";
    leftColumn.style.flexDirection = "column";
    leftColumn.style.gap = "10px";
    windowRoot.appendChild(leftColumn);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.flexDirection = "column";
    header.style.gap = "6px";
    header.style.padding = "12px";
    header.style.border = "1px solid rgba(76, 108, 145, 0.42)";
    header.style.borderRadius = "12px";
    header.style.background = "rgba(10, 18, 29, 0.9)";
    leftColumn.appendChild(header);

    const titleLine = document.createElement("div");
    titleLine.style.font = "16px/1.1 monospace";
    titleLine.style.color = "#eef6ff";
    titleLine.textContent = "Programmable Machine";
    header.appendChild(titleLine);

    this.positionLine = document.createElement("div");
    this.positionLine.style.color = "#9cb4cb";
    this.positionLine.textContent = "Cell: -";
    header.appendChild(this.positionLine);

    this.runtimeLine = document.createElement("div");
    this.runtimeLine.style.color = "#9fd2ae";
    this.runtimeLine.textContent = "Runtime: -";
    header.appendChild(this.runtimeLine);

    this.bufferLine = document.createElement("div");
    this.bufferLine.style.color = "#9cb4cb";
    this.bufferLine.textContent = "Buffers: -";
    header.appendChild(this.bufferLine);

    this.programLine = document.createElement("div");
    this.programLine.style.color = "#9cb4cb";
    this.programLine.textContent = "Program: -";
    header.appendChild(this.programLine);

    const inputPanel = this.createSlotsPanel(leftColumn, "Input Buffer", "Items accepted from belts or manual insert.");
    this.inputSlotsRoot = inputPanel.slotsRoot;

    const outputPanel = this.createSlotsPanel(leftColumn, "Output Queue", "Items waiting for belt pickup or manual take.");
    this.outputSlotsRoot = outputPanel.slotsRoot;

    const rightColumn = document.createElement("div");
    rightColumn.style.display = "flex";
    rightColumn.style.flexDirection = "column";
    rightColumn.style.gap = "10px";
    windowRoot.appendChild(rightColumn);

    const editorPanel = document.createElement("div");
    editorPanel.style.display = "flex";
    editorPanel.style.flexDirection = "column";
    editorPanel.style.gap = "10px";
    editorPanel.style.minHeight = "520px";
    editorPanel.style.border = "1px solid rgba(76, 108, 145, 0.42)";
    editorPanel.style.borderRadius = "12px";
    editorPanel.style.padding = "12px";
    editorPanel.style.background = "rgba(9, 15, 24, 0.9)";
    rightColumn.appendChild(editorPanel);

    const editorHeader = document.createElement("div");
    editorHeader.style.display = "flex";
    editorHeader.style.justifyContent = "space-between";
    editorHeader.style.alignItems = "center";
    editorHeader.style.gap = "8px";
    editorPanel.appendChild(editorHeader);

    const editorTitle = document.createElement("div");
    editorTitle.style.color = "#eef6ff";
    editorTitle.style.font = "14px/1.2 monospace";
    editorTitle.textContent = "Live Script";
    editorHeader.appendChild(editorTitle);

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.flexWrap = "wrap";
    buttonRow.style.gap = "8px";
    editorHeader.appendChild(buttonRow);

    this.applyButton = this.createActionButton("Apply");
    this.applyButton.addEventListener("click", () => this.emitApply());
    buttonRow.appendChild(this.applyButton);

    const resetButton = this.createActionButton("Reset Example");
    resetButton.addEventListener("click", () => {
      this.sourceEditor.value = ProgrammableMachine.defaultProgramSource;
      this.isDirty = true;
      this.updateEditorHint();
      this.emitApply();
    });
    buttonRow.appendChild(resetButton);

    const closeButton = this.createActionButton("Close");
    closeButton.addEventListener("click", () => this.emitClose());
    buttonRow.appendChild(closeButton);

    this.editorHintLine = document.createElement("div");
    this.editorHintLine.style.color = "#9cb4cb";
    this.editorHintLine.textContent = "Apply with Ctrl+Enter. Avoid infinite loops: script runs on the main sim thread.";
    editorPanel.appendChild(this.editorHintLine);

    this.sourceEditor = document.createElement("textarea");
    this.sourceEditor.spellcheck = false;
    this.sourceEditor.wrap = "off";
    this.sourceEditor.style.flex = "1 1 auto";
    this.sourceEditor.style.width = "100%";
    this.sourceEditor.style.minHeight = "320px";
    this.sourceEditor.style.resize = "vertical";
    this.sourceEditor.style.boxSizing = "border-box";
    this.sourceEditor.style.border = "1px solid rgba(74, 108, 145, 0.5)";
    this.sourceEditor.style.borderRadius = "10px";
    this.sourceEditor.style.background = "#08111c";
    this.sourceEditor.style.color = "#deecfb";
    this.sourceEditor.style.font = "12px/1.45 monospace";
    this.sourceEditor.style.padding = "10px";
    this.sourceEditor.style.outline = "none";
    this.sourceEditor.addEventListener("input", () => {
      this.isDirty = this.sourceEditor.value !== this.syncedSource;
      this.updateEditorHint();
    });
    this.sourceEditor.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        this.emitApply();
      }
      event.stopPropagation();
    });
    editorPanel.appendChild(this.sourceEditor);

    const apiPanel = document.createElement("div");
    apiPanel.style.display = "flex";
    apiPanel.style.flexDirection = "column";
    apiPanel.style.gap = "8px";
    apiPanel.style.border = "1px solid rgba(76, 108, 145, 0.42)";
    apiPanel.style.borderRadius = "12px";
    apiPanel.style.padding = "12px";
    apiPanel.style.background = "rgba(9, 15, 24, 0.9)";
    rightColumn.appendChild(apiPanel);

    const apiTitle = document.createElement("div");
    apiTitle.style.color = "#eef6ff";
    apiTitle.style.font = "13px/1.2 monospace";
    apiTitle.textContent = "API";
    apiPanel.appendChild(apiTitle);

    const apiText = document.createElement("pre");
    apiText.style.margin = "0";
    apiText.style.whiteSpace = "pre-wrap";
    apiText.style.wordBreak = "break-word";
    apiText.style.color = "#a7bfd6";
    apiText.style.font = "11px/1.45 monospace";
    apiText.textContent =
      `api.count(itemId)
api.has(itemId, count?)
api.items()
api.queued()
api.queueSpace()
api.send(itemId, count?)
api.convert({ in }, { out })
api.setOutput(direction)
api.getOutput()
api.every(seconds, key?)
api.setStatus(text)
api.getTick(), api.getTime(), api.getDelta()

Persistent state lives in the \`state\` object.
Browser globals, Date and Math.random are intentionally unavailable.`;
    apiPanel.appendChild(apiText);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.emitClose();
      }
    });

    parent.appendChild(this.overlay);
  }

  setView(view: ProgrammableMachineGuiView | null): void {
    this.open = view !== null;
    this.overlay.style.display = this.open ? "flex" : "none";
    if (!view) {
      return;
    }

    const machineKey = `${view.gridX}:${view.gridY}`;
    const machineChanged = machineKey !== this.syncedMachineKey;
    const versionChanged = view.programVersion !== this.syncedProgramVersion;
    if (machineChanged || versionChanged || !this.isDirty) {
      this.sourceEditor.value = view.programSource;
      this.syncedSource = view.programSource;
      this.syncedProgramVersion = view.programVersion;
      this.syncedMachineKey = machineKey;
      this.isDirty = false;
    }

    this.positionLine.textContent =
      `Cell: (${view.gridX}, ${view.gridY}) | Output: ${view.outputDirection.toUpperCase()}`;
    this.runtimeLine.textContent = `Runtime: ${view.statusText}`;
    this.runtimeLine.style.color = view.runtimeError
      ? "#ef9a9a"
      : view.compileError
        ? "#f2d493"
        : "#9fd2ae";
    this.bufferLine.textContent =
      `Buffers: input ${view.inputTotalCount}/${view.inputCapacity} | output ${view.outputCount}/${view.outputCapacity}`;
    this.programLine.textContent =
      view.activeProgramVersion !== null
        ? `Program: edit v${view.programVersion} | running build v${view.activeProgramVersion}`
        : `Program: edit v${view.programVersion} | no runnable build`;

    this.lastCompileError = view.compileError;
    this.lastRuntimeError = view.runtimeError;
    this.lastActiveProgramVersion = view.activeProgramVersion;
    this.updateEditorHint();

    this.ensureSlotViews(this.inputSlotsRoot, this.inputSlotViews, view.inputSlots.length, "input");
    for (let i = 0; i < view.inputSlots.length; i += 1) {
      const slotView = this.inputSlotViews[i];
      if (!slotView) {
        continue;
      }
      this.renderSlot(slotView, view.inputSlots[i] ?? null);
    }

    this.ensureSlotViews(this.outputSlotsRoot, this.outputSlotViews, view.outputSlots.length, "output");
    for (let i = 0; i < view.outputSlots.length; i += 1) {
      const slotView = this.outputSlotViews[i];
      if (!slotView) {
        continue;
      }
      this.renderSlot(slotView, view.outputSlots[i] ?? null);
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  onTakeSlot(listener: TakeSlotListener): () => void {
    this.takeSlotListeners.push(listener);
    return () => {
      const index = this.takeSlotListeners.indexOf(listener);
      if (index >= 0) {
        this.takeSlotListeners.splice(index, 1);
      }
    };
  }

  onApply(listener: ApplyListener): () => void {
    this.applyListeners.push(listener);
    return () => {
      const index = this.applyListeners.indexOf(listener);
      if (index >= 0) {
        this.applyListeners.splice(index, 1);
      }
    };
  }

  onClose(listener: CloseListener): () => void {
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
    this.applyListeners.length = 0;
    this.closeListeners.length = 0;
    this.inputSlotViews.length = 0;
    this.outputSlotViews.length = 0;
  }

  private createSlotsPanel(
    parent: HTMLElement,
    title: string,
    hint: string
  ): { slotsRoot: HTMLDivElement } {
    const panel = document.createElement("div");
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "8px";
    panel.style.padding = "12px";
    panel.style.border = "1px solid rgba(76, 108, 145, 0.42)";
    panel.style.borderRadius = "12px";
    panel.style.background = "rgba(10, 18, 29, 0.9)";
    parent.appendChild(panel);

    const titleLine = document.createElement("div");
    titleLine.style.color = "#eef6ff";
    titleLine.style.font = "13px/1.2 monospace";
    titleLine.textContent = title;
    panel.appendChild(titleLine);

    const hintLine = document.createElement("div");
    hintLine.style.color = "#8ea7bf";
    hintLine.style.font = "11px/1.3 monospace";
    hintLine.textContent = `${hint} Shift: half, Ctrl: one`;
    panel.appendChild(hintLine);

    const slotsRoot = document.createElement("div");
    slotsRoot.style.display = "grid";
    slotsRoot.style.gridTemplateColumns = "repeat(auto-fill, minmax(78px, 1fr))";
    slotsRoot.style.gap = "7px";
    panel.appendChild(slotsRoot);

    return { slotsRoot };
  }

  private createActionButton(label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.style.border = "1px solid rgba(119, 156, 196, 0.55)";
    button.style.borderRadius = "8px";
    button.style.background = "linear-gradient(180deg, rgba(30, 50, 72, 0.96), rgba(20, 34, 52, 0.96))";
    button.style.color = "#deebf9";
    button.style.font = "11px/1.1 monospace";
    button.style.padding = "7px 10px";
    button.style.cursor = "pointer";
    button.textContent = label;
    return button;
  }

  private ensureSlotViews(
    root: HTMLDivElement,
    target: SlotView[],
    count: number,
    section: "input" | "output"
  ): void {
    if (target.length === count) {
      return;
    }

    target.length = 0;
    root.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const slotView = this.createSlotView(section, i);
      target.push(slotView);
      root.appendChild(slotView.root);
    }
  }

  private createSlotView(section: "input" | "output", slotIndex: number): SlotView {
    const root = document.createElement("button");
    root.type = "button";
    root.style.border = "1px solid rgba(61, 87, 116, 0.78)";
    root.style.borderRadius = "10px";
    root.style.background = "linear-gradient(180deg, rgba(15, 24, 37, 0.92), rgba(10, 18, 29, 0.96))";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.justifyContent = "space-between";
    root.style.minHeight = "74px";
    root.style.padding = "6px";
    root.style.cursor = "pointer";
    root.style.color = "#dce8f5";
    root.style.font = "10px/1.25 monospace";
    root.style.textAlign = "left";
    root.title = "Take items";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";
    root.appendChild(top);

    const indexLabel = document.createElement("div");
    indexLabel.style.color = "#7f96ae";
    indexLabel.textContent = `${slotIndex + 1}`;
    top.appendChild(indexLabel);

    const swatch = document.createElement("div");
    swatch.style.width = "12px";
    swatch.style.height = "12px";
    swatch.style.borderRadius = "3px";
    swatch.style.display = "none";
    top.appendChild(swatch);

    const name = document.createElement("div");
    name.style.color = "#9fb6cc";
    name.style.wordBreak = "break-word";
    name.style.minHeight = "24px";
    root.appendChild(name);

    const count = document.createElement("div");
    count.style.color = "#e6f1fb";
    count.style.textAlign = "right";
    root.appendChild(count);

    const onClick = (event: MouseEvent): void => {
      event.preventDefault();
      this.emitTakeSlot({
        section,
        slotIndex,
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

  private renderSlot(view: SlotView, stack: InventorySlotStack | null): void {
    if (!stack) {
      view.root.disabled = true;
      view.root.style.opacity = "0.65";
      view.root.style.borderColor = "rgba(61, 87, 116, 0.78)";
      view.swatch.style.display = "none";
      view.name.textContent = "Empty";
      view.count.textContent = "";
      return;
    }

    const definition = getItemDefinition(stack.itemId);
    const color = this.toCssColor(definition.color);
    view.root.disabled = false;
    view.root.style.opacity = "1";
    view.root.style.borderColor = color;
    view.swatch.style.display = "block";
    view.swatch.style.background = color;
    view.name.textContent = definition.name;
    view.count.textContent = `x${stack.count}`;
  }

  private updateEditorHint(): void {
    if (this.isDirty) {
      this.editorHintLine.style.color = "#f2d493";
      this.editorHintLine.textContent = "Draft changed locally. Apply with Ctrl+Enter or the Apply button.";
      this.applyButton.textContent = "Apply*";
      return;
    }

    this.applyButton.textContent = "Apply";

    if (this.lastCompileError) {
      this.editorHintLine.style.color = "#f2d493";
      this.editorHintLine.textContent =
        this.lastActiveProgramVersion !== null
          ? `Compile error: ${this.lastCompileError}. Previous runnable build is still active.`
          : `Compile error: ${this.lastCompileError}`;
      return;
    }

    if (this.lastRuntimeError) {
      this.editorHintLine.style.color = "#ef9a9a";
      this.editorHintLine.textContent = `Runtime error: ${this.lastRuntimeError}`;
      return;
    }

    this.editorHintLine.style.color = "#9cb4cb";
    this.editorHintLine.textContent = "Apply with Ctrl+Enter. Avoid infinite loops: script runs on the main sim thread.";
  }

  private emitTakeSlot(request: ProgrammableMachineTakeSlotRequest): void {
    for (const listener of this.takeSlotListeners) {
      listener(request);
    }
  }

  private emitApply(): void {
    for (const listener of this.applyListeners) {
      listener({
        source: this.sourceEditor.value,
      });
    }
  }

  private emitClose(): void {
    for (const listener of this.closeListeners) {
      listener();
    }
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

  private toCssColor(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }
}
