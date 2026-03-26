import { World } from "../core/World";
import { BeltSystem } from "./BeltSystem";

export class TransportSystem {
  private readonly beltSystem: BeltSystem;

  constructor(beltSystem: BeltSystem) {
    this.beltSystem = beltSystem;
  }

  update(world: World, deltaSeconds: number): void {
    this.beltSystem.update(world, deltaSeconds);
  }
}
