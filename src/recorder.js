import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.audioOnlyMediaStream = null // Stream specifically for audio input
    this.canvasStream = null // Stream from canvas (video) + our audio track
    this.currentAudioTrack = null // The audio track currently being recorded
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording"
  }

  async startRecording(liveRenderTarget, initialAudioConstraints) {
    try {
      // Get initial audio stream
      this.audioOnlyMediaStream = await navigator.mediaDevices.getUserMedia(initialAudioConstraints)
      const audioTracks = this.audioOnlyMediaStream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.warn("No audio track available for recording.")
        this.currentAudioTrack = null
      } else {
        this.currentAudioTrack = audioTracks[0]
      }

      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      if (this.currentAudioTrack) {
        this.canvasStream.addTrack(this.currentAudioTrack)
        console.log("Initial audio track added to canvasStream.")
      } else {
        console.warn("Proceeding with recording without an audio track.")
      }

      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
        // Consider audioBitsPerSecond for quality, e.g., 128000
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("MediaRecorder: dataavailable")
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder: stop")
        this.uiManager.showLoading(true)
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })

        // Stop the audio track and stream used for this recording session
        if (this.currentAudioTrack) {
          this.currentAudioTrack.stop()
          console.log("Current audio track stopped (onstop).")
          // It should be automatically removed from canvasStream when stopped,
          // or canvasStream itself will be dismantled soon.
        }
        if (this.audioOnlyMediaStream) {
          this.audioOnlyMediaStream.getTracks().forEach((track) => track.stop())
          console.log("Audio-only media stream tracks stopped (onstop).")
        }
        // Nullify them as they are now stopped and processed for this recording
        this.currentAudioTrack = null
        this.audioOnlyMediaStream = null

        // The canvasStream tracks will be stopped in resetRecordingVariables or if a new recording starts.

        try {
          const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
          const url = URL.createObjectURL(fixedBlob)
          this.uiManager.showLoading(false)
          this.uiManager.displayPostRecordButtons(url, fixedBlob)
        } catch (error) {
          console.error("Error processing video:", error)
          this.uiManager.showLoading(false)
          // Potentially inform the user of the processing failure
        }
        this.recordedChunks = [] // Clear chunks for next recording
      }

      this.mediaRecorder.start()
      console.log("MediaRecorder: recording started.")
      return true
    } catch (error) {
      console.error("Error starting recording or accessing media devices:", error)
      // Cleanup in case of error during start
      if (this.currentAudioTrack) this.currentAudioTrack.stop()
      if (this.audioOnlyMediaStream) this.audioOnlyMediaStream.getTracks().forEach(track => track.stop())
      if (this.canvasStream) this.canvasStream.getTracks().forEach(track => track.stop()) // Stop canvas tracks too
      this.currentAudioTrack = null
      this.audioOnlyMediaStream = null
      this.canvasStream = null
      this.mediaRecorder = null
      return false
    }
  }

  async switchAudioSource(newAudioConstraints) {
    if (!this.isRecording() || !this.canvasStream) {
      console.warn("Cannot switch audio source: not recording or canvasStream not initialized.")
      return
    }

    console.log("Attempting to switch audio source with constraints:", newAudioConstraints)

    try {
      // Stop and remove the old audio track from canvasStream
      if (this.currentAudioTrack) {
        console.log("Removing old audio track from canvasStream:", this.currentAudioTrack.label)
        this.canvasStream.removeTrack(this.currentAudioTrack)
        this.currentAudioTrack.stop() // Stop the track itself
        console.log("Old audio track stopped and removed.")
      }
      // Stop all tracks of the old audio-only media stream
      if (this.audioOnlyMediaStream) {
        this.audioOnlyMediaStream.getTracks().forEach((track) => track.stop())
        console.log("Old audio-only media stream tracks stopped.")
      }

      // Get new audio stream and track
      this.audioOnlyMediaStream = await navigator.mediaDevices.getUserMedia(newAudioConstraints)
      const audioTracks = this.audioOnlyMediaStream.getAudioTracks()

      if (audioTracks.length > 0) {
        this.currentAudioTrack = audioTracks[0]
        this.canvasStream.addTrack(this.currentAudioTrack)
        console.log("New audio track added to canvasStream:", this.currentAudioTrack.label)
      } else {
        console.warn("No audio track found in new audio source. Recording will continue without new audio.")
        this.currentAudioTrack = null
      }
    } catch (error) {
      console.error("Error switching audio source:", error)
      // Recording continues, possibly with no audio or previous audio if removal failed.
      // Setting currentAudioTrack to null to indicate problem.
      this.currentAudioTrack = null
    }
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables.")
    this.mediaRecorder = null // MediaRecorder instance itself (onstop should have handled its state)
    this.recordedChunks = []

    // Stop current audio track if it somehow still exists and is active
    // (e.g., if stopRecording was called without onstop completing fully, or if recording never started)
    if (this.currentAudioTrack) {
      this.currentAudioTrack.stop()
      console.log("Residual currentAudioTrack stopped in reset.")
      this.currentAudioTrack = null
    }

    // Stop all tracks in the dedicated audio-only media stream if it still exists
    if (this.audioOnlyMediaStream) {
      this.audioOnlyMediaStream.getTracks().forEach((track) => track.stop())
      console.log("Residual audioOnlyMediaStream tracks stopped in reset.")
      this.audioOnlyMediaStream = null
    }

    // Stop all tracks in the canvas stream (includes video from canvas and any audio track)
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop()
      })
      console.log("Canvas stream tracks stopped in reset.")
      this.canvasStream = null
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("MediaRecorderManager: stopRecording() called. Will trigger onstop.")
      this.mediaRecorder.stop() // This will trigger the 'onstop' event handler
    } else {
      console.log("MediaRecorderManager: stopRecording() called, but recorder inactive or null. Performing manual cleanup.")
      // If stopRecording is called when not active, or after already stopped,
      // ensure resources are cleaned up if onstop didn't run or missed something.
      // This ensures that if a recording never started, or stop was called multiple times, resources are freed.
      this.resetRecordingVariables()
    }
  }
}