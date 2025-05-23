// ui.js
import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.actionButton = document.getElementById("action-buttons")
    this.switchButton = document.getElementById("switch-button")
    this.loadingIcon = document.getElementById("loading")
    this.backButtonContainer = document.getElementById("back-button-container")
    this.backButton = document.getElementById("back-button") // Get the button itself
    this.recordPressedCount = 0

    // Dependencies to be set by main.js
    this.mediaRecorder = null
    this.getCurrentCameraKitSource = null
    this.liveRenderTarget = null
  }

  // Method to set dependencies from main.js
  setDependencies(mediaRecorder, getCurrentCameraKitSource, liveRenderTarget) {
    this.mediaRecorder = mediaRecorder
    this.getCurrentCameraKitSource = getCurrentCameraKitSource
    this.liveRenderTarget = liveRenderTarget
  }

  toggleRecordButton(isVisible) {
    if (isVisible) {
      this.recordOutline.style.display = "block"
      this.recordButton.style.display = "block"
    } else {
      this.recordOutline.style.display = "none"
      this.recordButton.style.display = "none"
    }
  }

  updateRecordButtonState(isRecording) {
    this.recordButton.style.backgroundImage = isRecording ? `url('${Settings.ui.recordButton.stopImage}')` : `url('${Settings.ui.recordButton.startImage}')`
    if (!isRecording && this.recordPressedCount % 2 !== 0) { // If stopping
        this.recordPressedCount++; // Ensure count is even after stop
    } else if (isRecording) {
        this.recordPressedCount++; // Increment for start
    }
  }

  showLoading(show) {
    this.loadingIcon.style.display = show ? "block" : "none"
  }

  displayPostRecordButtons(url, fixedBlob) {
    this.actionButton.style.display = "block"
    this.backButtonContainer.style.display = "block"
    this.switchButton.style.display = "none"
    this.toggleRecordButton(false) // Hide record button

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      a.click()
      a.remove()
      URL.revokeObjectURL(url); // Clean up object URL after download
    }

    document.getElementById("share-button").onclick = async () => {
      try {
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recorded Video",
            text: "Check out this recording!",
          })
          console.log("File shared successfully")
        } else {
          console.error("Sharing files is not supported on this device.")
          alert("Sharing not supported on this device. Try downloading.")
        }
      } catch (error) {
        console.error("Error while sharing:", error)
        alert("Error sharing file.")
      }
    }

    // Centralized back button logic
    this.backButton.onclick = async () => {
      console.log("UIManager: Back button clicked from post-record screen.");
      this.actionButton.style.display = "none"
      this.backButtonContainer.style.display = "none"
      this.switchButton.style.display = "block"
      this.toggleRecordButton(true)
      this.updateRecordButtonState(false); // Ensure record button shows record icon

      // Clean up recording resources and update render size
      if (this.mediaRecorder) {
        this.mediaRecorder.resetRecordingVariables()
      }
      if (this.getCurrentCameraKitSource && this.liveRenderTarget) {
        const source = this.getCurrentCameraKitSource()
        if (source) {
            this.updateRenderSize(source, this.liveRenderTarget) // Call the corrected updateRenderSize
        } else {
            console.warn("Could not get current camera kit source for resize on back button press.")
        }
      }
      URL.revokeObjectURL(url); // Clean up object URL when going back
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!source || !liveRenderTarget) {
        console.warn("updateRenderSize called with null source or liveRenderTarget");
        return;
    }
    const width = window.innerWidth
    const height = window.innerHeight

    // Set the CSS display size of the canvas
    liveRenderTarget.style.width = `${width}px`
    liveRenderTarget.style.height = `${height}px`

    // --- REMOVE THESE LINES ---
    // liveRenderTarget.width = width;
    // liveRenderTarget.height = height;
    // --- END REMOVE ---

    // Set the rendering resolution via Camera Kit API
    source.setRenderSize(width, height)
    console.log(`Camera Kit render size updated to: ${width}x${height} via source.setRenderSize. CSS display size also set.`);
  }
}