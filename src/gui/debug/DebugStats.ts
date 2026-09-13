const SAMPLE_INTERVAL_SECONDS = 0.25;

export class DebugStats {
    private sampleElapsed = 0;
    private sampleFrames = 0;
    private sampleTicks = 0;

    private _fps = 0;
    private _ups = 0;

    private _deltaSeconds = 0;
    private _frameTimeMs = 0;

    get fps(): number {
        return this._fps;
    }

    get ups(): number {
        return this._ups;
    }

    get deltaSeconds(): number {
        return this._deltaSeconds;
    }

    get frameTimeMs(): number {
        return this._frameTimeMs;
    }

    frame(deltaSeconds: number, ticksThisFrame: number): void {
        this._deltaSeconds = deltaSeconds;
        this._frameTimeMs = deltaSeconds * 1000;

        this.sampleElapsed += deltaSeconds;
        this.sampleFrames++;
        this.sampleTicks += ticksThisFrame;

        if (this.sampleElapsed < SAMPLE_INTERVAL_SECONDS) {
            return;
        }

        this._fps = this.sampleFrames / this.sampleElapsed;

        this._ups = this.sampleTicks / this.sampleElapsed;

        this.sampleElapsed = 0;
        this.sampleFrames = 0;
        this.sampleTicks = 0;
    }
}
