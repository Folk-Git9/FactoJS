import { MouseInput } from "../input/Mouse";
import { PlacementSystem } from "../input/Placement";
import { Renderer } from "../render/Renderer";
import { BeltSystem } from "../systems/BeltSystem";
import { ProductionSystem } from "../systems/ProductionSystem";
import { TransportSystem } from "../systems/TransportSystem";
import { HUD } from "../ui/HUD";
import { Inventory } from "../ui/Inventory";
import { TickSystem } from "./TickSystem";
import { World } from "./World";

export interface GameConfig {
  width?: number;
  height?: number;
  tickRate?: number;
}

export class Game {
  private readonly world: World;
  private readonly tickSystem: TickSystem;
  private readonly productionSystem: ProductionSystem;
  private readonly transportSystem: TransportSystem;

  private readonly renderer: Renderer;
  private readonly inventory: Inventory;
  private readonly hud: HUD;
  private readonly mouse: MouseInput;
  private readonly placement: PlacementSystem;

  private isRunning = false;
  private lastFrameTimeMs = 0;
  private smoothedFps = 60;
  private readonly cameraKeys = new Set<string>();

  private readonly onResize = (): void => {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (this.isCameraControlKey(key)) {
      this.cameraKeys.add(key);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    this.cameraKeys.delete(key);
  };

  private readonly onWindowBlur = (): void => {
    this.cameraKeys.clear();
  };

  private readonly frame = (timestampMs: number): void => {
    if (!this.isRunning) {
      return;
    }

    const deltaSeconds = Math.min((timestampMs - this.lastFrameTimeMs) / 1000, 0.1);
    this.lastFrameTimeMs = timestampMs;

    const instantFps = 1 / Math.max(deltaSeconds, 0.0001);
    this.smoothedFps = this.smoothedFps * 0.9 + instantFps * 0.1;

    this.updateCameraControls(deltaSeconds);
    this.tickSystem.update(deltaSeconds, (fixedDelta) => this.update(fixedDelta));
    this.renderer.render(this.world);
    this.updateHud();

    requestAnimationFrame(this.frame);
  };

  constructor(host: HTMLElement, config: GameConfig = {}) {
    const width = config.width ?? 200;
    const height = config.height ?? 140;
    const tickRate = config.tickRate ?? 60;

    this.world = new World(width, height);
    this.world.seedDemoLayout();

    this.tickSystem = new TickSystem(tickRate);
    this.productionSystem = new ProductionSystem();
    this.inventory = new Inventory();

    const beltSystem = new BeltSystem({
      onItemExitedWorld: (item) => this.inventory.add(item),
    });
    this.transportSystem = new TransportSystem(beltSystem);

    host.style.margin = "0";
    host.style.overflow = "hidden";
    host.style.position = "relative";

    this.renderer = new Renderer(host, this.world);
    this.hud = new HUD(host);
    this.mouse = new MouseInput(this.renderer.canvas, (x, y) => this.renderer.screenToGrid(x, y));
    this.placement = new PlacementSystem(this.world, this.mouse, this.hud);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    this.onResize();
    this.updateHud();
    this.renderer.render(this.world);
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
    this.placement.dispose();
    this.mouse.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }

  private update(deltaSeconds: number): void {
    this.productionSystem.update(this.world, deltaSeconds);
    this.transportSystem.update(this.world, deltaSeconds);
    this.world.advance(deltaSeconds);
  }

  private updateCameraControls(deltaSeconds: number): void {
    let moveX = 0;
    let moveY = 0;

    if (this.cameraKeys.has("a") || this.cameraKeys.has("arrowleft")) {
      moveX -= 1;
    }
    if (this.cameraKeys.has("d") || this.cameraKeys.has("arrowright")) {
      moveX += 1;
    }
    if (this.cameraKeys.has("w") || this.cameraKeys.has("arrowup")) {
      moveY += 1;
    }
    if (this.cameraKeys.has("s") || this.cameraKeys.has("arrowdown")) {
      moveY -= 1;
    }

    if (moveX !== 0 || moveY !== 0) {
      const panSpeed = 20 / this.renderer.getCameraZoom();
      this.renderer.panCamera(moveX * panSpeed * deltaSeconds, moveY * panSpeed * deltaSeconds);
    }

    let zoomMultiplier = 1;
    if (this.cameraKeys.has("q") || this.cameraKeys.has("=") || this.cameraKeys.has("+")) {
      zoomMultiplier *= Math.exp(deltaSeconds * 1.8);
    }
    if (this.cameraKeys.has("e") || this.cameraKeys.has("-")) {
      zoomMultiplier *= Math.exp(-deltaSeconds * 1.8);
    }
    if (zoomMultiplier !== 1) {
      this.renderer.zoomCamera(zoomMultiplier);
    }
  }

  private isCameraControlKey(key: string): boolean {
    return (
      key === "w" ||
      key === "a" ||
      key === "s" ||
      key === "d" ||
      key === "arrowup" ||
      key === "arrowdown" ||
      key === "arrowleft" ||
      key === "arrowright" ||
      key === "q" ||
      key === "e" ||
      key === "+" ||
      key === "-" ||
      key === "="
    );
  }

  private updateHud(): void {
    this.hud.setStats({
      fps: this.smoothedFps,
      tick: this.world.tick,
      worldItems: this.world.countItemsOnConveyors(),
    });
    this.hud.setInventory(this.inventory.entries());
  }
}
