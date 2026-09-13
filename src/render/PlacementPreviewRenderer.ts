import { Container, Graphics } from 'pixi.js';

import type { World } from '../world/World';

import { getBuildingDefinition } from '../world/building/BuildingDefinition';

import { TILE_SIZE_WORLD } from '../world/map/constants';

export class PlacementPreviewRenderer {
    private readonly graphics = new Graphics();

    constructor(parent: Container) {
        parent.addChild(this.graphics);
    }

    render(world: World): void {
        const preview = world.placementPreview;

        const definition = getBuildingDefinition(preview.type);

        this.graphics.clear();

        this.graphics.position.set(
            preview.tileX * TILE_SIZE_WORLD,
            preview.tileY * TILE_SIZE_WORLD,
        );

        const width = definition.widthTiles * TILE_SIZE_WORLD;

        const height = definition.heightTiles * TILE_SIZE_WORLD;

        const color = preview.valid ? 0x57d67a : 0xe05b5b;

        this.graphics
            .rect(1, 1, width - 2, height - 2)
            .fill({
                color,
                alpha: 0.2,
            })
            .stroke({
                color,
                alpha: 0.9,
                width: 2,
            });
    }

    destroy(): void {
        this.graphics.destroy();
    }
}
