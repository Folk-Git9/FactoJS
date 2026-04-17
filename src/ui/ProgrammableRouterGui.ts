import { Router } from "../entities/Router";

export interface ProgrammableRouterGuiView {
  gridX: number;
  gridY: number;
  direction: "up" | "right" | "down" | "left";
  storedItem: string | null;
  storedProgress: number;
  inputSide: "up" | "right" | "down" | "left";
  programSource: string;
  programVersion: number;
  activeProgramVersion: number | null;
  compileError: string | null;
  runtimeError: string | null;
  statusText: string;
  lastDecisionItem: string | null;
  lastDecisionInputSide: "up" | "right" | "down" | "left" | null;
  lastDecisionOutputs: Array<"up" | "right" | "down" | "left">;
}

export interface ProgrammableRouterApplyRequest {
  source: string;
}

type ApplyListener = (request: ProgrammableRouterApplyRequest) => void;
type CloseListener = () => void;

export class ProgrammableRouterGui {
  private readonly overlay: HTMLDivElement;
  private readonly positionLine: HTMLDivElement;
  private readonly runtimeLine: HTMLDivElement;
  private readonly carryingLine: HTMLDivElement;
  private readonly routeLine: HTMLDivElement;
  private readonly programLine: HTMLDivElement;
  private readonly sourceEditor: HTMLTextAreaElement;
  private readonly applyButton: HTMLButtonElement;
  private readonly editorHintLine: HTMLDivElement;

  private readonly applyListeners: ApplyListener[] = [];
  private readonly closeListeners: CloseListener[] = [];

  private open = false;
  private syncedProgramVersion: number | null = null;
  private syncedRouterKey: string | null = null;
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
    windowRoot.style.gridTemplateColumns = "minmax(280px, 340px) minmax(420px, 1fr)";
    windowRoot.style.gap = "14px";
    windowRoot.style.width = "min(1080px, calc(100vw - 24px))";
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
    titleLine.textContent = "Programmable Router";
    header.appendChild(titleLine);

    this.positionLine = document.createElement("div");
    this.positionLine.style.color = "#9cb4cb";
    this.positionLine.textContent = "Cell: -";
    header.appendChild(this.positionLine);

    this.runtimeLine = document.createElement("div");
    this.runtimeLine.style.color = "#9fd2ae";
    this.runtimeLine.textContent = "Runtime: -";
    header.appendChild(this.runtimeLine);

    this.carryingLine = document.createElement("div");
    this.carryingLine.style.color = "#9cb4cb";
    this.carryingLine.textContent = "Item: -";
    header.appendChild(this.carryingLine);

    this.routeLine = document.createElement("div");
    this.routeLine.style.color = "#9cb4cb";
    this.routeLine.textContent = "Route: -";
    header.appendChild(this.routeLine);

    this.programLine = document.createElement("div");
    this.programLine.style.color = "#9cb4cb";
    this.programLine.textContent = "Program: -";
    header.appendChild(this.programLine);

    const tipsPanel = document.createElement("div");
    tipsPanel.style.display = "flex";
    tipsPanel.style.flexDirection = "column";
    tipsPanel.style.gap = "8px";
    tipsPanel.style.padding = "12px";
    tipsPanel.style.border = "1px solid rgba(76, 108, 145, 0.42)";
    tipsPanel.style.borderRadius = "12px";
    tipsPanel.style.background = "rgba(10, 18, 29, 0.9)";
    leftColumn.appendChild(tipsPanel);

    const tipsTitle = document.createElement("div");
    tipsTitle.style.color = "#eef6ff";
    tipsTitle.style.font = "13px/1.2 monospace";
    tipsTitle.textContent = "Behavior";
    tipsPanel.appendChild(tipsTitle);

    const tipsText = document.createElement("div");
    tipsText.style.color = "#a7bfd6";
    tipsText.style.font = "11px/1.45 monospace";
    tipsText.textContent =
      "Base round-robin stays intact. JS can narrow allowed outputs or move directions to the front.";
    tipsPanel.appendChild(tipsText);

