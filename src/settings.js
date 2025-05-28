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
          aspectRatio: { ideal: 9 / 16 }, // Request 9:16 aspect ratio
        },
        audio: true,
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
          aspectRatio: { ideal: 9 / 16 }, // Request 9:16 aspect ratio
        },
        audio: true,
      },
      desktop: {
        video: {
          facingMode: "user",
          aspectRatio: { ideal: 9 / 16 }, // Keep 9:16 for consistency, or use 16/9 if landscape preferred for desktop
        },
        audio: true,
      },
    },
  },

  // Recording settings
  recording: {
    mimeType: "video/mp4",
    fps: 60,
    outputFileName: "recording.mp4",
  },

  // FFmpeg settings
  ffmpeg: {
    baseURL: "/ffmpeg",
    coreURL: "ffmpeg-core.js",
    wasmURL: "ffmpeg-core.wasm",
    outputOptions: ["-movflags", "faststart", "-c", "copy"],
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
      loadingIcon: "./assets/LoadingIcon.png",
    },
  },
}