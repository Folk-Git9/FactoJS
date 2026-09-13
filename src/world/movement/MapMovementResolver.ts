import { clamp } from '../../util/math/Math';
import type { WorldMap } from '../map/WorldMap';

import type {
    MovableCircle,
    MovementResolver,
} from './MovementResolver';

export class MapMovementResolver
    implements MovementResolver {
    constructor(
        private readonly map: WorldMap,
    ) { }

    moveCircle(
        body: MovableCircle,
        deltaX: number,
        deltaY: number,
    ): void {
        const bounds =
            this.map.bounds;

        if (bounds === null) {
            body.x += deltaX;
            body.y += deltaY;

            return;
        }

        const minX =
            bounds.left +
            body.radius;

        const maxX =
            bounds.right -
            body.radius;

        const minY =
            bounds.top +
            body.radius;

        const maxY =
            bounds.bottom -
            body.radius;

        body.x = clamp(
            body.x + deltaX,
            minX,
            maxX,
        );

        body.y = clamp(
            body.y + deltaY,
            minY,
            maxY,
        );
    }
}