    const rightColumn = document.createElement("div");
    rightColumn.style.display = "flex";
    rightColumn.style.flexDirection = "column";
    rightColumn.style.gap = "10px";
    windowRoot.appendChild(rightColumn);

    const editorPanel = document.createElement("div");
    editorPanel.style.display = "flex";
    editorPanel.style.flexDirection = "column";
    editorPanel.style.gap = "10px";
    editorPanel.style.minHeight = "480px";
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
    editorTitle.textContent = "Router Script";
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
      this.sourceEditor.value = Router.defaultProgramSource;
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
    this.editorHintLine.textContent = "Apply with Ctrl+Enter. The script runs on the main simulation thread.";
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
      `api.item()
api.inputSide()
api.facing()
api.outputs()
api.allow(direction | [directions])
api.block(direction | [directions])
api.prioritize(direction | [directions])
api.setStatus(text)
api.getTick(), api.getTime()

The script augments the router's normal round-robin behavior.
Use the persistent \`state\` object for memory between successful dispatches.`;
    apiPanel.appendChild(apiText);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.emitClose();
      }
    });

    parent.appendChild(this.overlay);
  }

  setView(view: ProgrammableRouterGuiView | null): void {
    this.open = view !== null;
    this.overlay.style.display = this.open ? "flex" : "none";
    if (!view) {
      return;
    }

    const routerKey = `${view.gridX}:${view.gridY}`;
    const routerChanged = routerKey !== this.syncedRouterKey;
    const versionChanged = view.programVersion !== this.syncedProgramVersion;
    if (routerChanged || versionChanged || !this.isDirty) {
      this.sourceEditor.value = view.programSource;
      this.syncedSource = view.programSource;
      this.syncedProgramVersion = view.programVersion;
      this.syncedRouterKey = routerKey;
      this.isDirty = false;
    }

    this.positionLine.textContent =
      `Cell: (${view.gridX}, ${view.gridY}) | Facing: ${view.direction.toUpperCase()}`;
    this.runtimeLine.textContent = `Runtime: ${view.statusText}`;
    this.runtimeLine.style.color = view.runtimeError
      ? "#ef9a9a"
      : view.compileError
        ? "#f2d493"
        : "#9fd2ae";

    this.carryingLine.textContent = view.storedItem
      ? `Item: ${view.storedItem} | input ${view.inputSide.toUpperCase()} | progress ${Math.round(view.storedProgress * 100)}%`
      : "Item: empty";

    this.routeLine.textContent =
      view.lastDecisionItem && view.lastDecisionInputSide && view.lastDecisionOutputs.length > 0
        ? `Route: ${view.lastDecisionItem} from ${view.lastDecisionInputSide.toUpperCase()} -> ${view.lastDecisionOutputs.map((direction) => direction.toUpperCase()).join(" -> ")}`
        : "Route: no routing decision yet";

    this.programLine.textContent =
      view.activeProgramVersion !== null
        ? `Program: edit v${view.programVersion} | running build v${view.activeProgramVersion}`
        : `Program: edit v${view.programVersion} | no runnable build`;

    this.lastCompileError = view.compileError;
    this.lastRuntimeError = view.runtimeError;
    this.lastActiveProgramVersion = view.activeProgramVersion;
    this.updateEditorHint();
  }

  isOpen(): boolean {
    return this.open;
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
    this.applyListeners.length = 0;
    this.closeListeners.length = 0;
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
      this.editorHintLine.textContent = `Runtime error: ${this.lastRuntimeError}. Router falls back to normal routing.`;
      return;
    }

    this.editorHintLine.style.color = "#9cb4cb";
    this.editorHintLine.textContent = "Apply with Ctrl+Enter. The script runs on the main simulation thread.";
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
}
