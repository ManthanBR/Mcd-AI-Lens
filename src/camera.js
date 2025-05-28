// camera.js
import { createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import { Settings } from "./settings"

export class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    this.isBackFacing = true
    this.mediaStream = null
    this.currentSource = null
    this.streamWidth = 0 // To store actual video width
    this.streamHeight = 0 // To store actual video height
  }

  _updateStreamDimensions() {
    if (this.mediaStream) {
      const videoTracks = this.mediaStream.getVideoTracks()
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings()
        this.streamWidth = settings.width || 0
        this.streamHeight = settings.height || 0
        console.log(`Camera stream dimensions set to: ${this.streamWidth}x${this.streamHeight}`)
      } else {
        this.streamWidth = 0
        this.streamHeight = 0
        console.warn("No video tracks found in mediaStream to get dimensions.")
      }
    }
  }

  async initializeCamera() {
    if (!this.isMobile) {
      document.body.classList.add("desktop")
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
    this._updateStreamDimensions() // Get dimensions after stream is initialized
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
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
      this._updateStreamDimensions() // Get dimensions for new stream

      const source = createMediaStreamSource(this.mediaStream, {
        cameraType: this.isBackFacing ? "environment" : "user",
        disableSourceAudio: false,
      })
      this.currentSource = source

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
    return this.isMobile ? (this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front) : Settings.camera.constraints.desktop
  }

  getSource() {
    return this.currentSource
  }

  getStreamDimensions() {
    // Ensure dimensions are positive, fallback to a common 16:9 if not set (though should be set)
    const w = this.streamWidth > 0 ? this.streamWidth : 1280;
    const h = this.streamHeight > 0 ? this.streamHeight : 720;
    if (this.streamWidth === 0 || this.streamHeight === 0) {
        console.warn(`getStreamDimensions returning fallback ${w}x${h} because actual dimensions are ${this.streamWidth}x${this.streamHeight}`);
    }
    return { width: w, height: h };
  }
}