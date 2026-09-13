import { clamp } from '../../util/math/Math';

import type { WorldMap } from '../map/WorldMap';

import { TILE_SIZE_WORLD } from '../map/constants';

import type { MovableCircle, MovementResolver } from './MovementResolver';

const COLLISION_EPSILON = 0.001;

const MAX_DEPENETRATION_ITERATIONS = 4;

export class WorldMovementResolver implements MovementResolver {
    constructor(private readonly map: WorldMap) { }

    moveCircle(body: MovableCircle, deltaX: number, deltaY: number): void {
        /*
         * If, for some reason, the object is already
         * inside the obstacle, we first restore
         * the correct state.
         */
        this.resolvePenetrations(body);

        /*
         * Substeps prevent tunneling if the
         * player's speed subsequently increases significantly.
         */
        const maxStepDistance = Math.max(body.radius * 0.5, 1);

        const movementDistance = Math.max(Math.abs(deltaX), Math.abs(deltaY));

        const steps = Math.max(1, Math.ceil(movementDistance / maxStepDistance));

        const stepX = deltaX / steps;

        const stepY = deltaY / steps;

        for (let step = 0; step < steps; step++) {
            this.moveX(body, stepX);

            this.moveY(body, stepY);

            /*
             * Axis resolution provides sliding.
             *
             * Depenetration ensures that after
             * a step, we do not remain inside a corner.
             */
            this.resolvePenetrations(body);

            this.clampToWorld(body);
        }
    }

