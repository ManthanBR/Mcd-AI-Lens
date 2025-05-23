import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.canvasStream = null
  }

  async startRecording(liveRenderTarget, mediaStream) {
    try {
      if (!mediaStream || mediaStream.getTracks().length === 0) {
        console.error("Recording failed: no active media stream")
        return false
      }

      const audioTrack = mediaStream.getAudioTracks().find((t) => t.kind === "audio")
      if (!audioTrack) {
        console.error("No audio track found — cannot start recording with audio.")
        return false
      }

      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      this.canvasStream.addTrack(audioTrack)

      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        this.uiManager.showLoading(true)
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })
        const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
        const url = URL.createObjectURL(fixedBlob)
        this.uiManager.showLoading(false)
        this.uiManager.displayPostRecordButtons(url, fixedBlob)
      }

      this.mediaRecorder.start()
      return true
    } catch (error) {
      console.error("Error during recording:", error)
      return false
    }
  }

  resetRecordingVariables() {
    this.mediaRecorder = null
    this.recordedChunks = []
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => track.stop())
      this.canvasStream = null
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
  }
}
