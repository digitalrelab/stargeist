const minimumWidth = 320;
const maximumWidth = 480;
const minimumViewportShare = 0.35;
const maximumContentShare = 0.6;
const closeThresholdShare = 0.75;
const keyboardStep = 16;

export type WidthBounds = {
  readonly minimum: number;
  readonly maximum: number;
};

export function getWidthBounds(viewportWidth: number, containerWidth: number): WidthBounds {
  const viewport = Math.max(0, viewportWidth);
  const container = Math.max(0, containerWidth);
  const originalWidth = Math.min(minimumWidth, Math.floor(viewport * minimumViewportShare));
  const maximum = Math.min(maximumWidth, Math.floor(container * maximumContentShare));
  const minimum = Math.min(originalWidth, maximum);

  return { minimum, maximum };
}

export function clampWidth(width: number, limits: WidthBounds) {
  return Math.min(limits.maximum, Math.max(limits.minimum, Math.round(width)));
}

function pointerWidth(width: number, startX: number, currentX: number) {
  return width + startX - currentX;
}

export function widthFromPointer(
  width: number,
  startX: number,
  currentX: number,
  limits: WidthBounds,
) {
  return clampWidth(pointerWidth(width, startX, currentX), limits);
}

export function shouldCloseFromPointer(
  width: number,
  startX: number,
  currentX: number,
  limits: WidthBounds,
) {
  return pointerWidth(width, startX, currentX) <= limits.minimum * closeThresholdShare;
}

export function widthFromKey(key: string, width: number, limits: WidthBounds) {
  let next;

  if (key === "ArrowLeft") {
    next = width + keyboardStep;
  } else if (key === "ArrowRight") {
    next = width - keyboardStep;
  } else if (key === "Home") {
    next = limits.minimum;
  } else if (key === "End") {
    next = limits.maximum;
  } else {
    return undefined;
  }

  return clampWidth(next, limits);
}
