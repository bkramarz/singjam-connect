import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase/server";
import { BrandMark, getBrandOgImageOptions } from "@/lib/og-image";

export const alt = "Jam on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("jams")
    .select("image_url")
    .eq("id", params.id)
    .maybeSingle();

  const imageUrl = (data as any)?.image_url ?? null;

  if (imageUrl) {
    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 630, display: "flex" }}>
          <img
            src={imageUrl}
            width={1200}
            height={630}
            style={{ width: 1200, height: 630, objectFit: "cover", objectPosition: "50% 0%" }}
          />
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(<BrandMark />, await getBrandOgImageOptions(size));
}
