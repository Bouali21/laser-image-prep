# Laser Image Prep

Turn photos into black-and-white images ready for laser engraving. Pick a material preset, fine-tune, or build a step-by-step recipe, then download a PNG at the right size and DPI or a LightBurn project.

Inspired by https://imag-r.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep a private library of uploaded photos and the prepared outputs saved from them.
- Prepare an image in one click from 12 material presets.
- Crop, rotate, flip and fine-tune brightness, contrast and sharpness with a before/after preview.
- Edit with recorded steps: tone, grayscale, sharpening, geometry, threshold, halftone and 12 dither algorithms, with undo and redo.
- Save step lists as workflows, share them with your organization, and export or import them as JSON.
- Run a workflow on one image or a batch, with output size, a final dither and a ZIP download.

Left out: accounts and sign-in, which your Gateway handles; plans and daily limits; AI upscaling, background removal and material detection; a public workflow store; vector, QR and other extra tools; SVG input.

## Setup

```sh
pnpm install
pnpm dev            # run locally behind the local Gateway
pnpm test           # unit tests
pnpm run deploy     # deploy to your Cloudflare account through your Gateway
```

There are no secrets or settings to fill in. The app uses a D1 database and an R2 bucket (`files`), which the deploy creates; R2 must be enabled on the Cloudflare account once.

The checks in `checks/` run against a packaged release with the EveryApp validation runtime. Real deployment was not part of them.

## Limitations

- Image processing runs in the browser, so very large photos (over 4000 px on a side are scaled down) can take a few seconds per step on slower machines.
- Uploads and saved outputs are limited to 25 MB each.
- LightBurn projects place the image at its physical size with default engraving settings; set power and speed in LightBurn.
