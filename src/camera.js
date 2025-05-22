import { createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import { Settings } from "./settings"

export class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    this.mediaStream = null
  }

  async initializeCamera() {
    if (!this.isMobile) {
      document.body.classList.add("desktop")
    }
    // Always get constraints for the default camera (back on mobile, user on desktop)
    this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints())
    return this.mediaStream
  }

  // updateCamera method removed as switching is disabled

  getConstraints() {
    // Default to back camera on mobile, user (desktop) otherwise
    return this.isMobile ? Settings.camera.constraints.back : Settings.camera.constraints.desktop
  }
}