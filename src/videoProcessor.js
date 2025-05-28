import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"
import { Settings } from "./settings"

export class VideoProcessor {
  constructor() {
    this.ffmpeg = new FFmpeg()
  }

  async fixVideoDuration(blob) {
    if (this.ffmpeg.loaded) {
        console.log("FFmpeg already loaded.");
    } else {
        try {
            console.log("Loading FFmpeg...");
            const { baseURL, coreURL, wasmURL } = Settings.ffmpeg; // outputOptions used in exec

            // Construct full URLs. Ensure baseURL ends with a '/' if coreURL/wasmURL don't start with one.
            // Or, more robustly, use URL constructor if paths might be relative.
            // Assuming baseURL is like "/ffmpeg" and coreURL is "ffmpeg-core.js"
            const fullCoreURL = `${baseURL.replace(/\/$/, "")}/${coreURL.replace(/^\//, "")}`;
            const fullWasmURL = `${baseURL.replace(/\/$/, "")}/${wasmURL.replace(/^\//, "")}`;


            console.log("Loading FFmpeg with URLs:", {
                coreURL: fullCoreURL,
                wasmURL: fullWasmURL,
            });

            await this.ffmpeg.load({
                coreURL: fullCoreURL,
                wasmURL: fullWasmURL,
            });
            console.log("FFmpeg loaded successfully");
        } catch (error) {
            console.error("Error loading FFmpeg:", error);
            throw error; // Re-throw to be caught by caller
        }
    }
    
    try {
      const { outputOptions } = Settings.ffmpeg;
      await this.ffmpeg.writeFile("input.mp4", await fetchFile(blob))
      console.log("FFmpeg: Wrote input.mp4. Executing command...");
      // Example: ffmpeg -i input.mp4 -movflags faststart -c copy output.mp4
      await this.ffmpeg.exec(["-i", "input.mp4", ...outputOptions, "output.mp4"])
      console.log("FFmpeg: Command executed. Reading output file...");
      const fixedData = await this.ffmpeg.readFile("output.mp4")
      console.log("FFmpeg: Output file read.");
      return new Blob([fixedData.buffer], { type: Settings.recording.mimeType })
    } catch (error) {
      console.error("Error in FFmpeg video processing (fixVideoDuration):", error)
      // Consider terminating FFmpeg if it's in a bad state, though it might recover on next call
      // await this.ffmpeg.terminate();
      throw error // Re-throw to be caught by caller
    }
  }
}