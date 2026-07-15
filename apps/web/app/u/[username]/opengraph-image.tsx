import { ImageResponse } from "next/og";
import { BrandMark, getBrandOgImageOptions } from "@/lib/og-image";

export const alt = "Musician profile on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(<BrandMark />, await getBrandOgImageOptions(size));
}
