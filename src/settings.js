/**
 * Camera Kit Web Demo Settings
 * Centralized configuration for the application
 */

export const Settings = {
  // Camera settings
  camera: {
    fps: 60,
    constraints: {
      front: {
        video: {
          facingMode: { exact: "user" },
        },
        audio: true, // Ensure audio is requested
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
        },
        audio: true, // Ensure audio is requested
      },
      desktop: {
        video: {
          facingMode: "user",
        },
        audio: true, // Ensure audio is requested
      },
    },
  },

  // Recording settings
  recording: {
    mimeType: "video/mp4", // "video/webm;codecs=vp9" or "video/mp4"
    fps: 60,
    outputFileName: "RanveerSinghMeal.mp4",
    audioBitsPerSecond: 128000,     // Standard audio quality
    includeLensAudio: true,         // NEW: Whether to try and include lens audio
    fallbackToMicOnlyOnError: true, // NEW: If mixing fails, try mic only
  },

  // FFmpeg settings
  ffmpeg: {
    enabled: true,                  // NEW: General enable/disable for FFmpeg processing
    baseURL: "/ffmpeg",
    coreURL: "ffmpeg-core.js",
    wasmURL: "ffmpeg-core.wasm",
    outputOptions: ["-movflags", "faststart", "-c", "copy"], // Default options
  },

  // UI settings
  ui: {
    recordButton: {
      startImage: "./assets/RecordButton.png",
      stopImage: "./assets/RecordStop.png",
    },
    assets: {
      poweredBySnap: "./assets/Powered_bysnap.png",
      recordOutline: "./assets/RecordOutline.png",
      shareButton: "./assets/ShareButton.png",
      downloadButton: "./assets/DownloadButton.png",
      backButton: "./assets/BackButton.png",
      loadingIcon: "./assets/LoadingIcon.png", // This was used by the old global loader, new one is CSS only
    },
  },
}