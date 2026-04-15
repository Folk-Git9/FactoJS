import { Player } from "../entities/Player";
import { Turret } from "../entities/Turret";
import { Zombie } from "../entities/Zombie";
import { isMachine } from "../entities/Machine";
import { World } from "../core/World";

const DEFAULT_WAVE_INTERVAL_SECONDS = 120;
const DEFAULT_MIN_SPAWN_RADIUS = 10;
const DEFAULT_MAX_SPAWN_RADIUS = 16;

interface CombatTarget {
  kind: "player" | "building";
  x: number;
  y: number;
  gridX?: number;
  gridY?: number;
  distance: number;
}

export class CombatSystem {
  private nextWaveAtSeconds = DEFAULT_WAVE_INTERVAL_SECONDS;
  private waveIndex = 0;

  update(world: World, player: Player, deltaSeconds: number): void {
    this.spawnZombieWaves(world, player);
    this.updateTurrets(world, deltaSeconds);
    this.updateZombies(world, player, deltaSeconds);
    this.updateTracers(world, deltaSeconds);
    this.respawnPlayerIfNeeded(world, player);
  }

  private spawnZombieWaves(world: World, player: Player): void {
    while (world.elapsedSeconds >= this.nextWaveAtSeconds) {
      this.waveIndex += 1;
      this.spawnWave(world, player, this.waveIndex);
      this.nextWaveAtSeconds += DEFAULT_WAVE_INTERVAL_SECONDS;
    }
  }

  private spawnWave(world: World, player: Player, waveIndex: number): void {
    const baseCenter = world.getDefendedAreaCenter(player.x, player.y);
    const zombieCount = 2 + Math.floor(waveIndex / 2) + Math.floor(Math.random() * 2);

    for (let i = 0; i < zombieCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius =
        DEFAULT_MIN_SPAWN_RADIUS +
        Math.random() * (DEFAULT_MAX_SPAWN_RADIUS - DEFAULT_MIN_SPAWN_RADIUS);
      const spawnX = baseCenter.x + Math.cos(angle) * radius;
      const spawnY = baseCenter.y + Math.sin(angle) * radius;
      world.spawnZombie(
        world.clampWorldX(spawnX),
        world.clampWorldY(spawnY),
        36 + waveIndex * 4,
        1.65 + Math.min(waveIndex * 0.05, 0.9),
        0.72,
        7 + Math.floor(waveIndex / 2),
        Math.max(0.34, 0.8 - waveIndex * 0.02)
      );
    }
  }

  private updateTurrets(world: World, deltaSeconds: number): void {
    const zombies = world.zombies;
    if (zombies.length <= 0) {
      world.grid.forEach((tile) => {
        if (tile.building && isMachine(tile.building) && tile.building.machineType === "turret") {
          (tile.building as Turret).advanceCombat(deltaSeconds);
        }
      });
      return;
    }

    world.grid.forEach((tile, gridX, gridY) => {
      if (!tile.building || !isMachine(tile.building) || tile.building.machineType !== "turret") {
        return;
      }

      const turret = tile.building as Turret;
      turret.advanceCombat(deltaSeconds);

      const origin = world.gridToWorld(gridX, gridY);
      let bestZombie: Zombie | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const zombie of zombies) {
        if (zombie.health <= 0) {
          continue;
        }
        const distance = Math.hypot(zombie.x - origin.x, zombie.y - origin.y);
        if (distance > turret.rangeTiles || distance >= bestDistance) {
          continue;
        }
        bestZombie = zombie;
        bestDistance = distance;
      }

      if (!bestZombie || !turret.canFireAtDistance(bestDistance)) {
        return;
      }

      if (!turret.fireAt(bestZombie)) {
        return;
      }

      world.spawnTracer(origin.x, origin.y, bestZombie.x, bestZombie.y);
    });

    world.removeDeadZombies();
  }

  private updateZombies(world: World, player: Player, deltaSeconds: number): void {
    for (const zombie of world.zombies) {
      zombie.advance(deltaSeconds);
      const target = this.findTarget(world, player, zombie);
      if (!target) {
        continue;
      }

      if (target.distance <= zombie.attackRange) {
        if (!zombie.canAttack()) {
          continue;
        }

        if (target.kind === "player") {
          player.applyDamage(zombie.attackDamage);
        } else if (target.gridX !== undefined && target.gridY !== undefined) {
          world.damageBuilding(target.gridX, target.gridY, zombie.attackDamage);
        }
        zombie.triggerAttackCooldown();
        continue;
      }

      const dx = target.x - zombie.x;
      const dy = target.y - zombie.y;
      const distance = Math.max(target.distance, 0.0001);
      const movement = zombie.moveSpeedTilesPerSecond * deltaSeconds;
      const moveFactor = Math.min(1, movement / distance);
      zombie.x = world.clampWorldX(zombie.x + dx * moveFactor);
      zombie.y = world.clampWorldY(zombie.y + dy * moveFactor);
    }
  }

  private updateTracers(world: World, deltaSeconds: number): void {
    for (const tracer of world.tracers) {
      tracer.advance(deltaSeconds);
    }
    world.removeExpiredTracers();
  }

  private respawnPlayerIfNeeded(world: World, player: Player): void {
    if (player.health > 0) {
      return;
    }

    const respawn = world.getDefendedAreaCenter(0, 0);
    player.respawn(respawn.x, respawn.y);
  }

  private findTarget(world: World, player: Player, zombie: Zombie): CombatTarget | null {
    let bestTarget: CombatTarget = {
      kind: "player",
      x: player.x,
      y: player.y,
      distance: Math.hypot(player.x - zombie.x, player.y - zombie.y),
    };

    for (const candidate of world.getBuildingAnchors()) {
      const distance = Math.hypot(candidate.x - zombie.x, candidate.y - zombie.y);
      if (distance >= bestTarget.distance) {
        continue;
      }

      bestTarget = {
        kind: "building",
        x: candidate.x,
        y: candidate.y,
        gridX: candidate.gridX,
        gridY: candidate.gridY,
        distance,
      };
    }

    return bestTarget;
  }

  getHostileCount(world: World): number {
    return world.zombies.length;
  }

  getNextWaveInSeconds(world: World): number {
    return Math.max(0, this.nextWaveAtSeconds - world.elapsedSeconds);
  }
}
