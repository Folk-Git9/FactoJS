import { clamp } from '../util/math/Math';
import type { Camera2D } from './Camera2D';

export class Frustum2D {
    private _left = 0;
    private _top = 0;
    private _right = 0;
    private _bottom = 0;

    get left(): number {
        return this._left;
    }

    get top(): number {
        return this._top;
    }

    get right(): number {
        return this._right;
    }

    get bottom(): number {
        return this._bottom;
    }

    get width(): number {
        return this._right - this._left;
    }

    get height(): number {
        return this._bottom - this._top;
    }

    update(
        camera: Camera2D,
        viewportWidth: number,
        viewportHeight: number,
        paddingPixels = 0,
    ): void {
        const halfWidth = viewportWidth / (2 * camera.zoom);

        const halfHeight = viewportHeight / (2 * camera.zoom);

        const padding = paddingPixels / camera.zoom;

        this._left = camera.x - halfWidth - padding;

        this._right = camera.x + halfWidth + padding;

        this._top = camera.y - halfHeight - padding;

        this._bottom = camera.y + halfHeight + padding;
    }

    containsPoint(x: number, y: number): boolean {
        return x >= this._left && x <= this._right && y >= this._top && y <= this._bottom;
    }

    intersectsCircle(x: number, y: number, radius: number): boolean {
        const closestX = clamp(x, this._left, this._right);

        const closestY = clamp(y, this._top, this._bottom);

        const dx = x - closestX;
        const dy = y - closestY;

        return dx * dx + dy * dy <= radius * radius;
    }

    intersectsAabb(minX: number, minY: number, maxX: number, maxY: number): boolean {
        return (
            maxX >= this._left && minX <= this._right && maxY >= this._top && minY <= this._bottom
        );
    }
}
