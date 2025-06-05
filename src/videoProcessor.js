import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"
import { Settings } from "./settings"

export class VideoProcessor {
  constructor() {
    this.ffmpeg = new FFmpeg()
    this.isLoaded = false;
    this.isLoading = false; // To prevent concurrent load attempts
  }

  async loadFFmpeg() {
    if (this.isLoaded) {
      console.log("FFmpeg already loaded.");
      return;
    }
    if (this.isLoading) {
        console.log("FFmpeg is currently loading. Waiting...");
        // Basic wait logic, could be improved with a promise queue
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.isLoaded) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
        return;
    }

    this.isLoading = true;
    console.log("Loading FFmpeg...")
    const { baseURL, coreURL, wasmURL } = Settings.ffmpeg

    // Construct full URLs, handling potential leading/trailing slashes
    const base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
    const fullCoreURL = base + (coreURL.startsWith('/') ? coreURL.substring(1) : coreURL);
    const fullWasmURL = base + (wasmURL.startsWith('/') ? wasmURL.substring(1) : wasmURL);


    console.log("Loading FFmpeg with URLs:", {
      coreURL: fullCoreURL,
      wasmURL: fullWasmURL,
    })

    try {
        await this.ffmpeg.load({
            coreURL: fullCoreURL,
            wasmURL: fullWasmURL,
        });
        this.isLoaded = true;
        console.log("FFmpeg loaded successfully")
    } catch (error) {
        console.error("Failed to load FFmpeg:", error);
        throw error; // Re-throw to indicate failure
    } finally {
        this.isLoading = false;
    }
  }

  // Kept for potential single-stream processing, though not used in the main combine flow now
  async fixVideoDuration(videoBlob) {
    try {
      await this.loadFFmpeg();
      const inputFileName = "input_video_fix.webm"; // Assuming webm input
      const outputFileName = "output_video_fix.mp4";

      await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoBlob))
      const command = [
        "-i", inputFileName,
        "-c", "copy", // Copy codec if possible
        ...Settings.ffmpeg.combineOutputOptions, // e.g., ["-movflags", "faststart"]
        outputFileName
      ];
      console.log("Executing FFmpeg fixVideoDuration command:", command.join(" "));
      await this.ffmpeg.exec(command);
      const fixedData = await this.ffmpeg.readFile(outputFileName)
      return new Blob([fixedData.buffer], { type: Settings.recording.mimeType })
    } catch (error) {
      console.error("Error in fixVideoDuration:", error)
      throw error
    }
  }

  async combineVideoAndAudio(videoBlob, audioBlob) {
    try {
      await this.loadFFmpeg();

      // Use mime types from settings for consistency, or derive from blob.type
      const videoInputFileName = "input_video." + (Settings.recording.videoMimeTypeForCanvas.split('/')[1] || "webm");
      const audioInputFileName = "input_audio." + (Settings.recording.audioMimeType.split('/')[1].split(';')[0] || "webm");
      const outputFileName = "output_combined.mp4";

      console.log(`Writing video file (${videoInputFileName}, size: ${videoBlob.size}, type: ${videoBlob.type}) to FFmpeg FS`);
      await this.ffmpeg.writeFile(videoInputFileName, await fetchFile(videoBlob));
      console.log(`Writing audio file (${audioInputFileName}, size: ${audioBlob.size}, type: ${audioBlob.type}) to FFmpeg FS`);
      await this.ffmpeg.writeFile(audioInputFileName, await fetchFile(audioBlob));

      console.log("FFmpeg input files written.");

      const command = [
        "-i", videoInputFileName,
        "-i", audioInputFileName,
        "-c:v", "copy",         // Copy video stream as is
        "-c:a", "aac",          // Encode audio to AAC (standard for MP4)
        "-strict", "experimental", // Often needed for AAC with some FFmpeg builds
        "-map", "0:v:0",        // Map video from first input
        "-map", "1:a:0",        // Map audio from second input
        "-shortest",            // Finish encoding when the shortest input stream ends
        ...Settings.ffmpeg.combineOutputOptions,
        outputFileName
      ];

      console.log("Executing FFmpeg combine command:", command.join(" "));
      this.ffmpeg.on('log', ({ type, message }) => {
         // type can be 'fferr', 'info', etc.
         console.log(`FFMPEG (${type}):`, message);
      });
      this.ffmpeg.on('progress', ({ progress, time }) => {
        // progress is a value from 0 to 1
        // time is the current processing time in microseconds
        if (progress > 0 && progress <=1) { // Only log valid progress
            console.log(`FFMPEG Progress: ${(progress * 100).toFixed(2)}% (time: ${(time / 1000000).toFixed(2)}s)`);
        }
      });

      await this.ffmpeg.exec(command);
      console.log("FFmpeg combining complete.");

      const combinedData = await this.ffmpeg.readFile(outputFileName);
      console.log("Combined file read from FFmpeg FS, size:", combinedData.byteLength);

      // Clean up files from FFmpeg's virtual file system
      try {
        await this.ffmpeg.deleteFile(videoInputFileName);
        await this.ffmpeg.deleteFile(audioInputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        console.log("Cleaned up FFmpeg FS files.");
      } catch(e) {
        console.warn("Could not clean up FFmpeg FS files:", e);
      }

      return new Blob([combinedData.buffer], { type: Settings.recording.mimeType });
    } catch (error) {
      console.error("Error in combineVideoAndAudio:", error);
      // Log more details if possible
      if (error && error.message) {
        console.error("FFmpeg Error Message:", error.message);
      }
      throw error; // Re-throw to be caught by UI
    }
  }
}