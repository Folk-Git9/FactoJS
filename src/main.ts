import { Application } from 'pixi.js';
import { FactoJS } from './core/FactoJS';
import type { WorldMapConfig } from './world/map/WorldMapConfig';

import './style.css';

const WORLD_MAP_CONFIG: WorldMapConfig = {
    type: 'infinite',
    seed: 199,
};

async function initialize(): Promise<void> {
    const appElement = document.querySelector<HTMLDivElement>('#app');

    if (appElement == null) {
        throw new Error('Root element #app not found');
    }

    const app = new Application();

    await app.init({
        preference: 'webgl',

        resizeTo: window,

        background: 0x111318,

        antialias: false,

        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,

        powerPreference: 'high-performance',

        autoStart: false,
        sharedTicker: false,
    });

    appElement.appendChild(app.canvas);

    const game = new FactoJS(app, appElement, WORLD_MAP_CONFIG);

    game.start();

    window.addEventListener(
        'beforeunload',
        () => {
            game.destroy();
            app.destroy();
        },
        { once: true },
    );
}

function onInitializationError(error: unknown) {
    console.error('Failed to initialize FactoJS:', error);

    const appElement = document.querySelector<HTMLDivElement>('#app');

    if (appElement === null) {
        return;
    }

    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);

    const element = document.createElement('pre');

    element.textContent = `Failed to initialize FactoJS\n\n${message}`;

    appElement.replaceChildren(element);
}

void initialize().catch(onInitializationError);
