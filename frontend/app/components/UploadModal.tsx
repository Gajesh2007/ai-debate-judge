"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { useCredits } from "../contexts/CreditsContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface UploadModalProps {
  onClose: () => void;
  onSubmit: (data: {
    topic: string;
    description?: string;
    thumbnail?: string;
    transcript?: string;
  }) => void;
  isLoading: boolean;
}

type Step = "input" | "transcribing" | "review";

export function UploadModal({ onClose, onSubmit, isLoading }: UploadModalProps) {
  const { getToken } = useCredits();
  const [step, setStep] = useState<Step>("input");
  const [isDragging, setIsDragging] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"text" | "audio">("text");
  const [transcriptionProgress, setTranscriptionProgress] = useState("");
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.filter(f => 
      f.type.startsWith("audio/") || 
      f.name.endsWith(".mp3") || 
      f.name.endsWith(".wav") ||
      f.name.endsWith(".m4a")
    );
    
    if (audioFile.length > 0) {
      setMode("audio");
      setAudioFiles(prev => [...prev, ...audioFile]);
    } else {
      const textFile = files[0];
      if (textFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setTranscript(text);
          setMode("text");
        };
        reader.readAsText(textFile);
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAudioFiles(prev => [...prev, ...files]);
    setMode("audio");
  }, []);

  const handleThumbnailSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setThumbnail(data.url);
    } catch (error) {
      console.error("Thumbnail upload error:", error);
      const reader = new FileReader();
      reader.onload = (event) => {
        setThumbnail(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setThumbnailUploading(false);
    }
  }, []);

  const removeAudioFile = (index: number) => {
    setAudioFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTranscribe = async () => {
    if (audioFiles.length === 0) return;

    setStep("transcribing");
    setTranscriptionError(null);
    setTranscriptionProgress("Uploading audio files...");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Please sign in to transcribe audio");
      }

      // Step 1: Upload audio files directly to Vercel Blob (client-side)
      const audioUrls: string[] = [];
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const sizeMb = (file.size / 1024 / 1024).toFixed(1);
        setTranscriptionProgress(`Uploading ${file.name} (${sizeMb}MB) - ${i + 1}/${audioFiles.length}...`);
        
        const blob = await upload(`audio/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload-audio",
        });
        
        audioUrls.push(blob.url);
      }

      // Step 2: Send URLs to backend for transcription
      setTranscriptionProgress("Transcribing... This may take a few minutes for large files.");

      const response = await fetch(`${API_URL}/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ audioUrls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }

      setTranscript(data.text);
      setTranscriptionProgress("");
      setStep("review");
      setMode("text"); // Switch to text mode to show transcript
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscriptionError(error instanceof Error ? error.message : "Transcription failed");
      setStep("input");
    }
  };

  const handleSubmit = () => {
    if (!topic.trim() || !transcript.trim()) return;

    onSubmit({
      topic: topic.trim(),
      description: description.trim() || undefined,
      thumbnail: thumbnail || undefined,
      transcript: transcript.trim(),
    });
  };

  const canTranscribe = audioFiles.length > 0;
  const canSubmit = topic.trim() && transcript.trim();

  // Transcribing state
  if (step === "transcribing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
        <div className="card max-w-md w-full animate-scale-in">
          <div className="p-8 text-center">
            <div className="mb-6">
              <svg className="animate-spin w-12 h-12 mx-auto text-[var(--accent-mint)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium mb-2">Transcribing Audio</h3>
            <p className="text-secondary mb-4">{transcriptionProgress}</p>
            <div className="text-xs text-secondary font-mono">
              {audioFiles.map(f => f.name).join(", ")}
            </div>
            <p className="text-xs text-secondary mt-4">
              Large files are automatically chunked and processed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-surface)] border-b border-subtle px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-medium">
            {step === "review" ? "Review Transcript" : "Judge a Debate"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-ghost p-2 -mr-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium mb-2">
              What&apos;s the debate about?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Should remote work be the default?"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Short description <span className="text-secondary font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who's debating? What's the context?"
              disabled={isLoading}
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Cover image <span className="text-secondary font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              {thumbnail ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
                  <Image
                    src={thumbnail}
                    alt="Thumbnail"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setThumbnail(null)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
                    disabled={isLoading}
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={isLoading || thumbnailUploading}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  {thumbnailUploading ? (
                    <svg className="animate-spin w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-secondary">Add</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
                disabled={isLoading || thumbnailUploading}
              />
              <span className="text-xs text-secondary">PNG, JPG up to 4MB</span>
            </div>
          </div>

          {/* Mode toggle - only show in input step */}
          {step === "input" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "text" 
                    ? "bg-[var(--accent-mint)] text-white" 
                    : "bg-[var(--bg-elevated)] text-secondary hover:text-[var(--text-primary)]"
                }`}
                disabled={isLoading}
              >
                Paste transcript
              </button>
              <button
                type="button"
                onClick={() => setMode("audio")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "audio" 
                    ? "bg-[var(--accent-mint)] text-white" 
                    : "bg-[var(--bg-elevated)] text-secondary hover:text-[var(--text-primary)]"
                }`}
                disabled={isLoading}
              >
                Upload audio
              </button>
            </div>
          )}

          {/* Transcription error */}
          {transcriptionError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <strong>Transcription failed:</strong> {transcriptionError}
            </div>
          )}

          {/* Content area */}
          {mode === "text" || step === "review" ? (
            <div>
              <label className="block text-sm font-medium mb-2">
                {step === "review" ? (
                  <>
                    Review transcript 
                    <span className="text-secondary font-normal ml-2">(edit if needed)</span>
                  </>
                ) : (
                  "Debate transcript"
                )}
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste the full transcript here. The AI will identify speakers automatically."
                rows={step === "review" ? 12 : 8}
                className="font-mono text-sm resize-none"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-secondary font-mono">
                {transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} words
              </p>
              {step === "review" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("input");
                    setMode("audio");
                  }}
                  className="mt-2 text-xs text-[var(--accent-mint)] hover:underline"
                >
                  ← Re-upload audio
                </button>
              )}
            </div>
          ) : (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`drop-zone p-8 text-center cursor-pointer ${isDragging ? "dragging" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isLoading}
                />
                <div className="mb-3">
                  <svg className="w-10 h-10 mx-auto text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <p className="font-medium mb-1">Drop audio files here</p>
                <p className="text-sm text-secondary">MP3, WAV, M4A · Up to 300MB</p>
              </div>

              {audioFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {audioFiles.map((file, index) => {
                    const sizeMb = file.size / 1024 / 1024;
                    const sizeStr = sizeMb >= 1 
                      ? `${sizeMb.toFixed(1)} MB` 
                      : `${(file.size / 1024).toFixed(0)} KB`;
                    return (
                      <div 
                        key={index}
                        className="flex items-center justify-between bg-[var(--bg-elevated)] rounded-lg px-4 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-mono text-sm truncate">{file.name}</span>
                          <span className="text-xs text-secondary whitespace-nowrap">{sizeStr}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAudioFile(index);
                          }}
                          className="text-secondary hover:text-[var(--text-primary)] ml-4"
                          disabled={isLoading}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {/* Total size indicator */}
                  <p className="text-xs text-secondary font-mono pt-1">
                    Total: {(audioFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1)} MB
                    {audioFiles.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024 && (
                      <span className="text-[var(--accent-amber)] ml-2">
                        (will be processed in chunks)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--bg-surface)] border-t border-subtle px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          
          {/* Audio mode: Transcribe button */}
          {mode === "audio" && step === "input" ? (
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={!canTranscribe || isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Transcribe Audio
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                "Analyze Debate"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
