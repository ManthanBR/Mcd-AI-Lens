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
    this.recordPressedCount++
  }

  showLoading(show) {
    this.loadingIcon.style.display = show ? "block" : "none"
  }

  displayPostRecordButtons(url, fixedBlob) {
    this.actionButton.style.display = "block"
    this.backButtonContainer.style.display = "block"
    this.switchButton.style.display = "none"

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      a.click()
      a.remove()
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
        }
      } catch (error) {
        console.error("Error while sharing:", error)
      }
    }

    document.getElementById("back-button").onclick = async () => {
      this.actionButton.style.display = "none"
      this.backButtonContainer.style.display = "none"
      this.switchButton.style.display = "block"
      this.toggleRecordButton(true)
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    const width = window.innerWidth
    const height = window.innerHeight

    liveRenderTarget.style.width = `${width}px`
    liveRenderTarget.style.height = `${height}px`
    source.setRenderSize(width, height)
  }

  
}
export const mobile = {
  // Detect if the device supports touch
  hasTouchSupport() {
    return (
      'ontouchstart' in window || 
      navigator.maxTouchPoints > 0 || 
      window.matchMedia('(pointer: coarse)').matches
    );
  },

  // Custom log function
  log(...args) {
    if (!this.hasTouchSupport()) return;

    // Format output
    let output = args.map((arg) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg, null, 2);
      }
      return arg;
    }).join(" ");

    // Check if the log viewer already exists
    const hasMobileViewer = document.getElementById("mobileLog");
    if (hasMobileViewer) {
      const updatedContent = hasMobileViewer.innerHTML.concat("<br>").concat(output);
      hasMobileViewer.innerHTML = updatedContent;
      hasMobileViewer.scrollTop = hasMobileViewer.scrollHeight;
      return;
    }

    // Create the log viewer
    const viewer = document.createElement("div");
    viewer.id = "mobileLog";
    viewer.style.width = "100vw";
    viewer.style.height = "30vh";
    viewer.style.backgroundColor = "white";
    viewer.style.padding = "10px";
    viewer.style.overflowY = "scroll";
    viewer.style.position = "absolute";
    viewer.style.bottom = "0px";
    viewer.style.left = "0px";
    viewer.style.zIndex = "9999";
    viewer.style.fontFamily = "monospace";
    viewer.innerHTML = output;

    // Add the viewer to the document
    document.body.appendChild(viewer);

    // Remove the viewer when clicked
    viewer.onclick = () => {
      viewer.parentElement?.removeChild(viewer);
    };
  },
};