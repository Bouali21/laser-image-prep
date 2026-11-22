import { MM_PER_INCH } from "./size";

/**
 * A LightBurn project holding one bitmap, centred at (width/2, height/2) mm and
 * scaled so each pixel covers 25.4/dpi mm: the image's physical size.
 */
export function lightBurnProject(pngBase64: string, width: number, height: number, dpi: number): string {
  const mmPerPixel = MM_PER_INCH / dpi;
  const widthMm = width * mmPerPixel;
  const heightMm = height * mmPerPixel;
  const f = (v: number) => Number(v.toFixed(6)).toString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<LightBurnProject AppVersion="1.7.00" FormatVersion="1" MaterialHeight="0" MirrorX="False" MirrorY="False">',
    '    <CutSetting_Img type="Image">',
    '        <index Value="0"/>',
    '        <name Value="C00"/>',
    '        <maxPower Value="20"/>',
    '        <speed Value="100"/>',
    `        <interval Value="${f(mmPerPixel)}"/>`,
    `        <dpi Value="${Math.round(dpi)}"/>`,
    '        <ditherMode Value="threshold"/>',
    '    </CutSetting_Img>',
    `    <Shape Type="Bitmap" CutIndex="0" W="${width}" H="${height}" Gamma="1" Contrast="0" Brightness="0" EnhanceAmount="0" EnhanceRadius="0" EnhanceDenoise="0" File="" SourceHash="0" Data="${pngBase64}">`,
    `        <XForm>${f(mmPerPixel)} 0 0 ${f(mmPerPixel)} ${f(widthMm / 2)} ${f(heightMm / 2)}</XForm>`,
    '    </Shape>',
    '</LightBurnProject>',
    '',
  ].join("\n");
}
