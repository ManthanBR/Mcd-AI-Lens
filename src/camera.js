import { createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import { Settings } from "./settings"

export class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    this.isBackFacing = true
    this.mediaStream = null
    this.currentSource = null // To store the current Camera Kit source
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
      session.pause() // Pause session before changing source
      this.mediaStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.mediaStream = null
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
      const newSource = createMediaStreamSource(this.mediaStream, { // Renamed to newSource
        cameraType: this.isBackFacing ? "environment" : "user",
        disableSourceAudio: false,
      })
      this.currentSource = newSource // Update current source reference

      await session.setSource(newSource) // Use newSource
      if (!this.isBackFacing) {
        newSource.setTransform(Transform2D.MirrorX)
      }
      // It's crucial that setRenderSize is called on this newSource as well.
      // This will be handled by uiManager.updateRenderSize call in main.js's switchButton listener
      await session.play()
      return newSource // Return the newly created source
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
}