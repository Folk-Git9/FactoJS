import { Container, Graphics } from 'pixi.js';

import type { Chunk } from '../world/map/Chunk';

import type { WorldMap } from '../world/map/WorldMap';

import { TerrainType } from '../world/map/TerrainType';

import { CHUNK_SIZE_TILES, TILE_SIZE_WORLD } from '../world/map/constants';

import type { Frustum2D } from './Frustum2D';

export class TerrainRenderer {
    private readonly renderedChunks = new Map<string, RenderedChunk>();

    constructor(private readonly parent: Container) {}

    render(map: WorldMap, frustum: Frustum2D): void {
        const visibleRange = map.getChunkRangeForWorldRect(
            frustum.left,
            frustum.top,
            frustum.right,
            frustum.bottom,
        );

        const visibleKeys = new Set<string>();

        if (visibleRange !== null) {
            for (let chunkY = visibleRange.minY; chunkY <= visibleRange.maxY; chunkY++) {
                for (let chunkX = visibleRange.minX; chunkX <= visibleRange.maxX; chunkX++) {
                    const chunk = map.getChunk(chunkX, chunkY);

                    if (chunk === undefined) {
                        continue;
                    }

                    const key = chunkKey(chunkX, chunkY);

                    visibleKeys.add(key);

                    const rendered = this.getOrCreateRenderedChunk(key, chunk);

                    rendered.graphics.visible = true;
                }
            }
        }

        for (const [key, rendered] of this.renderedChunks) {
            if (visibleKeys.has(key)) {
                continue;
            }

            if (map.getChunk(rendered.chunkX, rendered.chunkY) === undefined) {
                rendered.graphics.destroy();

                this.renderedChunks.delete(key);

                continue;
            }

            rendered.graphics.visible = false;
        }
    }

    destroy(): void {
        for (const rendered of this.renderedChunks.values()) {
            rendered.graphics.destroy();
        }

        this.renderedChunks.clear();
    }

    private getOrCreateRenderedChunk(key: string, chunk: Chunk): RenderedChunk {
        const existing = this.renderedChunks.get(key);

        if (existing !== undefined) {
            return existing;
        }

        const graphics = createChunkGraphics(chunk);

        this.parent.addChild(graphics);

        const rendered: RenderedChunk = {
            chunkX: chunk.x,
            chunkY: chunk.y,
            graphics,
        };

        this.renderedChunks.set(key, rendered);

        return rendered;
    }
}

interface RenderedChunk {
    readonly chunkX: number;
    readonly chunkY: number;

    readonly graphics: Graphics;
}

function createChunkGraphics(chunk: Chunk): Graphics {
    const graphics = new Graphics();

    graphics.position.set(chunk.left, chunk.top);

    for (let localY = 0; localY < CHUNK_SIZE_TILES; localY++) {
        for (let localX = 0; localX < CHUNK_SIZE_TILES; localX++) {
            const terrain = chunk.getTerrain(localX, localY);

            graphics
                .rect(
                    localX * TILE_SIZE_WORLD,
                    localY * TILE_SIZE_WORLD,
                    TILE_SIZE_WORLD,
                    TILE_SIZE_WORLD,
                )
                .fill(terrainColor(terrain));
        }
    }

    return graphics;
}

function terrainColor(terrain: TerrainType): number {
    switch (terrain) {
        case TerrainType.Grass:
            return 0x334d34;

        case TerrainType.Dirt:
            return 0x594735;

        case TerrainType.Sand:
            return 0x756747;

        case TerrainType.Water:
            return 0x244e61;
    }
}

function chunkKey(x: number, y: number): string {
    return `${x}:${y}`;
}
