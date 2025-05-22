import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.actionButton = document.getElementById("action-buttons")
    // this.switchButton = document.getElementById("switch-button") // Button removed
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
    // Make sure asset paths in settings.js are correct
    this.recordButton.style.backgroundImage = isRecording ? `url('${Settings.ui.recordButton.stopImage}')` : `url('${Settings.ui.recordButton.startImage}')`
    if (isRecording) {
        this.recordPressedCount = 1; // Explicitly set to recording state count
    } else {
        this.recordPressedCount = 0; // Reset count when stopping or initially
    }
  }


  showLoading(show) {
    this.loadingIcon.style.display = show ? "flex" : "none" // Use flex for centering if needed
  }

  displayPostRecordButtons(url, fixedBlob) {
    this.actionButton.style.display = "flex" // Use flex for layout if needed
    this.backButtonContainer.style.display = "block"
    // this.switchButton.style.display = "none" // Button removed

    // Ensure handlers are fresh or properly managed if called multiple times
    const downloadButton = document.getElementById("download-button");
    const shareButton = document.getElementById("share-button");
    const backButton = document.getElementById("back-button");

    // Remove previous listeners if necessary, or structure so they aren't duplicated
    // For simplicity here, we assume they are set once or the elements are recreated/replaced

    downloadButton.onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      document.body.appendChild(a) // Append to body for Firefox compatibility
      a.click()
      document.body.removeChild(a) // Clean up
      // Consider revoking the object URL if it's no longer needed after download/share
      // URL.revokeObjectURL(url); // Be careful if URL is needed elsewhere (e.g., preview)
    }

    shareButton.onclick = async () => {
      try {
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Ranveer Singh Meal",
            text: "Made By FilterYou | A True Social Xperience",
          })
          console.log("File shared successfully")
        } else {
           // Fallback or message for unsupported sharing
           alert("Sharing files is not supported on this browser/device or requires HTTPS.")
           console.error("navigator.canShare returned false or is undefined.")
        }
      } catch (error) {
         // Handle potential errors during sharing (e.g., user cancellation)
         if (error.name !== 'AbortError') {
             console.error("Error while sharing:", error)
             alert(`Error sharing file: ${error.message}`);
         } else {
             console.log("Sharing aborted by user.")
         }
      }
    }

    // This back button logic is now managed in main.js's event listener
    // We remove the onclick assignment here to avoid conflicts if main.js adds its own.
    // backButton.onclick = ... (handled in main.js)
  }

  updateRenderSize(source, liveRenderTarget) {
    const width = window.innerWidth
    const height = window.innerHeight

    liveRenderTarget.width = width // Set canvas drawing dimensions
    liveRenderTarget.height = height
    liveRenderTarget.style.width = `${width}px` // Set canvas display dimensions
    liveRenderTarget.style.height = `${height}px`

    // Check if source is valid before calling setRenderSize
     if (source && typeof source.setRenderSize === 'function') {
        source.setRenderSize(width, height).catch(error => {
           console.error("Error setting render size:", error);
        });
     } else {
        console.warn("Source object is invalid or does not have setRenderSize method during resize.");
     }
  }
}