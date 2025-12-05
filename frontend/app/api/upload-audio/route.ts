import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Client upload handler - generates upload URLs for large files
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate file type from pathname
        const ext = pathname.split(".").pop()?.toLowerCase();
        const audioExts = ["mp3", "wav", "m4a", "flac", "ogg", "webm", "aac"];
        
        if (!ext || !audioExts.includes(ext)) {
          throw new Error("File must be an audio file");
        }

        return {
          allowedContentTypes: [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/m4a",
            "audio/x-m4a",
            "audio/mp4",
            "audio/flac",
            "audio/ogg",
            "audio/webm",
            "audio/aac",
          ],
          maximumSizeInBytes: 300 * 1024 * 1024, // 300MB
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Audio upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}

