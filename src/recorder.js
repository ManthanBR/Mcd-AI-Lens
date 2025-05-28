import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager) { // Added cameraManager
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.cameraManager = cameraManager; // Store cameraManager instance
    this.canvasStream = null
    // this.audioVideoStream = null; // This is no longer needed as we use cameraManager's stream
  }

  async startRecording(liveRenderTarget, cameraManagerInstance) { // Takes cameraManager instance
    try {
      if (!cameraManagerInstance || !cameraManagerInstance.mediaStream) {
        console.error("CameraManager instance or its mediaStream is not available for recording.")
        this.uiManager.showLoading(false)
        alert("Camera not ready. Cannot start recording.")
        return false
      }

      const audioTracks = cameraManagerInstance.mediaStream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.error("No audio track found in CameraManager's current mediaStream.")
        this.uiManager.showLoading(false)
        alert("Microphone not accessible. Cannot start recording with audio.")
        return false // Or proceed with video-only recording if desired
      }
      const audioTrack = audioTracks[0]

      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      this.canvasStream.addTrack(audioTrack.clone()) // Clone the track

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
        
        let finalBlob = blob;
        if (this.recordedChunks.length > 0) { // only process if there's data
            try {
                const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
                finalBlob = fixedBlob;
            } catch (ffmpegError) {
                console.error("FFmpeg processing failed:", ffmpegError);
                // Fallback to using the original blob if ffmpeg fails
            }
        } else {
            console.warn("No data recorded.");
            this.uiManager.showLoading(false);
            this.uiManager.toggleRecordButton(true); // Show record button again
            // Potentially inform user that recording was empty
            this.resetRecordingVariables();
            return;
        }
        
        const url = URL.createObjectURL(finalBlob)
        this.uiManager.showLoading(false)
        // Pass `this` (MediaRecorderManager instance) and `this.cameraManager`
        this.uiManager.displayPostRecordButtons(url, finalBlob, this, this.cameraManager)
        this.resetRecordingVariables() // Call reset after processing and UI update
      }

      this.mediaRecorder.start()
      console.log("Recording started")
      return true
    } catch (error) {
      console.error("Error starting recording:", error)
      this.uiManager.showLoading(false)
      alert(`Could not start recording: ${error.message}. Please ensure permissions are granted.`)
      this.resetRecordingVariables(); // Clean up if start failed
      return false
    }
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables");
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
        this.mediaRecorder.stop(); // Ensure it's stopped if somehow reset is called early
    }
    this.mediaRecorder = null
    this.recordedChunks = []

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.canvasStream = null
    }
    // No need to manage this.audioVideoStream separately anymore
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop() // This will trigger 'onstop'
      console.log("Recording stopping...")
    } else {
       console.log("Recorder not active or already stopped.");
       // If stopRecording is called when not recording (e.g. UI allows it), ensure UI resets.
       // This case should be handled by UI logic primarily.
       // this.resetRecordingVariables(); // Maybe not here, onstop is primary for reset
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

    if (!this.canvasStream) {
      console.error("Canvas stream not available for audio track replacement.")
      return
    }

    const newAudioTracks = newCameraManagerMediaStream.getAudioTracks()
    if (newAudioTracks.length === 0) {
      console.warn("New camera stream does not have an audio track. Audio might be lost or silent.")
    }
    const newAudioTrack = newAudioTracks.length > 0 ? newAudioTracks[0] : null

    // Remove all existing audio tracks from the canvasStream
    this.canvasStream.getAudioTracks().forEach(track => {
      console.log("Removing old audio track from canvasStream:", track.label, track.id)
      this.canvasStream.removeTrack(track)
      track.stop() // Important: stop the old track to release resources
    })

    if (newAudioTrack) {
      console.log("Adding new audio track to canvasStream:", newAudioTrack.label, newAudioTrack.id)
      this.canvasStream.addTrack(newAudioTrack.clone()) // Clone to be safe
    } else {
      console.warn("No new audio track to add. Recording may continue with no audio on this segment.")
    }
    console.log("Audio track switch attempt for MediaRecorder completed.")
  }
}