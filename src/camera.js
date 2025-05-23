import { createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import { Settings } from "./settings"

export class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    this.isBackFacing = true
    this.mediaStream = null
  }

  async initializeCamera() {
    if (!this.isMobile) {
      document.body.classList.add("desktop")
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
    return this.mediaStream
  }

  async updateCamera(session) {
    this.isBackFacing = !this.isBackFacing

    if (this.mediaStream) {
      session.pause()
      this.mediaStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.mediaStream = null
    }

    try {
      let stream = await navigator.mediaDevices.getUserMedia(this.getConstraints())

      // Ensure audio track is present — retry audio-only if missing
      if (stream.getAudioTracks().length === 0) {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          audioOnly.getAudioTracks().forEach(track => stream.addTrack(track))
          console.warn("Audio was missing — added audio track manually after switch.")
        } catch (err) {
          console.error("Failed to re-acquire audio after switch:", err)
        }
      }

      this.mediaStream = stream

      const source = createMediaStreamSource(this.mediaStream, {
        cameraType: this.isBackFacing ? "environment" : "user",
        disableSourceAudio: false,
      })

      await session.setSource(source)
      if (!this.isBackFacing) {
        source.setTransform(Transform2D.MirrorX)
      }

      await session.play()
      return source
    } catch (error) {
      console.error("Failed to get media stream:", error)
      throw error
    }
  }

  getConstraints() {
    return this.isMobile
      ? (this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front)
      : Settings.camera.constraints.desktop
  }
}
