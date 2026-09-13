import type { PlayerInputState } from './PlayerInputState';

interface PointerPosition {
    x: number;
    y: number;
}

export class InputManager {
    private readonly pressedKeys = new Set<string>();

    private readonly playerInput: PlayerInputState = {
        moveX: 0,
        moveY: 0,

        aimX: 0,
        aimY: 0,
    };

    private readonly pointerPosition: PointerPosition = {
        x: 0,
        y: 0,
    };

    private wheelDelta = 0;

    constructor(private readonly canvas: HTMLCanvasElement) {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);

        this.canvas.addEventListener('pointermove', this.onPointerMove);

        this.canvas.addEventListener('wheel', this.onWheel, {
            passive: false,
        });
    }

    getPlayerInput(
        aimX: number,
        aimY: number,
    ): Readonly<PlayerInputState> {
        let x = 0;
        let y = 0;

        if (this.pressedKeys.has('KeyA')) {
            x -= 1;
        }

        if (this.pressedKeys.has('KeyD')) {
            x += 1;
        }

        if (this.pressedKeys.has('KeyW')) {
            y -= 1;
        }

        if (this.pressedKeys.has('KeyS')) {
            y += 1;
        }

        if (x !== 0 && y !== 0) {
            x *= Math.SQRT1_2;
            y *= Math.SQRT1_2;
        }

        this.playerInput.moveX = x;
        this.playerInput.moveY = y;

        this.playerInput.aimX = aimX;
        this.playerInput.aimY = aimY;

        return this.playerInput;
    }

    getPointerPosition(): Readonly<PointerPosition> {
        return this.pointerPosition;
    }

    consumeWheelDelta(): number {
        const delta = this.wheelDelta;

        this.wheelDelta = 0;

        return delta;
    }

    destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);

        this.canvas.removeEventListener(
            'pointermove',
            this.onPointerMove,
        );

        this.canvas.removeEventListener(
            'wheel',
            this.onWheel,
        );
    }

    private readonly onKeyDown = (
        event: KeyboardEvent,
    ): void => {
        this.pressedKeys.add(event.code);
    };

    private readonly onKeyUp = (
        event: KeyboardEvent,
    ): void => {
        this.pressedKeys.delete(event.code);
    };

    private readonly onBlur = (): void => {
        this.pressedKeys.clear();
    };

    private readonly onPointerMove = (
        event: PointerEvent,
    ): void => {
        const rect =
            this.canvas.getBoundingClientRect();

        this.pointerPosition.x =
            event.clientX - rect.left;

        this.pointerPosition.y =
            event.clientY - rect.top;
    };

    private readonly onWheel = (
        event: WheelEvent,
    ): void => {
        event.preventDefault();

        this.wheelDelta += event.deltaY;
    };
}