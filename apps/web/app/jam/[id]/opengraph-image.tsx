import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BrandMark, getBrandOgImageOptions } from "@/lib/og-image";

export const alt = "Jam on SingJam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  // Crawlers arrive with no session, and metadata image routes never receive
  // the ?invite= token, so an RLS-scoped read hides every private jam's photo
  // behind the logo fallback. Read as admin: the photo it points at already
  // lives in the public jam-images bucket, so the jam id is the only secret
  // involved and the sharer is handing that out with the link.
  const supabase = supabaseAdmin();
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
