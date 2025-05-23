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

    // Initial aria-label for record button (if it exists on load)
    if (this.recordButton) {
        this.recordButton.setAttribute('aria-label', 'Start Recording');
    }
  }

  toggleRecordButton(isVisible) {
    if (isVisible) {
      this.recordOutline.style.display = "block"
      this.recordButton.style.display = "block"
      this.recordButton.disabled = false;
    } else {
      this.recordOutline.style.display = "none"
      this.recordButton.style.display = "none"
      // Optionally disable when not visible if it can still receive focus somehow
      // this.recordButton.disabled = true;
    }
  }

  updateRecordButtonState(isRecording) {
    if (isRecording) {
        this.recordButton.style.backgroundImage = `url('${Settings.ui.recordButton.stopImage}')`
        this.recordButton.setAttribute('aria-label', 'Stop Recording');
    } else {
        this.recordButton.style.backgroundImage = `url('${Settings.ui.recordButton.startImage}')`
        this.recordButton.setAttribute('aria-label', 'Start Recording');
    }
    this.recordPressedCount++
  }

  showLoading(show) {
    this.loadingIcon.style.display = show ? "flex" : "none"; // Use flex for centering if CSS is set up for it
  }

  displayPostRecordButtons(url, fixedBlob) {
    this.actionButton.style.display = "flex" // Use flex for better layout if needed
    this.backButtonContainer.style.display = "block" // Or "flex"
    this.switchButton.style.display = "none"
    this.toggleRecordButton(false); // Hide record button

    const downloadButton = document.getElementById("download-button");
    const shareButton = document.getElementById("share-button");
    const backButton = document.getElementById("back-button"); // Get fresh reference or ensure it's always the same

    // Remove previous listeners to prevent multiple attachments if this function is called again
    const newDownloadButton = downloadButton.cloneNode(true);
    downloadButton.parentNode.replaceChild(newDownloadButton, downloadButton);
    
    const newShareButton = shareButton.cloneNode(true);
    shareButton.parentNode.replaceChild(newShareButton, shareButton);

    const newBackButton = backButton.cloneNode(true);
    backButton.parentNode.replaceChild(newBackButton, backButton);


    newDownloadButton.onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      document.body.appendChild(a) // Append to body for Firefox compatibility
      a.click()
      document.body.removeChild(a) // Clean up
      // URL.revokeObjectURL(url) // Consider when to revoke: perhaps on back or after a timeout
    }

    newShareButton.onclick = async () => {
      try {
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recorded Video",
            text: "Check out this recording!",
          })
          console.log("File shared successfully")
        } else if (navigator.share) { // Fallback for systems that don't support canShare but have share
           await navigator.share({
            files: [file],
            title: "Recorded Video",
            text: "Check out this recording!",
          })
          console.log("File shared successfully (fallback).");
        }
        else {
          console.warn("Sharing files is not supported on this device or for this file type.")
          alert("Sharing is not available on this device/browser.");
        }
      } catch (error) {
        // Common error: AbortError if user cancels share dialog
        if (error.name !== 'AbortError') {
            console.error("Error while sharing:", error)
            alert("Error sharing file.");
        } else {
            console.log("Sharing cancelled by user.");
        }
      }
    }

    newBackButton.onclick = async () => { // This is the primary back button handler post-recording
      this.actionButton.style.display = "none"
      this.backButtonContainer.style.display = "none"
      this.switchButton.style.display = "block"
      this.toggleRecordButton(true)
      this.updateRecordButtonState(false) // Reset record button to 'start' state
      this.recordPressedCount = 0 // Reset count for next recording session

      // It's good practice to revoke object URLs when no longer needed
      URL.revokeObjectURL(url); 
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!source || !liveRenderTarget) {
        console.warn("updateRenderSize called with invalid source or render target.");
        return;
    }
    const width = window.innerWidth
    const height = window.innerHeight

    liveRenderTarget.style.width = `${width}px`
    liveRenderTarget.style.height = `${height}px`
    liveRenderTarget.width = width; // Also set canvas backing store size
    liveRenderTarget.height = height;

    try {
        source.setRenderSize(width, height)
    } catch (e) {
        console.error("Error setting render size on source in UIManager:", e, source);
    }
  }
}