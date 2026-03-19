import { NextRequest, NextResponse } from "next/server";

async function getGeniusUrl(title: string, artist: string): Promise<string | null> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  const q = artist ? `${title} ${artist}` : title;
  const res = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;

  const data = await res.json();
  return data.response?.hits?.[0]?.result?.url ?? null;
}

function extractGeniusLyrics(html: string): string | null {
  const parts = html.split('data-lyrics-container="true"');
  if (parts.length < 2) return null;

  let lyrics = "";
  for (let i = 1; i < parts.length; i++) {
    const afterOpen = parts[i].slice(parts[i].indexOf(">") + 1);
    let depth = 1;
    let j = 0;
    let content = "";
    while (j < afterOpen.length && depth > 0) {
      if (afterOpen.slice(j).startsWith("<div")) depth++;
      else if (afterOpen.slice(j).startsWith("</div")) {
        depth--;
        if (depth === 0) break;
      }
      content += afterOpen[j];
      j++;
    }
    const text = content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (text) lyrics += (lyrics ? "\n\n" : "") + text;
  }

  return lyrics || null;
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title") ?? "";
  const artist = req.nextUrl.searchParams.get("artist") ?? "";

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const url = await getGeniusUrl(title, artist);
  if (!url) return NextResponse.json({ error: "No Genius result found" }, { status: 404 });

  const pageRes = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  });
  if (!pageRes.ok) return NextResponse.json({ error: "Could not fetch lyrics page" }, { status: 502 });

  const html = await pageRes.text();
  const lyrics = extractGeniusLyrics(html);
  if (!lyrics) return NextResponse.json({ error: "Could not parse lyrics" }, { status: 422 });

  const firstLine = lyrics.split("\n").find((l) => l.trim() && !l.trim().startsWith("[")) ?? "";

  return NextResponse.json({ lyrics, first_line: firstLine, source_url: url });
}
