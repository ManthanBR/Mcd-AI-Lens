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

  // Save old stream to stop later
  const oldStream = this.mediaStream

  // Get new stream first, before stopping the old one
  try {
    this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())

    const source = createMediaStreamSource(this.mediaStream, {
      cameraType: this.isBackFacing ? "environment" : "user",
      disableSourceAudio: false,
    })

    await session.pause()
    await session.setSource(source)

    if (!this.isBackFacing) {
      source.setTransform(Transform2D.MirrorX)
    }

    await session.play()

    // Stop old tracks after new session is running
    if (oldStream) {
      oldStream.getTracks().forEach((track) => track.stop())
    }

    return source
  } catch (error) {
    console.error("Failed to switch camera:", error)
    throw error
  }
}


  getConstraints() {
    return this.isMobile ? (this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front) : Settings.camera.constraints.desktop
  }
}