import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"
import { Settings } from "./settings"

export class VideoProcessor {
  constructor() {
    this.ffmpeg = new FFmpeg()
  }

  async fixVideoDuration(blob) {
    try {
      const { baseURL, coreURL, wasmURL, outputOptions } = Settings.ffmpeg

      await this.ffmpeg.load({
        coreURL: `${baseURL}/${coreURL}`,
        wasmURL: `${baseURL}/${wasmURL}`,
      })

      await this.ffmpeg.writeFile("input.mp4", await fetchFile(blob))
      await this.ffmpeg.exec(["-i", "input.mp4", ...outputOptions, "output.mp4"])
      const fixedData = await this.ffmpeg.readFile("output.mp4")
      await this.ffmpeg.exit() // Release WASM memory
      return new Blob([fixedData.buffer], { type: Settings.recording.mimeType })
    } catch (error) {
      console.error("Error in fixVideoDuration:", error)
      throw error
    }
  }
}
