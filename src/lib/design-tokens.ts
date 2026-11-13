export const colors = {
  purple: "#7357E8",
  pink: "#FF91B6",
  mint: "#58D9B0",
  yellow: "#FFD66D",
  blue: "#76B8FF",
  cream: "#FFF9F0",
  ink: "#28304A",
  white: "#FFFFFF",
  purpleSoft: "#EFEAFF",
  mintSoft: "#E6FBF4",
  pinkSoft: "#FFE8F1",
  yellowSoft: "#FFF6D9",
} as const;

export const penPalette = [
  colors.ink,
  colors.purple,
  colors.pink,
  colors.mint,
  colors.blue,
  colors.yellow,
  "#E85D5D",
  colors.white,
] as const;

export const motion = {
  toolMs: 160,
  entranceMs: 420,
  celebrateMs: 700,
} as const;

export const copy = {
  emptyCanvas: "Your ideas start here!",
  emptyHint: "Draw, write, or add a photo whenever you're ready.",
  firstDrawing: "Nice start!",
  saved: "All saved!",
  saving: "Saving…",
  saveError: "We couldn't save your work yet. Please try again.",
  emptyUpload: "Choose a picture to add.",
  invalidUpload: "That picture didn't work. Try a PNG, JPG, or WebP.",
  tooLargeUpload: "That picture is too big. Try one under 10 MB.",
  welcomeTitle: "Ready to make your first discovery?",
  welcomeBody: "Draw something, then tell Pip about it!",
  startCreating: "Start creating",
  continueCreating: "Continue my adventure",
  clearTitle: "Clear your canvas?",
  clearBody: "This removes your drawings, writing, and pictures. You can undo if you change your mind.",
} as const;
