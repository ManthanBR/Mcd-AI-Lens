import { Settings } from "./settings"
import { fetchFile } from "@ffmpeg/util"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.recordSegments = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.audioVideoStream = null
    this.canvasStream = null
  }

  async startRecording(liveRenderTarget, constraints) {
    try {
      this.audioVideoStream = await navigator.mediaDevices.getUserMedia(constraints)
      const audioTrack = this.audioVideoStream.getAudioTracks()[0]
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
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })
        this.recordSegments.push(blob)
      }

      this.mediaRecorder.start()
      return true
    } catch (error) {
      console.error("Error accessing media devices:", error)
      return false
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
  }

  async finalizeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }

    const mergedBlob = await this.mergeSegments()
    this.uiManager.showLoading(false)
    const url = URL.createObjectURL(mergedBlob)
    this.uiManager.displayPostRecordButtons(url, mergedBlob)
  }

  async mergeSegments() {
    if (this.recordSegments.length === 1) {
      return this.recordSegments[0]
    }

    const ffmpeg = this.videoProcessor.ffmpeg
    const { baseURL, coreURL, wasmURL, outputOptions } = Settings.ffmpeg

    await ffmpeg.load({
      coreURL: `${baseURL}/${coreURL}`,
      wasmURL: `${baseURL}/${wasmURL}`,
    })

    for (let i = 0; i < this.recordSegments.length; i++) {
      await ffmpeg.writeFile(`input${i}.mp4`, await fetchFile(this.recordSegments[i]))
    }

    const concatList = this.recordSegments.map((_, i) => `file 'input${i}.mp4'`).join('\n')
    await ffmpeg.writeFile('concat.txt', concatList)

    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', ...outputOptions, 'output.mp4'])
    const output = await ffmpeg.readFile('output.mp4')
    return new Blob([output.buffer], { type: Settings.recording.mimeType })
  }

  resetRecordingVariables() {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.recordSegments = []
    if (this.audioVideoStream) {
      this.audioVideoStream.getTracks().forEach((track) => track.stop())
      this.audioVideoStream = null
    }
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => track.stop())
      this.canvasStream = null
    }
  }
}
