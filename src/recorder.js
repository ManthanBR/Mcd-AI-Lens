import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.cameraManager = cameraManager
    this.canvasStream = null
    this.capturedTabAudioTrack = null // To store the original track from getDisplayMedia
    this.currentAudioSourceType = null // 'microphone', 'lens', or 'none'
  }

  async _getLensAudioTrackViaTabCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.warn("getDisplayMedia is not supported by this browser.")
      // UI alert can be handled by the caller based on fallback options
      return null
    }

    try {
      // Prompt user to pick a display surface.
      // For Lens audio, they should pick the current tab.
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Often required to get tab audio option, will provide a black/dummy video track
        audio: true, // Request audio
        // preferCurrentTab: true, // Good hint for Chrome/Edge to default/suggest current tab
        // systemAudio: 'include', // another option, but preferCurrentTab is more specific for tab audio
      })

      const audioTracks = displayStream.getAudioTracks()
      if (audioTracks.length > 0) {
        // Stop the video track(s) as we don't need them from getDisplayMedia
        displayStream.getVideoTracks().forEach((track) => track.stop())

        this.capturedTabAudioTrack = audioTracks[0] // Store the original track

        // Optional: Listen for the 'ended' event, e.g., if user stops sharing via browser UI
        this.capturedTabAudioTrack.onended = () => {
          console.log("Captured tab audio track ended (e.g., user stopped sharing via browser UI).")
          // If recording, this might affect it. MediaRecorder uses a clone.
          // Consider implications: stop recording, notify user, etc.
          if (this.isRecording()) {
             console.warn("Lens audio source stopped during recording. Recording may continue with no audio or an error might occur.");
          }
          this.capturedTabAudioTrack = null // Clear reference
        }
        console.log("Successfully captured tab audio for Lens.")
        return this.capturedTabAudioTrack
      } else {
        // No audio track found, stop all tracks from getDisplayMedia stream
        displayStream.getTracks().forEach((track) => track.stop())
        console.warn("No audio track found in the captured display stream (for Lens audio).")
        return null
      }
    } catch (err) {
      console.error("Error capturing display media for Lens audio:", err)
      if (err.name === "NotAllowedError" || err.name === "AbortError") {
        // User denied permission or cancelled the picker
        // Don't alert here; let startRecording handle fallback or notify.
        console.warn("Permission to capture tab audio was denied or cancelled.")
      } else {
        // Unexpected error
        alert(`An unexpected error occurred while trying to capture tab audio: ${err.message}`)
      }
      return null
    }
  }

  async startRecording(liveRenderTarget, cameraManagerInstance) {
    try {
      this.uiManager.showLoading(true) // Show loading early

      let audioTrackToRecord = null
      let audioSourceInfo = "No audio"

      // --- Attempt to get Lens audio (Tab Capture) ---
      // Note: This will trigger a browser prompt for screen/tab sharing.
      // The user MUST select the current tab for this to work as "Lens audio".
      // You might want to inform the user about this prompt via UI.
      console.log("Attempting to capture Lens audio (via tab capture)...")
      const lensAudioTrack = await this._getLensAudioTrackViaTabCapture()

      if (lensAudioTrack) {
        audioTrackToRecord = lensAudioTrack
        this.currentAudioSourceType = 'lens'
        audioSourceInfo = "Lens audio (from tab)"
      } else {
        console.warn("Could not capture Lens audio. Falling back to microphone.")
        // --- Fallback to Microphone Audio ---
        if (!cameraManagerInstance || !cameraManagerInstance.mediaStream) {
          console.error("CameraManager instance or its mediaStream is not available for microphone fallback.")
          // Optionally alert and stop, or proceed with video-only.
          // For this example, we'll proceed to check for microphone.
        }
        
        const micAudioTracks = cameraManagerInstance.mediaStream.getAudioTracks()
        if (micAudioTracks.length > 0) {
          audioTrackToRecord = micAudioTracks[0]
          this.currentAudioSourceType = 'microphone'
          audioSourceInfo = "Microphone audio"
          console.log("Using microphone audio track for recording.")
        } else {
          this.currentAudioSourceType = 'none'
          console.warn("No microphone audio track found for fallback. Recording video only.")
          alert("Microphone not accessible, and Lens audio could not be captured. Recording video without audio.")
        }
      }
      
      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)

      if (audioTrackToRecord) {
        this.canvasStream.addTrack(audioTrackToRecord.clone()) // Clone the track
      }

      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("MediaRecorder data available")
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder stopped")
        this.uiManager.showLoading(true)
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })
        
        let finalBlob = blob
        if (this.recordedChunks.length > 0) {
            try {
                const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
                finalBlob = fixedBlob
            } catch (ffmpegError) {
                console.error("FFmpeg processing failed:", ffmpegError)
            }
        } else {
            console.warn("No data recorded.")
            this.uiManager.showLoading(false)
            this.uiManager.toggleRecordButton(true)
            this.resetRecordingVariables() // Ensure cleanup even if no data
            return
        }
        
        const url = URL.createObjectURL(finalBlob)
        this.uiManager.showLoading(false)
        this.uiManager.displayPostRecordButtons(url, finalBlob, this, this.cameraManager)
        this.resetRecordingVariables() // Call reset after processing and UI update
      }

      this.mediaRecorder.start()
      this.uiManager.showLoading(false) // Hide loading after setup
      console.log(`Recording started with audio source: ${audioSourceInfo}`)
      return true
    } catch (error) {
      console.error("Error starting recording:", error)
      this.uiManager.showLoading(false)
      alert(`Could not start recording: ${error.message}. Please ensure permissions are granted.`)
      this.resetRecordingVariables() // Clean up if start failed
      return false
    }
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables")
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
      this.mediaRecorder.stop() // This will trigger 'onstop'
    }
    this.mediaRecorder = null
    this.recordedChunks = []

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.canvasStream = null
    }

    // Stop the captured tab audio track if it exists and is active
    if (this.capturedTabAudioTrack && this.capturedTabAudioTrack.readyState === "live") {
      console.log("Stopping captured tab audio track.")
      this.capturedTabAudioTrack.stop()
    }
    this.capturedTabAudioTrack = null
    this.currentAudioSourceType = null
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop() // This will trigger 'onstop' which calls resetRecordingVariables
      console.log("Recording stopping...")
    } else {
       console.log("Recorder not active or already stopped.")
       // If stop is called when not active, ensure cleanup if something went wrong.
       // However, onstop is the primary place for full reset.
       if (!this.mediaRecorder) this.resetRecordingVariables();
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording"
  }

  switchCameraAudio(newCameraManagerMediaStream) {
    if (!this.isRecording()) {
      console.log("Not recording, no audio switch needed for MediaRecorder.")
      return
    }

    // Only switch audio if the current source is the microphone
    if (this.currentAudioSourceType !== 'microphone') {
      console.log(`Current audio source is '${this.currentAudioSourceType}', not 'microphone'. Camera switch will not alter the recorded audio track.`);
      return;
    }

    if (!this.canvasStream) {
      console.error("Canvas stream not available for audio track replacement.")
      return
    }

    const newAudioTracks = newCameraManagerMediaStream.getAudioTracks()
    if (newAudioTracks.length === 0) {
      console.warn("New camera stream does not have an audio track. Audio might be lost or silent if switched.")
      // Potentially remove existing mic track if new one is unavailable
    }
    const newAudioTrack = newAudioTracks.length > 0 ? newAudioTracks[0] : null

    // Remove all existing audio tracks from the canvasStream (should only be one mic track if any)
    this.canvasStream.getAudioTracks().forEach(track => {
      console.log("Removing old microphone audio track from canvasStream:", track.label, track.id)
      this.canvasStream.removeTrack(track)
      track.stop() // Important: stop the old track
    })

    if (newAudioTrack) {
      console.log("Adding new microphone audio track to canvasStream:", newAudioTrack.label, newAudioTrack.id)
      this.canvasStream.addTrack(newAudioTrack.clone())
    } else {
      console.warn("No new microphone audio track to add. Recording may continue with no audio on this segment.")
    }
    console.log("Microphone audio track switch attempt for MediaRecorder completed.")
  }
}