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
        audio: true, // Request audio for the main camera stream
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
        },
        audio: true, // Request audio for the main camera stream
      },
      desktop: {
        video: {
          facingMode: "user", // On desktop, 'exact' might be too restrictive
        },
        audio: true, // Request audio for the main camera stream
      },
    },
  },

  // Recording settings
  recording: {
    mimeType: "video/mp4", // "video/webm; codecs=vp9" or "video/mp4"
    fps: 30, // Canvas captureStream fps
    outputFileName: "recording.mp4",
  },

  // FFmpeg settings
  ffmpeg: {
    baseURL: "/ffmpeg", // Assumes ffmpeg files are served from a '/ffmpeg' directory at the root of your web server. Adjust if needed.
    coreURL: "ffmpeg-core.js",
    wasmURL: "ffmpeg-core.wasm",
    // If using @ffmpeg/core-mt, a workerURL might also be needed:
    // workerURL: `${baseURL}/ffmpeg-core.worker.js`,
    outputOptions: ["-movflags", "faststart", "-c", "copy"],
  },

  // UI settings
  ui: {
    recordButton: {
      startImage: "./assets/RecordButton.png", // Relative to HTML document
      stopImage: "./assets/RecordStop.png",   // Relative to HTML document
    },
    assets: { // These paths are relative to the HTML document
      poweredBySnap: "./assets/Powered_bysnap.png",
      recordOutline: "./assets/RecordOutline.png",
      shareButton: "./assets/ShareButton.png",
      downloadButton: "./assets/DownloadButton.png",
      backButton: "./assets/BackButton.png",
      loadingIcon: "./assets/LoadingIcon.png",
    },
  },
}