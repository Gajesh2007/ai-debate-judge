import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type (audio only)
  if (!file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "File must be an audio file" }, { status: 400 });
  }

  // Validate file size (max 300MB)
  if (file.size > 300 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be less than 300MB" }, { status: 400 });
  }

  try {
    const blob = await put(`audio/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload audio file" },
      { status: 500 }
    );
  }
}

