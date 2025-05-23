import { createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import { Settings } from "./settings"

export class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    this.isBackFacing = true
    this.mediaStream = null
    this.source = null // Keep track of the current source
  }

  async initializeCamera(session) {
    if (!this.isMobile) {
      document.body.classList.add("desktop")
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
    
    this.source = createMediaStreamSource(this.mediaStream, {
      cameraType: this.isBackFacing ? "environment" : "user",
      disableSourceAudio: false, // Ensure audio is enabled for recording
    })

    await session.setSource(this.source)

    if (!this.isBackFacing) {
      this.source.setTransform(Transform2D.MirrorX)
    }
    
    // Return both mediaStream and source for convenience if needed by caller
    return { mediaStream: this.mediaStream, source: this.source }
  }

  async updateCamera(session) {
    this.isBackFacing = !this.isBackFacing

    if (this.mediaStream) {
      await session.pause() // Pause session before stopping tracks
      this.mediaStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.mediaStream = null
      this.source = null // Clear old source
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
      this.source = createMediaStreamSource(this.mediaStream, {
        cameraType: this.isBackFacing ? "environment" : "user",
        disableSourceAudio: false, // Ensure audio is enabled for recording
      })

      await session.setSource(this.source)
      if (!this.isBackFacing) {
        this.source.setTransform(Transform2D.MirrorX)
      }
      // It's good practice to play session after source is set and potentially transformed
      // The caller (main.js) already does session.play(), so we might not need it here
      // await session.play() // Consider if this is needed here or if caller handles it
      return this.source
    } catch (error) {
      console.error("Failed to get media stream:", error)
      // Clean up if error occurs
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      this.source = null;
      throw error
    }
  }

  getConstraints() {
    return this.isMobile ? (this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front) : Settings.camera.constraints.desktop
  }

  getCurrentSource() {
    return this.source;
  }

  getCurrentMediaStream() {
    return this.mediaStream;
  }
}