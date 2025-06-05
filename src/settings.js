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
        audio: true,
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
        },
        audio: true,
      },
      desktop: {
        video: {
          facingMode: "user",
        },
        audio: true,
      },
    },
  },

  // Recording settings
  recording: {
    mimeType: "video/mp4", // This is the FINAL output format after FFmpeg
    audioMimeType: "audio/webm; codecs=opus", // Recommended for intermediate audio recording
    videoMimeTypeForCanvas: "video/webm", // Using webm for video for consistency
    fps: 60,
    outputFileName: "RanveerSinghMeal.mp4",
  },

  // FFmpeg settings
  ffmpeg: {
    baseURL: "/ffmpeg", // Make sure this path is correct for your server setup
    coreURL: "ffmpeg-core.js",
    wasmURL: "ffmpeg-core.wasm",
    // outputOptions are less relevant for direct combine, but kept for other uses
    outputOptions: ["-movflags", "faststart", "-c", "copy"],
    combineOutputOptions: ["-movflags", "faststart"], // Options for the final combined output
  },

  // UI settings
  ui: {
    recordButton: {
      startImage: "./assets/RecordButton.png", // Ensure these paths are correct
      stopImage: "./assets/RecordStop.png",   // Ensure these paths are correct
    },
    assets: {
      poweredBySnap: "./assets/Powered_bysnap.png",
      recordOutline: "./assets/RecordOutline.png",
      shareButton: "./assets/ShareButton.png",
      downloadButton: "./assets/DownloadButton.png",
      backButton: "./assets/BackButton.png",
      loadingIcon: "./assets/LoadingIcon.png", // Or use a CSS loader
    },
  },
}