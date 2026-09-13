import { Container, Graphics } from 'pixi.js';

import type { World } from '../world/World';

import { BuildingType } from '../world/building/BuildingType';

import { TILE_SIZE_WORLD } from '../world/map/constants';

import type { Frustum2D } from './Frustum2D';

export class BuildingRenderer {
    private readonly rendered = new Map<number, Graphics>();

    constructor(private readonly parent: Container) {}

    render(world: World, frustum: Frustum2D): void {
        const range = world.map.getChunkRangeForWorldRect(
            frustum.left,
            frustum.top,
            frustum.right,
            frustum.bottom,
        );

        const visibleIds = new Set<number>();

        if (range !== null) {
            for (let chunkY = range.minY; chunkY <= range.maxY; chunkY++) {
                for (let chunkX = range.minX; chunkX <= range.maxX; chunkX++) {
                    const chunk = world.map.getChunk(chunkX, chunkY);

                    if (chunk === undefined) {
                        continue;
                    }

                    chunk.forEachOccupied((_localX, _localY, buildingId) => {
                        visibleIds.add(buildingId);
                    });
                }
            }
        }

        for (const id of visibleIds) {
            const building = world.buildings.get(id);

            if (building === undefined) {
                continue;
            }

            if (this.rendered.has(id)) {
                continue;
            }

            const graphics = createBuildingGraphics(
                building.type,
                building.widthTiles,
                building.heightTiles,
            );

            graphics.position.set(
                building.tileX * TILE_SIZE_WORLD,
                building.tileY * TILE_SIZE_WORLD,
            );

            this.parent.addChild(graphics);

            this.rendered.set(id, graphics);
        }

        for (const [id, graphics] of this.rendered) {
            if (visibleIds.has(id)) {
                continue;
            }

            graphics.destroy();

            this.rendered.delete(id);
        }
    }

    destroy(): void {
        for (const graphics of this.rendered.values()) {
            graphics.destroy();
        }

        this.rendered.clear();
    }
}

function createBuildingGraphics(
    type: BuildingType,
    widthTiles: number,
    heightTiles: number,
): Graphics {
    switch (type) {
        case BuildingType.Chest:
            return createChest(widthTiles, heightTiles);
    }
}

function createChest(widthTiles: number, heightTiles: number): Graphics {
    const graphics = new Graphics();

    const width = widthTiles * TILE_SIZE_WORLD;

    const height = heightTiles * TILE_SIZE_WORLD;

    const margin = 3;

    graphics
        .roundRect(margin, margin, width - margin * 2, height - margin * 2, 4)
        .fill({
            color: 0x745230,
        })
        .stroke({
            color: 0xc99557,
            width: 2,
        });

    graphics.rect(margin + 3, height * 0.45, width - margin * 2 - 6, 3).fill({
        color: 0x3e2c1c,
    });

    graphics.rect(width * 0.43, height * 0.4, width * 0.14, height * 0.2).fill({
        color: 0xe3b96e,
    });

    return graphics;
}
