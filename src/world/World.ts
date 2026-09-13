import type { PlayerInputState } from '../input/PlayerInputState';

import type { Frustum2D } from '../render/Frustum2D';

import { Player } from './entity/Player';

import { WorldMap } from './map/WorldMap';

import type { WorldMapConfig } from './map/WorldMapConfig';

import { MapMovementResolver } from './movement/MapMovementResolver';

import { PlayerAimSystem } from './system/PlayerAimSystem';
import { PlayerMovementSystem } from './system/PlayerMovementSystem';

export class World {
    readonly map: WorldMap;
    readonly player: Player;

    private readonly movementResolver: MapMovementResolver;

    private readonly playerMovementSystem: PlayerMovementSystem;

    private readonly playerAimSystem = new PlayerAimSystem();

    constructor(mapConfig: WorldMapConfig) {
        this.map = new WorldMap(mapConfig);

        const spawn = this.map.getSpawnPosition();

        this.player = new Player(spawn.x, spawn.y);

        this.movementResolver = new MapMovementResolver(this.map);

        this.playerMovementSystem = new PlayerMovementSystem(this.movementResolver);
    }

    tick(deltaSeconds: number, playerInput: Readonly<PlayerInputState>): void {
        this.player.beginTick();

        this.playerMovementSystem.tick(this.player, playerInput, deltaSeconds);

        this.playerAimSystem.tick(this.player, playerInput);
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
