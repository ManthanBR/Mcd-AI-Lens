/**
 * Camera Kit Web Demo Settings
 * Centralized configuration for the application
 */

export const Settings = {
  // Camera settings
  camera: {
    fps: 60, // FPS for the CameraKit rendering loop (live preview)
    targetResolution: { // Desired output resolution for recording
      width: 1080,
      height: 1920,
    },
    constraints: {
      front: {
        video: {
          facingMode: { exact: "user" },
          // Optional: you could try to guide getUserMedia towards this aspect ratio
          // width: { ideal: 1080 },
          // height: { ideal: 1920 },
        },
        audio: true,
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
          // width: { ideal: 1080 },
          // height: { ideal: 1920 },
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
    mimeType: "video/mp4",
    fps: 30, // FPS for the actual MediaRecorder output.
    outputFileName: "recording_1080x1920.mp4", // Updated filename
  },

  // FFmpeg settings
  ffmpeg: {
    baseURL: "/ffmpeg", // Ensure this path is correct for your dev server setup
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
      poweredBySnap: "./assets.Powered_bysnap.png", // Note: Typo corrected in previous step, ensure paths are correct
      recordOutline: "./assets/RecordOutline.png",
      shareButton: "./assets/ShareButton.png",
      downloadButton: "./assets/DownloadButton.png",
      backButton: "./assets/BackButton.png",
      loadingIcon: "./assets/LoadingIcon.png",
    },
  },
}