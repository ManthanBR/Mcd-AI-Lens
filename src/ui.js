import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline") // This is an <img> tag
    this.actionButton = document.getElementById("action-buttons")
    this.switchButton = document.getElementById("switch-button")
    this.loadingIcon = document.getElementById("loading") // This is the <div> container for the loading image
    this.backButtonContainer = document.getElementById("back-button-container")
    this.recordPressedCount = 0
  }

  toggleRecordButton(isVisible) {
    if (isVisible) {
      this.recordOutline.style.display = "block" // Assuming outline is an image/element to show
      this.recordButton.style.display = "block"
    } else {
      this.recordOutline.style.display = "none"
      this.recordButton.style.display = "none"
    }
  }

  updateRecordButtonState(isRecording) {
    this.recordButton.style.backgroundImage = isRecording ? `url('${Settings.ui.recordButton.stopImage}')` : `url('${Settings.ui.recordButton.startImage}')`
    if (!isRecording && this.recordPressedCount % 2 !== 0) { // If stopping
        this.recordPressedCount++;
    } else if (isRecording && this.recordPressedCount % 2 === 0) { // If starting
        this.recordPressedCount++;
    }
  }


  showLoading(show) {
    // #loading is the div container
    this.loadingIcon.style.display = show ? "flex" : "none";
  }

  displayPostRecordButtons(url, fixedBlob, mediaRecorder, cameraManager) {
    this.actionButton.style.display = "flex"
    this.backButtonContainer.style.display = "block"
    this.switchButton.style.display = "none"
    this.toggleRecordButton(false)

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Consider revoking URL if it's a one-time download and share isn't used, or after both.
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
      this.recordPressedCount = 0; // Reset count for a fresh start

      if (mediaRecorder) {
        mediaRecorder.resetRecordingVariables() // Explicitly reset recorder state
      }
      // No need to call updateRenderSize explicitly here if window.resize handles it,
      // unless there's a specific state that resize doesn't cover on back navigation.
      // However, to be safe and ensure consistency:
      if (cameraManager) {
        const liveRenderTarget = document.getElementById("canvas")
        const currentSource = cameraManager.getSource()
        if (currentSource && liveRenderTarget) {
          this.updateRenderSize(currentSource, liveRenderTarget)
        }
      }
       if(url) URL.revokeObjectURL(url); // Clean up object URL as we are leaving this screen
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!liveRenderTarget) {
        console.warn("updateRenderSize called with invalid liveRenderTarget.");
        return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;

    // ONLY set the CSS style for display size
    liveRenderTarget.style.width = `${width}px`;
    liveRenderTarget.style.height = `${height}px`;

    // DO NOT set canvas.width and canvas.height attributes here.
    // Let CameraKit or the browser manage the drawing buffer size based on source.setRenderSize.
    
    // Tell CameraKit the desired render resolution for the source
    if (source && typeof source.setRenderSize === 'function') {
        source.setRenderSize(width, height);
    } else {
        // This might happen if source is not yet initialized or is unexpectedly null
        // console.warn("Source object in updateRenderSize is invalid or does not have setRenderSize method.");
    }
  }
}