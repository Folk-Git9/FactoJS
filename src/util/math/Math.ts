export function clamp(
    value: number,
    min: number,
    max: number,
): number {
    return Math.min(
        Math.max(value, min),
        max,
    );
}

export function interpolateAngle(
    from: number,
    to: number,
    alpha: number,
): number {
    const delta =
        Math.atan2(
            Math.sin(to - from),
            Math.cos(to - from),
        );

    return from + delta * alpha;
}