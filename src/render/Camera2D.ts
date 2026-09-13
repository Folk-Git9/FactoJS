import type { Container } from 'pixi.js';
import { clamp } from '../util/math/Math';
import type { Pos } from '../world/Pos';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;

const ZOOM_SENSITIVITY = 0.0015;
const ZOOM_SMOOTHNESS = 14;

export class Camera2D {
    private _x = 0;
    private _y = 0;

    private _zoom = 1;
    private targetZoom = 1;

    get x(): number {
        return this._x;
    }

    get y(): number {
        return this._y;
    }

    get zoom(): number {
        return this._zoom;
    }

    setPosition(
        x: number,
        y: number,
    ): void {
        this._x = x;
        this._y = y;
    }

    addWheelZoom(delta: number): void {
        if (delta === 0) {
            return;
        }

        const factor = Math.exp(
            -delta * ZOOM_SENSITIVITY,
        );

        this.targetZoom = clamp(
            this.targetZoom * factor,
            MIN_ZOOM,
            MAX_ZOOM,
        );
    }

    update(deltaSeconds: number): void {
        const interpolation =
            1 -
            Math.exp(
                -ZOOM_SMOOTHNESS * deltaSeconds,
            );

        this._zoom +=
            (this.targetZoom - this._zoom) *
            interpolation;
    }

    apply(
        container: Container,
        viewportWidth: number,
        viewportHeight: number,
    ): void {
        container.scale.set(this._zoom);

        container.position.set(
            viewportWidth * 0.5 -
            this._x * this._zoom,

            viewportHeight * 0.5 -
            this._y * this._zoom,
        );
    }

    screenToWorld(
        screenX: number,
        screenY: number,
        viewportWidth: number,
        viewportHeight: number,
    ): Pos {
        return {
            x:
                this._x +
                (screenX - viewportWidth * 0.5) /
                this._zoom,

            y:
                this._y +
                (screenY - viewportHeight * 0.5) /
                this._zoom,
        };
    }
}

