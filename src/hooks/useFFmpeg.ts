"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useState, useRef, useCallback } from "react";

export function useFFmpeg() {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on("log", ({ message }) => {
      console.log(message);
    });

    ffmpeg.on("progress", ({ progress, time }) => {
      setProgress(progress * 100);
      setProgressText(`Processing: ${Math.round(progress * 100)}%`);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    setLoaded(true);
    setIsLoading(false);
  }, []);

  const processVideo = async (file: File, options: any) => {
    if (!loaded || !ffmpegRef.current) {
        throw new Error("FFmpeg not loaded yet.");
    }
    
    const ffmpeg = ffmpegRef.current;
    const inputName = `input_${file.name}`;
    
    // Determine output format
    let ext = "mp4";
    if (options.type === "gif") ext = "gif";
    else if (options.format && options.format !== "original") ext = options.format;
    
    const outputName = `output_${Date.now()}.${ext}`;

    setProgress(0);
    setProgressText("Loading file into memory...");
    
    // Write file to memory - Avoid fetchFile due to node/browser polyfill Memory limitations
    const arrayBuffer = await file.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));

    // Construct command
    // Use scale filter to resize appropriately to avoid huge memory spikes, and limit threads
    const command = ["-threads", "1", "-i", inputName];
    
    // Add specific options
    if (options.type === "video") {
        // Bitrate / Quality mapping - Force very tight buffer to avoid WASM OOM
        if (options.bitrate === "low") command.push("-b:v", "500k", "-maxrate", "500k", "-bufsize", "500k");
        else if (options.bitrate === "medium") command.push("-b:v", "1000k", "-maxrate", "1000k", "-bufsize", "1000k");
        else if (options.bitrate === "high") command.push("-b:v", "2000k", "-maxrate", "2000k", "-bufsize", "2000k");
        
        // Codec mapping
        if (options.codec === "webm" || options.format === "webm") {
            command.push("-c:v", "libvpx-vp9");
        } else {
            command.push("-c:v", "libx264");
        }
        
        // Resolution mapping setup to force a maximum constrained ratio if original is kept
        if (options.resolution === "1080p") command.push("-vf", "scale=-2:1080");
        else if (options.resolution === "720p") command.push("-vf", "scale=-2:720");
        else if (options.resolution === "480p") command.push("-vf", "scale=-2:480");
        else {
             // EVEN if original, we must limit it to 1920 to avoid crashing WASM with 4k+ videos
             command.push("-vf", "scale='min(1920,iw)':-2");
        }
        
        // FPS Mapping
        if (options.fps && options.fps !== "original") {
             command.push("-r", options.fps);
        }

        // Web optimization
        command.push("-preset", "ultrafast");
        if (options.format === "mp4" || ext === "mp4") {
            command.push("-movflags", "+faststart");
        }
    }
    
    if (options.type === "gif") {
        let fps = 15;
        let scale = 480;
        
        if (options.gifOptimization === "1") fps = 20;
        else if (options.gifOptimization === "3") fps = 10;
        
        if (options.gifResize === "small") scale = 320;
        else if (options.gifResize === "medium") scale = 640;
        else if (options.gifResize === "custom") scale = 480; // fallback
        
        command.push("-vf", `fps=${fps},scale=${scale}:-1:flags=lanczos`);
    }

    command.push(outputName);

    setProgressText("Compressing media...");
    
    // Execute command
    await ffmpeg.exec(command);

    setProgressText("Finalizing file...");
    
    // Read the result
    const data = await ffmpeg.readFile(outputName);
    
    // Clean up memory
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Cast the read file to Uint8Array for Blob creation
    const uint8Array = data as Uint8Array;
    const blob = new Blob([uint8Array.buffer as any], { type: `video/${ext}` });
    const url = URL.createObjectURL(blob);
    
    return {
        url,
        fileName: file.name.replace(/\.[^/.]+$/, "") + `_compressed.${ext}`
    };
  };

  return {
    loaded,
    isLoading,
    load,
    progress,
    progressText,
    processVideo
  };
}
