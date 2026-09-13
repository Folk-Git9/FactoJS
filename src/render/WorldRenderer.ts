import { Container, type Application } from 'pixi.js';

import type { World } from '../world/World';

import { BuildingRenderer } from './BuildingRenderer';
import { Camera2D } from './Camera2D';
import { Frustum2D } from './Frustum2D';
import { GridRenderer } from './GridRenderer';
import { PlacementPreviewRenderer } from './PlacementPreviewRenderer';
import { PlayerRenderer } from './PlayerRenderer';
import { TerrainRenderer } from './TerrainRenderer';

const CULL_PADDING_PIXELS = 96;

export class WorldRenderer {
    readonly camera = new Camera2D();

    readonly frustum = new Frustum2D();

    private readonly backgroundRoot = new Container();

    private readonly foregroundRoot = new Container();

    private readonly terrainLayer = new Container();

    private readonly gridLayer = new Container();

    private readonly entityLayer = new Container();

    private readonly effectsLayer = new Container();

    private readonly buildingLayer = new Container();

    private readonly placementLayer = new Container();

    private readonly terrainRenderer: TerrainRenderer;

    private readonly gridRenderer: GridRenderer;

    private readonly playerRenderer: PlayerRenderer;

    private readonly buildingRenderer: BuildingRenderer;

    private readonly placementPreviewRenderer: PlacementPreviewRenderer;

    constructor(private readonly app: Application) {
        this.backgroundRoot.addChild(this.terrainLayer);

        this.foregroundRoot.addChild(
            this.buildingLayer,
            this.placementLayer,
            this.entityLayer,
            this.effectsLayer,
        );

        this.app.stage.addChild(this.backgroundRoot, this.gridLayer, this.foregroundRoot);

        this.terrainRenderer = new TerrainRenderer(this.terrainLayer);

        this.gridRenderer = new GridRenderer(this.gridLayer);

        this.playerRenderer = new PlayerRenderer(this.entityLayer);

        this.buildingRenderer = new BuildingRenderer(this.buildingLayer);

        this.placementPreviewRenderer = new PlacementPreviewRenderer(this.placementLayer);
    }

    screenToWorld(
        screenX: number,
        screenY: number,
    ): {
        x: number;
        y: number;
    } {
        const viewport = this.app.renderer.screen;

        return this.camera.screenToWorld(screenX, screenY, viewport.width, viewport.height);
    }

    addZoomInput(delta: number): void {
        this.camera.addWheelZoom(delta);
    }

    updateView(world: World, interpolationAlpha: number, deltaSeconds: number): void {
        const player = world.player;

        const playerRenderX = player.previousX + (player.x - player.previousX) * interpolationAlpha;

        const playerRenderY = player.previousY + (player.y - player.previousY) * interpolationAlpha;

        this.camera.setPosition(playerRenderX, playerRenderY);

        this.camera.update(deltaSeconds);

        const viewport = this.app.renderer.screen;

        this.frustum.update(this.camera, viewport.width, viewport.height, CULL_PADDING_PIXELS);

        this.camera.apply(this.backgroundRoot, viewport.width, viewport.height);

        this.camera.apply(this.foregroundRoot, viewport.width, viewport.height);
    }

    render(world: World, interpolationAlpha: number): void {
        this.terrainRenderer.render(world.map, this.frustum);

        const viewport = this.app.renderer.screen;

        this.gridRenderer.render(
            this.camera,
            this.frustum,
            world.map,
            viewport.width,
            viewport.height,
            this.app.renderer.resolution,
        );

        this.buildingRenderer.render(world, this.frustum);

        this.placementPreviewRenderer.render(world);

        this.playerRenderer.render(world.player, interpolationAlpha, this.frustum);

        this.playerRenderer.render(world.player, interpolationAlpha, this.frustum);
    }

    destroy(): void {
        this.terrainRenderer.destroy();

        this.buildingRenderer.destroy();

        this.placementPreviewRenderer.destroy();

        this.playerRenderer.destroy();

        this.app.stage.removeChild(this.backgroundRoot, this.gridLayer, this.foregroundRoot);

        this.backgroundRoot.destroy({
            children: true,
        });

        this.gridLayer.destroy({
            children: true,
        });

        this.foregroundRoot.destroy({
            children: true,
        });
    }
}
