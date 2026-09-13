import type { PlayerInputState } from '../../input/PlayerInputState';

import type { Player } from '../entity/Player';

import type { WorldMap } from '../map/WorldMap';

import { TILE_SIZE_WORLD } from '../map/constants';

import type { BuildingStore } from '../building/BuildingStore';

import { BuildingType } from '../building/BuildingType';

import { getBuildingDefinition } from '../building/BuildingDefinition';

import { clamp } from '../../util/math/Math';
import type { PlacementPreview } from '../building/PlacementPreview';

export class BuildingPlacementSystem {
    readonly preview: PlacementPreview = {
        type: BuildingType.Chest,

        tileX: 0,
        tileY: 0,

        valid: false,
    };

    constructor(
        private readonly map: WorldMap,

        private readonly buildings: BuildingStore,
    ) {}

    tick(input: Readonly<PlayerInputState>, player: Player): void {
        this.preview.tileX = this.map.worldToTileX(input.aimX);

        this.preview.tileY = this.map.worldToTileY(input.aimY);

        this.preview.valid = this.canPlace(
            this.preview.type,
            this.preview.tileX,
            this.preview.tileY,
            player,
        );

        if (input.placePressed && this.preview.valid) {
            this.place(this.preview.type, this.preview.tileX, this.preview.tileY);

            this.preview.valid = false;
        }
    }

    private canPlace(type: BuildingType, tileX: number, tileY: number, player: Player): boolean {
        const definition = getBuildingDefinition(type);

        for (let y = 0; y < definition.heightTiles; y++) {
            for (let x = 0; x < definition.widthTiles; x++) {
                const currentTileX = tileX + x;

                const currentTileY = tileY + y;

                if (!this.map.isTileInBounds(currentTileX, currentTileY)) {
                    return false;
                }

                if (this.map.getBuildingIdAtTile(currentTileX, currentTileY) !== 0) {
                    return false;
                }

                if (
                    circleIntersectsTile(
                        player.x,
                        player.y,
                        player.radius,
                        currentTileX,
                        currentTileY,
                    )
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    private place(type: BuildingType, tileX: number, tileY: number): void {
        const building = this.buildings.create(type, tileX, tileY);

        for (let y = 0; y < building.heightTiles; y++) {
            for (let x = 0; x < building.widthTiles; x++) {
                this.map.setBuildingIdAtTile(building.tileX + x, building.tileY + y, building.id);
            }
        }
    }
}

function circleIntersectsTile(
    circleX: number,
    circleY: number,
    radius: number,
    tileX: number,
    tileY: number,
): boolean {
    const left = tileX * TILE_SIZE_WORLD;

    const top = tileY * TILE_SIZE_WORLD;

    const right = left + TILE_SIZE_WORLD;

    const bottom = top + TILE_SIZE_WORLD;

    const closestX = clamp(circleX, left, right);

    const closestY = clamp(circleY, top, bottom);

    const dx = circleX - closestX;

    const dy = circleY - closestY;

    return dx * dx + dy * dy < radius * radius;
}
