import { revalidateTag } from "next/cache";

export async function POST() {
  revalidateTag("songs");
  return Response.json({ revalidated: true });
}
