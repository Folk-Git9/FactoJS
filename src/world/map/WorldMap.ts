import { Chunk } from './Chunk';

import type { ChunkRange } from './ChunkRange';
import type {
    WorldMapBounds,
} from './WorldMapBounds';
import type {
    WorldMapConfig,
} from './WorldMapConfig';

import {
    CHUNK_SIZE_TILES,
    CHUNK_SIZE_WORLD,
} from './constants';

import {
    validateWorldMapConfig,
} from './WorldMapConfig';

export class WorldMap {
    readonly config: WorldMapConfig;
    readonly bounds: WorldMapBounds | null;

    private readonly chunks =
        new Map<
            number,
            Map<number, Chunk>
        >();

    constructor(
        config: WorldMapConfig,
    ) {
        validateWorldMapConfig(config);

        this.config =
            cloneConfig(config);

        this.bounds =
            createBounds(config);
    }

    getChunk(
        chunkX: number,
        chunkY: number,
    ): Chunk | undefined {
        assertChunkCoordinate(
            chunkX,
            chunkY,
        );

        if (
            !this.isChunkInBounds(
                chunkX,
                chunkY,
            )
        ) {
            return undefined;
        }

        return this.chunks
            .get(chunkX)
            ?.get(chunkY);
    }

    getOrCreateChunk(
        chunkX: number,
        chunkY: number,
    ): Chunk {
        assertChunkCoordinate(
            chunkX,
            chunkY,
        );

        if (
            !this.isChunkInBounds(
                chunkX,
                chunkY,
            )
        ) {
            throw new RangeError(
                `Chunk (${chunkX}, ${chunkY}) is outside the world`,
            );
        }

        let column =
            this.chunks.get(chunkX);

        if (column === undefined) {
            column =
                new Map<number, Chunk>();

            this.chunks.set(
                chunkX,
                column,
            );
        }

        let chunk =
            column.get(chunkY);

        if (chunk === undefined) {
            chunk =
                new Chunk(
                    chunkX,
                    chunkY,
                );

            column.set(
                chunkY,
                chunk,
            );
        }

        return chunk;
    }

    getChunkAtWorld(
        worldX: number,
        worldY: number,
    ): Chunk | undefined {
        return this.getChunk(
            this.worldToChunkX(worldX),
            this.worldToChunkY(worldY),
        );
    }

    getOrCreateChunkAtWorld(
        worldX: number,
        worldY: number,
    ): Chunk {
        return this.getOrCreateChunk(
            this.worldToChunkX(worldX),
            this.worldToChunkY(worldY),
        );
    }

    worldToChunkX(
        worldX: number,
    ): number {
        return Math.floor(
            worldX /
            CHUNK_SIZE_WORLD,
        );
    }

    worldToChunkY(
        worldY: number,
    ): number {
        return Math.floor(
            worldY /
            CHUNK_SIZE_WORLD,
        );
    }

    isChunkInBounds(
        chunkX: number,
        chunkY: number,
    ): boolean {
        const bounds =
            this.bounds;

        if (bounds === null) {
            return true;
        }

        return (
            chunkX >=
            bounds.minChunkX &&
            chunkX <
            bounds.maxChunkXExclusive &&
            chunkY >=
            bounds.minChunkY &&
            chunkY <
            bounds.maxChunkYExclusive
        );
    }

    containsWorldPoint(
        x: number,
        y: number,
    ): boolean {
        const bounds =
            this.bounds;

        if (bounds === null) {
            return true;
        }

        return (
            x >= bounds.left &&
            x < bounds.right &&
            y >= bounds.top &&
            y < bounds.bottom
        );
    }

    getChunkRangeForWorldRect(
        left: number,
        top: number,
        right: number,
        bottom: number,
    ): ChunkRange | null {
        const bounds =
            this.bounds;

        if (bounds !== null) {
            left = Math.max(
                left,
                bounds.left,
            );

            top = Math.max(
                top,
                bounds.top,
            );

            right = Math.min(
                right,
                bounds.right,
            );

            bottom = Math.min(
                bottom,
                bounds.bottom,
            );
        }

        if (
            right <= left ||
            bottom <= top
        ) {
            return null;
        }

        return {
            minX: Math.floor(
                left /
                CHUNK_SIZE_WORLD,
            ),

            minY: Math.floor(
                top /
                CHUNK_SIZE_WORLD,
            ),

            maxX:
                Math.ceil(
                    right /
                    CHUNK_SIZE_WORLD,
                ) - 1,

            maxY:
                Math.ceil(
                    bottom /
                    CHUNK_SIZE_WORLD,
                ) - 1,
        };
    }

    getSpawnPosition(): {
        x: number;
        y: number;
    } {
        const bounds =
            this.bounds;

        if (bounds === null) {
            return {
                x: 0,
                y: 0,
            };
        }

        return {
            x:
                (bounds.left +
                    bounds.right) *
                0.5,

            y:
                (bounds.top +
                    bounds.bottom) *
                0.5,
        };
    }
}

function createBounds(
    config: WorldMapConfig,
): WorldMapBounds | null {
    if (config.type === 'infinite') {
        return null;
    }

    const widthChunks =
        config.widthTiles /
        CHUNK_SIZE_TILES;

    const heightChunks =
        config.heightTiles /
        CHUNK_SIZE_TILES;

    const minChunkX =
        -Math.floor(
            widthChunks / 2,
        );

    const minChunkY =
        -Math.floor(
            heightChunks / 2,
        );

    const maxChunkXExclusive =
        minChunkX +
        widthChunks;

    const maxChunkYExclusive =
        minChunkY +
        heightChunks;

    return {
        minChunkX,
        minChunkY,

        maxChunkXExclusive,
        maxChunkYExclusive,

        left:
            minChunkX *
            CHUNK_SIZE_WORLD,

        top:
            minChunkY *
            CHUNK_SIZE_WORLD,

        right:
            maxChunkXExclusive *
            CHUNK_SIZE_WORLD,

        bottom:
            maxChunkYExclusive *
            CHUNK_SIZE_WORLD,
    };
}

function cloneConfig(
    config: WorldMapConfig,
): WorldMapConfig {
    if (config.type === 'infinite') {
        return {
            type: 'infinite',
        };
    }

    return {
        type: 'bounded',

        widthTiles:
            config.widthTiles,

        heightTiles:
            config.heightTiles,
    };
}

function assertChunkCoordinate(
    x: number,
    y: number,
): void {
    if (
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y)
    ) {
        throw new RangeError(
            'Chunk coordinates must be safe integers',
        );
    }
}