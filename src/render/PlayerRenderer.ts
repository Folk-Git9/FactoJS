import { Container, Graphics } from 'pixi.js';

import { interpolateAngle } from '../util/math/Math';
import type { Player } from '../world/entity/Player';
import type { Frustum2D } from './Frustum2D';

export class PlayerRenderer {
    private readonly container = new Container();

    constructor(parent: Container) {
        this.createGraphics();

        parent.addChild(this.container);
    }

    render(player: Player, interpolationAlpha: number, frustum: Frustum2D): void {
        const x = player.previousX + (player.x - player.previousX) * interpolationAlpha;

        const y = player.previousY + (player.y - player.previousY) * interpolationAlpha;

        const visible = frustum.intersectsCircle(x, y, player.radius + 4);

        this.container.visible = visible;

        if (!visible) {
            return;
        }

        const rotation = interpolateAngle(
            player.previousRotation,
            player.rotation,
            interpolationAlpha,
        );

        this.container.position.set(x, y);

        this.container.rotation = rotation;
    }

    destroy(): void {
        this.container.destroy({
            children: true,
        });
    }

    private createGraphics(): void {
        const shadow = new Graphics();

        shadow.circle(2, 3, 14).fill({
            color: 0x000000,
            alpha: 0.25,
        });

        const body = new Graphics();

        body.circle(0, 0, 14)
            .fill({
                color: 0x1f2933,
            })
            .stroke({
                color: 0x67d7ff,
                width: 2,
            });

        const innerRing = new Graphics();

        innerRing.circle(0, 0, 8).stroke({
            color: 0x3e5968,
            width: 2,
        });

        const core = new Graphics();

        core.circle(0, 0, 4).fill({
            color: 0x89e5ff,
        });

        const directionMarker = new Graphics();

        directionMarker.circle(9, 0, 2.5).fill({
            color: 0xffffff,
        });

        this.container.addChild(shadow, body, innerRing, core, directionMarker);
    }
}
