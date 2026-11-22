import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "laser-image-prep",
  name: "Laser Image Prep",
  description:
    "Turn photos into black-and-white images ready for laser engraving, with material presets, step-by-step editing and reusable workflows.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // Uploaded photos and the prepared PNGs saved from them.
    r2: ["files"],
  },
});
