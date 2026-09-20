import * as stylex from "@stylexjs/stylex";
import { fonts } from "./tokens.stylex";

export const typography = stylex.create({
  body: {
    fontFamily: fonts.body,
    fontSize: fonts.bodySize,
    fontWeight: fonts.regular,
    lineHeight: fonts.bodyLeading,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fonts.labelSize,
    fontWeight: fonts.medium,
    lineHeight: fonts.labelLeading,
  },
  heading: {
    fontFamily: fonts.body,
    fontSize: fonts.headingSize,
    fontWeight: fonts.medium,
    lineHeight: fonts.headingLeading,
    letterSpacing: fonts.headingTracking,
  },
  display: {
    fontFamily: fonts.body,
    fontSize: fonts.displaySize,
    fontWeight: fonts.medium,
    lineHeight: fonts.displayLeading,
    letterSpacing: fonts.displayTracking,
  },
});
