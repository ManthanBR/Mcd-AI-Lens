import { Settings } from "./settings"
import { fetchFile } from "@ffmpeg/util"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.liveRenderTarget = null
    this.constraints = null

    this.segments = []
    this.mediaRecorder = null
    this.recording = false

    this.audioStream = null
    this.canvasStream = null
    this.recordedChunks = []
  }

  async startRecording(liveRenderTarget, constraints) {
    this.liveRenderTarget = liveRenderTarget
    this.constraints = constraints
    this.recording = true
    await this._startNewSegment()
    return true
  }

  async _startNewSegment() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia(this.constraints)
      const audioTrack = this.audioStream.getAudioTracks()[0]

      this.canvasStream = this.liveRenderTarget.captureStream(Settings.recording.fps)
      this.canvasStream.addTrack(audioTrack)

      this.recordedChunks = []
      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })
        this.segments.push(blob)
        this._cleanupStreams()
      }

      this.mediaRecorder.start()
    } catch (error) {
      console.error("Failed to start segment:", error)
    }
  }

  async switchCameraSegment() {
    if (!this.recording) return
    await this.stopCurrentSegment()
    await new Promise((res) => setTimeout(res, 300)) // give time for onstop
    await this._startNewSegment()
  }

  async stopCurrentSegment() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
  }

  _cleanupStreams() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop())
      this.audioStream = null
    }
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((t) => t.stop())
      this.canvasStream = null
    }
  }

  async finalizeRecording() {
    this.recording = false
    await this.stopCurrentSegment()
    await new Promise((res) => setTimeout(res, 500)) // ensure stop completes

    this.uiManager.showLoading(true)

    const finalBlob = await this._mergeSegments()
    const url = URL.createObjectURL(finalBlob)

    this.uiManager.showLoading(false)
    this.uiManager.displayPostRecordButtons(url, finalBlob)

    // Reset
    this.segments = []
  }

  async _mergeSegments() {
    if (this.segments.length === 1) return this.segments[0]

    const ffmpeg = this.videoProcessor.ffmpeg
    const { baseURL, coreURL, wasmURL, outputOptions } = Settings.ffmpeg

    await ffmpeg.load({
      coreURL: `${baseURL}/${coreURL}`,
      wasmURL: `${baseURL}/${wasmURL}`,
    })

    for (let i = 0; i < this.segments.length; i++) {
      await ffmpeg.writeFile(`seg${i}.mp4`, await fetchFile(this.segments[i]))
    }

    const concatText = this.segments.map((_, i) => `file 'seg${i}.mp4'`).join("\n")
    await ffmpeg.writeFile("segments.txt", concatText)

    await ffmpeg.exec([
      "-f", "concat", "-safe", "0", "-i", "segments.txt",
      ...outputOptions,
      "output.mp4"
    ])

    const outputData = await ffmpeg.readFile("output.mp4")
    return new Blob([outputData.buffer], { type: Settings.recording.mimeType })
  }

  resetRecordingVariables() {
    this._cleanupStreams()
    this.mediaRecorder = null
    this.segments = []
    this.recording = false
  }
}
