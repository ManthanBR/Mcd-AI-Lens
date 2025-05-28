import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.actionButton = document.getElementById("action-buttons")
    this.switchButton = document.getElementById("switch-button")
    this.loadingIcon = document.getElementById("loading")
    this.backButtonContainer = document.getElementById("back-button-container")
    this.recordPressedCount = 0
    // Dependencies like mediaRecorder, cameraManager can be set via a method or passed to specific functions if needed
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
        this.recordPressedCount++; // Ensure count is even after stopping
    } else if (isRecording && this.recordPressedCount % 2 === 0) { // If starting
        this.recordPressedCount++;
    }
    // If recordPressedCount is directly manipulated elsewhere, this simple increment might need adjustment.
  }


  showLoading(show) {
    this.loadingIcon.style.display = show ? "flex" : "none" // Use flex for centering if CSS is set up for it
  }

  displayPostRecordButtons(url, fixedBlob, mediaRecorder, cameraManager) { // Added mediaRecorder, cameraManager
    this.actionButton.style.display = "flex" // Use flex for layout if desired
    this.backButtonContainer.style.display = "block"
    this.switchButton.style.display = "none"
    this.toggleRecordButton(false) // Hide record button

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      document.body.appendChild(a) // Append to body for Firefox compatibility
      a.click()
      document.body.removeChild(a) // Clean up
      URL.revokeObjectURL(url); // Clean up object URL after some delay or if share is not used
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
          // Fallback for browsers that don't support navigator.share with files
          alert("Sharing files is not supported on this browser/device. Please download the video.")
          console.warn("navigator.canShare({ files: [file] }) returned false.")
        }
      } catch (error) {
        console.error("Error while sharing:", error)
        alert(`Error sharing file: ${error.message}`)
      }
    }

    document.getElementById("back-button").onclick = async () => {
      this.actionButton.style.display = "none"
      this.backButtonContainer.style.display = "none"
      this.switchButton.style.display = "block"
      this.toggleRecordButton(true)
      this.recordPressedCount = 0; // Reset record press count for fresh state

      if (mediaRecorder) {
        mediaRecorder.resetRecordingVariables() // Already called by onstop usually, but good for explicit back
      }
      if (cameraManager) {
        const liveRenderTarget = document.getElementById("canvas")
        const currentSource = cameraManager.getSource()
        if (currentSource && liveRenderTarget) {
          this.updateRenderSize(currentSource, liveRenderTarget)
        }
      }
       if(url) URL.revokeObjectURL(url); // Clean up object URL when going back
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!source || !liveRenderTarget) {
        console.warn("updateRenderSize called with invalid source or liveRenderTarget.");
        return;
    }
    const width = window.innerWidth
    const height = window.innerHeight

    liveRenderTarget.width = width // Set canvas buffer size
    liveRenderTarget.height = height
    liveRenderTarget.style.width = `${width}px` // Set canvas display size
    liveRenderTarget.style.height = `${height}px`
    
    source.setRenderSize(width, height)
  }
}