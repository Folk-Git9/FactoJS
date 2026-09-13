import type { PlayerInputState } from '../input/PlayerInputState';

import type { Frustum2D } from '../render/Frustum2D';

import { BuildingStore } from './building/BuildingStore';

import type { PlacementPreview } from './building/PlacementPreview';

import { Player } from './entity/Player';

import { WorldMap } from './map/WorldMap';

import type { WorldMapConfig } from './map/WorldMapConfig';

import { WorldMovementResolver } from './movement/WorldMovementResolver';

import { BuildingPlacementSystem } from './system/BuildingPlacementSystem';

import { PlayerAimSystem } from './system/PlayerAimSystem';

import { PlayerMovementSystem } from './system/PlayerMovementSystem';

export class World {
    readonly map: WorldMap;
    readonly player: Player;

    readonly buildings = new BuildingStore();

    private readonly movementResolver: WorldMovementResolver;

    private readonly playerMovementSystem: PlayerMovementSystem;

    private readonly playerAimSystem = new PlayerAimSystem();

    private readonly buildingPlacementSystem: BuildingPlacementSystem;

    constructor(mapConfig: WorldMapConfig) {
        this.map = new WorldMap(mapConfig);

        const spawn = this.map.getSpawnPosition();

        this.player = new Player(spawn.x, spawn.y);

        this.movementResolver = new WorldMovementResolver(this.map);

        this.playerMovementSystem = new PlayerMovementSystem(this.movementResolver);

        this.buildingPlacementSystem = new BuildingPlacementSystem(this.map, this.buildings);
    }

    get placementPreview(): Readonly<PlacementPreview> {
        return this.buildingPlacementSystem.preview;
    }

    tick(deltaSeconds: number, playerInput: Readonly<PlayerInputState>): void {
        this.player.beginTick();

        this.playerMovementSystem.tick(this.player, playerInput, deltaSeconds);

        this.playerAimSystem.tick(this.player, playerInput);

        this.buildingPlacementSystem.tick(playerInput, this.player);
    }

    prepareChunksForView(frustum: Frustum2D): void {
        const range = this.map.getChunkRangeForWorldRect(
            frustum.left,
            frustum.top,
            frustum.right,
            frustum.bottom,
        );

        if (range === null) {
            return;
        }

        this.map.prepareChunkRange(range);
    }
}
