/**
 * Camera Kit Web Demo Settings
 * Centralized configuration for the application
 */

export const Settings = {
  // Camera settings
  camera: {
    fps: 60, // Target FPS, actual may vary
    constraints: {
      front: {
        video: {
          facingMode: { exact: "user" },
          // Consider adding width/height constraints if specific resolutions are desired
          // width: { ideal: 1280 },
          // height: { ideal: 720 },
        },
        audio: true,
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
          // width: { ideal: 1280 },
          // height: { ideal: 720 },
        },
        audio: true,
      },
      desktop: { // Typically front-facing on desktop
        video: {
          facingMode: "user",
          // width: { ideal: 1280 },
          // height: { ideal: 720 },
        },
        audio: true,
      },
    },
  },

  // Recording settings
  recording: {
    mimeType: "video/mp4", // "video/webm" is more widely supported if mp4 causes issues
    fps: 30, // MediaRecorder captureStream FPS, might differ from camera FPS
    outputFileName: "recording.mp4",
  },

  // FFmpeg settings
  ffmpeg: {
    // These paths are relative to the public/static folder where your server serves them from.
    // E.g. if ffmpeg files are in public/ffmpeg/, then baseURL should be '/ffmpeg'
    baseURL: "/ffmpeg", // Ensure this points to the directory containing the core and wasm files
    coreURL: "ffmpeg-core.js",
    wasmURL: "ffmpeg-core.wasm",
    // -c copy attempts to copy codecs without re-encoding, faster but less flexible
    // -movflags faststart is good for web streaming as it moves metadata to the front
    outputOptions: ["-movflags", "faststart", "-c:v", "copy", "-c:a", "copy"], // Be careful with -c copy if codecs are problematic
    // If -c copy fails, try re-encoding:
    // outputOptions: ["-movflags", "faststart", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac"],
  },

  // UI settings
  ui: {
    recordButton: {
      startImage: "./assets/RecordButton.png", // Path relative to where CSS is served or component is
      stopImage: "./assets/RecordStop.png",
    },
    // Asset paths used directly in HTML should be relative to the HTML file's location.
    // Asset paths used in CSS (like background-image) are relative to the CSS file.
    // Asset paths used in JS (like new Image().src) depend on how JS resolves them (often relative to HTML or base URL).
    // The ones below are likely for JS if creating image elements, ensure paths are correct.
    assets: {
      poweredBySnap: "./assets/Powered_bysnap.png",
      recordOutline: "./assets/RecordOutline.png",
      shareButton: "./assets/ShareButton.png",
      downloadButton: "./assets/DownloadButton.png",
      backButton: "./assets/BackButton.png",
      loadingIcon: "./assets/LoadingIcon.png",
      switchButton: "./assets/SwitchButton.png" // Added switch button for completeness if used in JS
    },
  },
}