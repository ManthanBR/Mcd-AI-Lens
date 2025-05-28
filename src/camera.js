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
        // Wait a brief moment for track settings to stabilize, especially on some mobile browsers
        // This is a heuristic and might need adjustment or a more robust event-based approach
        // if dimensions are still reported as 0 initially.
        setTimeout(() => {
            const settings = videoTracks[0].getSettings()
            if (settings.width && settings.height) {
                this.streamWidth = settings.width
                this.streamHeight = settings.height
                console.log(`Camera stream dimensions updated to: ${this.streamWidth}x${this.streamHeight}`)
            } else {
                console.warn("Video track settings for width/height are undefined after timeout. Using current values:", this.streamWidth, this.streamHeight);
            }
        }, 100); // 100ms delay, adjust as needed
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
    // Try to request a common aspect ratio or resolution to get more predictable stream dimensions
    // However, the browser might override this. The actual dimensions are read from getSettings().
    const baseConstraints = this.isMobile
        ? (this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front)
        : Settings.camera.constraints.desktop;


    if (baseConstraints.video && typeof baseConstraints.video === 'object') {
        baseConstraints.video.width = { ideal: 1280 };
        baseConstraints.video.height = { ideal: 720 };
        // baseConstraints.video.aspectRatio = { ideal: 16/9 };
    } else if (baseConstraints.video === true) {
        baseConstraints.video = { width: { ideal: 1280 }, height: { ideal: 720 } };
    }
    
    return baseConstraints;
  }

  getSource() {
    return this.currentSource
  }

  getStreamDimensions() {
    // Ensure dimensions are positive, fallback to a common 16:9 if not set
    const w = this.streamWidth > 0 ? this.streamWidth : 1280; // Default fallback width
    const h = this.streamHeight > 0 ? this.streamHeight : 720; // Default fallback height
    if (this.streamWidth === 0 || this.streamHeight === 0) {
        console.warn(`getStreamDimensions returning fallback ${w}x${h} because actual dimensions are ${this.streamWidth}x${this.streamHeight}`);
    }
    return { width: w, height: h };
  }
}