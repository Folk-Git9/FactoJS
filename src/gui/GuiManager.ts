import { DebugGui } from './debug/DebugGui';

import type { DebugSnapshot } from './debug/DebugSnapshot';

export class GuiManager {
    private readonly root: HTMLDivElement;

    private readonly hudLayer: HTMLDivElement;

    private readonly debugLayer: HTMLDivElement;

    private readonly debugGui: DebugGui;

    constructor(parent: HTMLElement) {
        this.root = document.createElement('div');

        this.root.className = 'gui-root';

        this.hudLayer = document.createElement('div');

        this.hudLayer.className = 'gui-layer gui-hud-layer';

        this.debugLayer = document.createElement('div');

        this.debugLayer.className = 'gui-layer gui-debug-layer';

        this.root.append(this.hudLayer, this.debugLayer);

        parent.appendChild(this.root);

        this.debugGui = new DebugGui(this.debugLayer);
    }

    updateDebug(snapshot: DebugSnapshot, deltaSeconds: number): void {
        this.debugGui.update(snapshot, deltaSeconds);
    }

    destroy(): void {
        this.debugGui.destroy();

        this.root.remove();
    }
}
