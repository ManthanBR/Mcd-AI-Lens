import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"
import { Settings } from "./settings"

export class VideoProcessor {
  constructor() {
    this.ffmpeg = new FFmpeg()
    this.ffmpegLoaded = false; // Track loading state
  }

  async loadFFmpeg() {
    if (this.ffmpegLoaded) {
        return;
    }
    console.log("Loading FFmpeg...");
    const { baseURL, coreURL, wasmURL } = Settings.ffmpeg;

    // Construct full URLs. If baseURL is absolute, it will be used directly.
    // If baseURL is relative (like '/ffmpeg'), it's relative to the domain.
    const resolveURL = (base, path) => new URL(path, base.endsWith('/') ? base : base + '/').href;

    let actualBaseURL = baseURL;
    // If baseURL is a relative path like "/ffmpeg", make it absolute based on current origin
    if (baseURL.startsWith('/')) {
        actualBaseURL = new URL(baseURL, window.location.origin).href;
    }
    
    const fullCoreURL = resolveURL(actualBaseURL, coreURL);
    const fullWasmURL = resolveURL(actualBaseURL, wasmURL);
    // For @ffmpeg/core-mt, workerURL might be needed
    // const fullWorkerURL = Settings.ffmpeg.workerURL ? resolveURL(actualBaseURL, Settings.ffmpeg.workerURL) : undefined;


    console.log("Loading FFmpeg with URLs:", {
        coreURL: fullCoreURL,
        wasmURL: fullWasmURL,
        // workerURL: fullWorkerURL,
    });

    await this.ffmpeg.load({
        coreURL: fullCoreURL,
        wasmURL: fullWasmURL,
        // workerURL: fullWorkerURL, // for multi-threaded version
    });

    this.ffmpegLoaded = true;
    console.log("FFmpeg loaded successfully");
  }

  async fixVideoDuration(blob) {
    try {
      await this.loadFFmpeg(); // Ensure FFmpeg is loaded

      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp4';

      await this.ffmpeg.writeFile(inputFileName, await fetchFile(blob))
      // Example FFmpeg command, ensure it's what you need.
      // The command `-c copy` assumes the input codec is suitable for MP4.
      // If input is webm, you might need to transcode, e.g., `-c:v libx264 -c:a aac`
      await this.ffmpeg.exec(["-i", inputFileName, ...Settings.ffmpeg.outputOptions, outputFileName])
      const fixedData = await this.ffmpeg.readFile(outputFileName)
      
      // Clean up files from FFmpeg's virtual file system
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);

      return new Blob([fixedData.buffer], { type: Settings.recording.mimeType })
    } catch (error) {
      console.error("Error in fixVideoDuration:", error)
      // Attempt to terminate FFmpeg if it's running and an error occurs
      // if (this.ffmpeg.isLoaded() && !this.ffmpeg.isTerminated()) { // Methods depend on FFmpeg version
      //   try { await this.ffmpeg.terminate(); } catch (e) { console.error("Error terminating ffmpeg", e)}
      // }
      this.ffmpegLoaded = false; // Reset loaded state on error so it tries to load again next time
      throw error
    }
  }
}