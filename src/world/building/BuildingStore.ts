import type { Building } from './Building';

import { getBuildingDefinition } from './BuildingDefinition';

import type { BuildingType } from './BuildingType';

export class BuildingStore {
    private readonly buildings = new Map<number, Building>();

    private nextId = 1;

    get size(): number {
        return this.buildings.size;
    }

    get(id: number): Building | undefined {
        return this.buildings.get(id);
    }

    create(type: BuildingType, tileX: number, tileY: number): Building {
        const definition = getBuildingDefinition(type);

        const building: Building = {
            id: this.nextId++,

            type,

            tileX,
            tileY,

            widthTiles: definition.widthTiles,

            heightTiles: definition.heightTiles,
        };

        this.buildings.set(building.id, building);

        return building;
    }

    remove(id: number): boolean {
        return this.buildings.delete(id);
    }
}
