import type {
    PlayerInputState,
} from '../input/PlayerInputState';

import { Player } from './entity/Player';

import { WorldMap } from './map/WorldMap';

import type {
    WorldMapConfig,
} from './map/WorldMapConfig';

import { MapMovementResolver } from './movement/MapMovementResolver';

import { PlayerAimSystem } from './system/PlayerAimSystem';
import { PlayerMovementSystem } from './system/PlayerMovementSystem';

export class World {
    readonly map: WorldMap;
    readonly player: Player;

    private readonly movementResolver:
        MapMovementResolver;

    private readonly playerMovementSystem:
        PlayerMovementSystem;

    private readonly playerAimSystem =
        new PlayerAimSystem();

    constructor(
        mapConfig: WorldMapConfig,
    ) {
        this.map =
            new WorldMap(
                mapConfig,
            );

        const spawn =
            this.map.getSpawnPosition();

        this.player =
            new Player(
                spawn.x,
                spawn.y,
            );

        this.movementResolver =
            new MapMovementResolver(
                this.map,
            );

        this.playerMovementSystem =
            new PlayerMovementSystem(
                this.movementResolver,
            );

        this.map.getOrCreateChunkAtWorld(
            spawn.x,
            spawn.y,
        );
    }

    tick(
        deltaSeconds: number,
        playerInput: Readonly<PlayerInputState>,
    ): void {
        this.player.beginTick();

        this.playerMovementSystem.tick(
            this.player,
            playerInput,
            deltaSeconds,
        );

        this.playerAimSystem.tick(
            this.player,
            playerInput,
        );
    }
}