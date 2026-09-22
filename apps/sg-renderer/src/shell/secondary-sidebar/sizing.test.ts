import { expect, it } from "vite-plus/test";
import {
  clampWidth,
  getWidthBounds,
  shouldCloseFromPointer,
  widthFromKey,
  widthFromPointer,
} from "./sizing";

const standardBounds = { minimum: 320, maximum: 480 };
const narrowBounds = { minimum: 168, maximum: 190 };

it("uses the original sidebar width as its minimum", () => {
  expect(getWidthBounds(1_100, 852)).toEqual({ minimum: 320, maximum: 480 });
  expect(getWidthBounds(800, 552)).toEqual({ minimum: 280, maximum: 331 });
  expect(getWidthBounds(481, 317)).toEqual({ minimum: 168, maximum: 190 });
});

it("lets the available maximum override the minimum in constrained layouts", () => {
  expect(getWidthBounds(1_100, 400)).toEqual({ minimum: 240, maximum: 240 });
});

it("constrains widths to the available range", () => {
  expect(clampWidth(100, standardBounds)).toBe(320);
  expect(clampWidth(600, standardBounds)).toBe(480);
  expect(clampWidth(180, narrowBounds)).toBe(180);
});

it("resizes a right-hand sidebar from the keyboard", () => {
  expect(widthFromKey("ArrowLeft", 320, standardBounds)).toBe(336);
  expect(widthFromKey("ArrowRight", 336, standardBounds)).toBe(320);
  expect(widthFromKey("Home", 400, standardBounds)).toBe(320);
  expect(widthFromKey("End", 400, standardBounds)).toBe(480);
  expect(widthFromKey("PageUp", 400, standardBounds)).toBeUndefined();
});

it("resizes a right-hand sidebar in the direction of pointer movement", () => {
  expect(widthFromPointer(320, 500, 460, standardBounds)).toBe(360);
  expect(widthFromPointer(360, 500, 540, standardBounds)).toBe(320);
  expect(widthFromPointer(320, 500, 0, standardBounds)).toBe(480);
});

it("closes after dragging beyond the open-width minimum", () => {
  expect(shouldCloseFromPointer(320, 500, 579, standardBounds)).toBe(false);
  expect(shouldCloseFromPointer(320, 500, 580, standardBounds)).toBe(true);
  expect(shouldCloseFromPointer(480, 500, 740, standardBounds)).toBe(true);
});
