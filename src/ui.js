// --- START OF FILE ui.js ---
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
    if (!isRecording && this.recordPressedCount % 2 !== 0) {
        this.recordPressedCount++;
    } else if (isRecording && this.recordPressedCount % 2 === 0) {
        this.recordPressedCount++;
    }
  }


  showLoading(show) {
    // Ensure #loading has display: flex in CSS for this to center properly
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
      // It's good practice to revoke the object URL when no longer needed,
      // but ensure it's not revoked too early if share button might use it.
      // URL.revokeObjectURL(url); // Consider timing of this
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
      this.recordPressedCount = 0;

      if (mediaRecorder) {
        mediaRecorder.resetRecordingVariables()
      }
      if (cameraManager) {
        const liveRenderTarget = document.getElementById("canvas")
        const currentSource = cameraManager.getSource()
        if (currentSource && liveRenderTarget) {
          // Call updateRenderSize to ensure canvas styles are reapplied correctly
          this.updateRenderSize(currentSource, liveRenderTarget)
        }
      }
       if(url) URL.revokeObjectURL(url); // Revoke here as we are done with post-record screen
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!liveRenderTarget) { // Source might be null initially if called before source is ready
        console.warn("updateRenderSize called with invalid liveRenderTarget.");
        return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Log current state for debugging
    // console.log(`Canvas OLD style: ${liveRenderTarget.style.width} x ${liveRenderTarget.style.height}`);
    // console.log(`Canvas OLD attributes: ${liveRenderTarget.width} x ${liveRenderTarget.height}`);

    // ONLY set the CSS style for display size, matching the original working version
    liveRenderTarget.style.width = `${width}px`;
    liveRenderTarget.style.height = `${height}px`;

    // DO NOT set canvas.width and canvas.height attributes here
    // liveRenderTarget.width = width; // REMOVED
    // liveRenderTarget.height = height; // REMOVED
    
    // console.log(`Canvas NEW style: ${liveRenderTarget.style.width} x ${liveRenderTarget.style.height}`);
    // console.log(`Canvas attributes after (should be unchanged by this func): ${liveRenderTarget.width} x ${liveRenderTarget.height}`);

    // Tell CameraKit the desired render resolution for the source
    if (source && typeof source.setRenderSize === 'function') {
        source.setRenderSize(width, height);
    } else if (source) {
        // console.warn("Source object in updateRenderSize is invalid or does not have setRenderSize method for this call.");
    }
  }
}