// BubbleBackground (see components/animate-ui/components/backgrounds/bubble)
// takes its colors as bare "r,g,b" strings, not full CSS colors - it
// interpolates them into rgba(...) itself. Mapped from our own palette
// (court green / clay orange / tennis ball / court blue) so the auth
// pages' background reads as TennisBuild, not animate-ui's default
// violet/blue demo colors.
export const AUTH_BUBBLE_COLORS = {
  first: "27,94,58", // --court-green
  second: "193,84,28", // --clay-orange
  third: "215,255,63", // --ball
  fourth: "18,63,39", // --court-green-dark
  fifth: "95,180,233", // --tier-current
  sixth: "233,194,95", // --tier-legend
};