    private moveX(body: MovableCircle, deltaX: number): void {
        if (deltaX === 0) {
            return;
        }

        const startX = body.x;

        let targetX = body.x + deltaX;

        const radius = body.radius;

        const minTileX = Math.floor((Math.min(startX, targetX) - radius) / TILE_SIZE_WORLD);

        const maxTileX = Math.floor((Math.max(startX, targetX) + radius) / TILE_SIZE_WORLD);

        const minTileY = Math.floor((body.y - radius) / TILE_SIZE_WORLD);

        const maxTileY = Math.floor((body.y + radius) / TILE_SIZE_WORLD);

        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
                if (this.map.getBuildingIdAtTile(tileX, tileY) === 0) {
                    continue;
                }

                const tileLeft = tileX * TILE_SIZE_WORLD;

                const tileTop = tileY * TILE_SIZE_WORLD;

                const tileRight = tileLeft + TILE_SIZE_WORLD;

                const tileBottom = tileTop + TILE_SIZE_WORLD;

                const closestY = clamp(body.y, tileTop, tileBottom);

                const distanceY = body.y - closestY;

                const distanceYSquared = distanceY * distanceY;

                const radiusSquared = radius * radius;

                if (distanceYSquared >= radiusSquared) {
                    continue;
                }

                const horizontalRadius = Math.sqrt(radiusSquared - distanceYSquared);

                if (deltaX > 0 && startX <= tileLeft) {
                    const limit = tileLeft - horizontalRadius - COLLISION_EPSILON;

                    if (targetX > limit) {
                        targetX = Math.min(targetX, limit);
                    }
                } else if (deltaX < 0 && startX >= tileRight) {
                    const limit = tileRight + horizontalRadius + COLLISION_EPSILON;

                    if (targetX < limit) {
                        targetX = Math.max(targetX, limit);
                    }
                }
            }
        }

        body.x = targetX;
    }

    private moveY(body: MovableCircle, deltaY: number): void {
        if (deltaY === 0) {
            return;
        }

        const startY = body.y;

        let targetY = body.y + deltaY;

        const radius = body.radius;

        const minTileX = Math.floor((body.x - radius) / TILE_SIZE_WORLD);

        const maxTileX = Math.floor((body.x + radius) / TILE_SIZE_WORLD);

        const minTileY = Math.floor((Math.min(startY, targetY) - radius) / TILE_SIZE_WORLD);

        const maxTileY = Math.floor((Math.max(startY, targetY) + radius) / TILE_SIZE_WORLD);

        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
                if (this.map.getBuildingIdAtTile(tileX, tileY) === 0) {
                    continue;
                }

                const tileLeft = tileX * TILE_SIZE_WORLD;

                const tileTop = tileY * TILE_SIZE_WORLD;

                const tileRight = tileLeft + TILE_SIZE_WORLD;

                const tileBottom = tileTop + TILE_SIZE_WORLD;

                const closestX = clamp(body.x, tileLeft, tileRight);

                const distanceX = body.x - closestX;

                const distanceXSquared = distanceX * distanceX;

                const radiusSquared = radius * radius;

                if (distanceXSquared >= radiusSquared) {
                    continue;
                }

                const verticalRadius = Math.sqrt(radiusSquared - distanceXSquared);

                if (deltaY > 0 && startY <= tileTop) {
                    const limit = tileTop - verticalRadius - COLLISION_EPSILON;

                    if (targetY > limit) {
                        targetY = Math.min(targetY, limit);
                    }
                } else if (deltaY < 0 && startY >= tileBottom) {
                    const limit = tileBottom + verticalRadius + COLLISION_EPSILON;

                    if (targetY < limit) {
                        targetY = Math.max(targetY, limit);
                    }
                }
            }
        }

        body.y = targetY;
    }

    private resolvePenetrations(body: MovableCircle): void {
        for (let iteration = 0; iteration < MAX_DEPENETRATION_ITERATIONS; iteration++) {
            const resolved = this.resolveSinglePenetrationPass(body);

            if (!resolved) {
                return;
            }
        }
    }

    private resolveSinglePenetrationPass(body: MovableCircle): boolean {
        const radius = body.radius;

        const minTileX = Math.floor((body.x - radius) / TILE_SIZE_WORLD);

        const maxTileX = Math.floor((body.x + radius) / TILE_SIZE_WORLD);

        const minTileY = Math.floor((body.y - radius) / TILE_SIZE_WORLD);

        const maxTileY = Math.floor((body.y + radius) / TILE_SIZE_WORLD);

        let resolved = false;

        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
                if (this.map.getBuildingIdAtTile(tileX, tileY) === 0) {
                    continue;
                }

                if (this.resolveCircleAabbPenetration(body, tileX, tileY)) {
                    resolved = true;
                }
            }
        }

        return resolved;
    }

    private resolveCircleAabbPenetration(
        body: MovableCircle,
        tileX: number,
        tileY: number,
    ): boolean {
        const left = tileX * TILE_SIZE_WORLD;

        const top = tileY * TILE_SIZE_WORLD;

        const right = left + TILE_SIZE_WORLD;

        const bottom = top + TILE_SIZE_WORLD;

        const closestX = clamp(body.x, left, right);

        const closestY = clamp(body.y, top, bottom);

        const dx = body.x - closestX;

        const dy = body.y - closestY;

        const distanceSquared = dx * dx + dy * dy;

        const radius = body.radius;

        const radiusSquared = radius * radius;

        if (distanceSquared >= radiusSquared) {
            return false;
        }

        /*
         * Normal case:
         * The center of the circle is outside the AABB.
         */
        if (distanceSquared > Number.EPSILON) {
            const distance = Math.sqrt(distanceSquared);

            const penetration = radius - distance + COLLISION_EPSILON;

            body.x += (dx / distance) * penetration;

            body.y += (dy / distance) * penetration;

            return true;
        }

        /*
         * The center is either inside the AABB or directly on its
         * boundary. The closest point has no direction,
         * so we manually select the nearest side.
         */
        const distanceLeft = body.x - left;

        const distanceRight = right - body.x;

        const distanceTop = body.y - top;

        const distanceBottom = bottom - body.y;

        const minimum = Math.min(distanceLeft, distanceRight, distanceTop, distanceBottom);

        if (minimum === distanceLeft) {
            body.x = left - radius - COLLISION_EPSILON;
        } else if (minimum === distanceRight) {
            body.x = right + radius + COLLISION_EPSILON;
        } else if (minimum === distanceTop) {
            body.y = top - radius - COLLISION_EPSILON;
        } else {
            body.y = bottom + radius + COLLISION_EPSILON;
        }

        return true;
    }

    private clampToWorld(body: MovableCircle): void {
        const bounds = this.map.bounds;

        if (bounds === null) {
            return;
        }

        body.x = clamp(body.x, bounds.left + body.radius, bounds.right - body.radius);

        body.y = clamp(body.y, bounds.top + body.radius, bounds.bottom - body.radius);
    }
}
