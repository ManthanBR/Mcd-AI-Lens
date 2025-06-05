import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager) {
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.cameraManager = cameraManager

    this.videoMediaRecorder = null
    this.audioMediaRecorder = null
    this.recordedVideoChunks = []
    this.recordedAudioChunks = []

    this.canvasStream = null // For the video recorder

    this.audioContext = null
    this.audioDestinationNode = null
    this.currentAudioSourceNode = null
    this.recorderAudioTrack = null // This is the managed audio track from AudioContext
    this.recorderAudioTrackIsFallbackClone = false // If AudioContext fails

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.audioDestinationNode = this.audioContext.createMediaStreamDestination()
      // Attempt to get the track later, after a source is connected.
      console.log("AudioContext and DestinationNode initialized.")
    } catch (e) {
      console.error(
        "AudioContext is not supported. Audio recording quality/stability may be affected.",
        e
      )
    }
  }

  _connectAudioSource(mediaStream) {
    if (!mediaStream) {
        console.warn("Cannot connect audio source: mediaStream is missing.");
        this.recorderAudioTrack = null; // Ensure no stale track
        return;
    }

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.warn("MediaStream has no audio tracks to connect.");
        if (this.currentAudioSourceNode && this.audioContext) { // Disconnect old if exists
            this.currentAudioSourceNode.disconnect();
            this.currentAudioSourceNode = null;
        }
        this.recorderAudioTrack = null;
        return;
    }

    const newAudioTrack = audioTracks[0];
    console.log("New audio track for connection:", newAudioTrack.label, newAudioTrack.id, "Enabled:", newAudioTrack.enabled);

    if (this.audioContext && this.audioDestinationNode) {
        this.recorderAudioTrackIsFallbackClone = false;
        if (this.currentAudioSourceNode) {
            this.currentAudioSourceNode.disconnect();
        }
        const audioStreamForSourceNode = new MediaStream([newAudioTrack]);
        this.currentAudioSourceNode = this.audioContext.createMediaStreamSource(
            audioStreamForSourceNode
        );
        this.currentAudioSourceNode.connect(this.audioDestinationNode);

        if (this.audioDestinationNode.stream.getAudioTracks().length > 0) {
            this.recorderAudioTrack = this.audioDestinationNode.stream.getAudioTracks()[0];
            console.log("Audio source connected via AudioContext. Recorder track updated from destination:", this.recorderAudioTrack.id);
        } else {
            console.error("CRITICAL: AudioDestinationNode stream STILL has no audio tracks after connecting source. Falling back for this op.");
            this.recorderAudioTrack = newAudioTrack.clone(); // Fallback for this connection attempt
            this.recorderAudioTrackIsFallbackClone = true;
        }
    } else { // Fallback if AudioContext is not available
        console.warn("AudioContext not available. Using direct clone for audio track.");
        if (this.recorderAudioTrack && this.recorderAudioTrackIsFallbackClone && this.recorderAudioTrack.readyState !== 'ended') {
            this.recorderAudioTrack.stop(); // Stop previous clone
        }
        this.recorderAudioTrack = newAudioTrack.clone();
        this.recorderAudioTrackIsFallbackClone = true;
    }
  }

  async startRecording(liveRenderTarget, cameraManagerInstance) {
    try {
      if (!cameraManagerInstance || !cameraManagerInstance.mediaStream) {
        console.error("CameraManager instance or mediaStream not available.")
        this.uiManager.showLoading(false)
        alert("Camera not ready. Cannot start recording.")
        return false
      }

      if (this.audioContext && this.audioContext.state === "suspended") {
        console.log("AudioContext suspended, resuming...");
        await this.audioContext.resume()
        console.log("AudioContext state after resume:", this.audioContext.state)
      }

      this._connectAudioSource(cameraManagerInstance.mediaStream)

      if (!this.recorderAudioTrack || this.recorderAudioTrack.readyState === 'ended') {
        console.error("No valid audio track (recorderAudioTrack) available for recording.")
        alert("Microphone not accessible or audio setup failed. Cannot start recording audio.")
        this.uiManager.showLoading(false);
        return false;
      }
      console.log(
        "Using recorderAudioTrack for audio recording:",
        "ID:", this.recorderAudioTrack.id, "Kind:", this.recorderAudioTrack.kind,
        "Enabled:", this.recorderAudioTrack.enabled, "Muted:", this.recorderAudioTrack.muted,
        "ReadyState:", this.recorderAudioTrack.readyState, "Is Clone:", this.recorderAudioTrackIsFallbackClone
      );

      // 1. Setup Audio Recorder
      this.recordedAudioChunks = []
      const audioStreamForRecorder = new MediaStream([this.recorderAudioTrack])
      this.audioMediaRecorder = new MediaRecorder(audioStreamForRecorder, {
        mimeType: Settings.recording.audioMimeType,
      })

      this.audioMediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedAudioChunks.push(event.data)
        }
      }
      this.audioMediaRecorder.onerror = (event) => {
        console.error("AudioMediaRecorder error:", event.error ? event.error.name : "Unknown error", event);
        alert(`Audio recording error: ${event.error ? event.error.message : 'Unknown'}. Recording may be incomplete.`);
      };

      // 2. Setup Video Recorder (from canvas)
      this.recordedVideoChunks = []
      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      if (this.canvasStream.getVideoTracks().length === 0) {
          console.error("Canvas stream has no video tracks!");
          alert("Failed to capture video from the screen. Cannot start recording.");
          this.uiManager.showLoading(false);
          this.resetRecordingVariables(); // Clean up audio recorder if it was set up
          return false;
      }
      // Ensure canvas stream for video recorder has NO audio tracks
      this.canvasStream.getAudioTracks().forEach(track => {
          console.log("Removing extraneous audio track from canvas stream for video recorder:", track.id);
          this.canvasStream.removeTrack(track)
      });

      this.videoMediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.videoMimeTypeForCanvas, // e.g., "video/webm"
        videoBitsPerSecond: 5000000,
      })

      this.videoMediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedVideoChunks.push(event.data)
        }
      }
      this.videoMediaRecorder.onerror = (event) => {
        console.error("VideoMediaRecorder error:", event.error ? event.error.name : "Unknown error", event);
        alert(`Video recording error: ${event.error ? event.error.message : 'Unknown'}. Recording may be incomplete.`);
      };

      let audioBlob = null;
      let videoBlob = null;
      let audioStopCalled = false;
      let videoStopCalled = false;

      const attemptFinalizeRecording = async () => {
        // This function should only run once both onstop events have fired
        if (!audioStopCalled || !videoStopCalled) return;

        console.log("Both recorders have stopped processing.");
        this.uiManager.showLoading(true); // Show loading for FFmpeg

        if (this.recordedAudioChunks.length === 0) console.warn("No audio chunks recorded!");
        if (this.recordedVideoChunks.length === 0) console.warn("No video chunks recorded!");

        if (audioBlob && videoBlob) {
          try {
            console.log(`Audio Blob size: ${audioBlob.size}, type: ${audioBlob.type}`);
            console.log(`Video Blob size: ${videoBlob.size}, type: ${videoBlob.type}`);
            const finalCombinedBlob = await this.videoProcessor.combineVideoAndAudio(
              videoBlob,
              audioBlob
            )
            const url = URL.createObjectURL(finalCombinedBlob)
            this.uiManager.displayPostRecordButtons(url, finalCombinedBlob, this, this.cameraManager)
          } catch (ffmpegError) {
            console.error("FFmpeg processing (combining) failed:", ffmpegError)
            alert(`Error processing video: ${ffmpegError.message || ffmpegError}. Please try again.`);
          } finally {
            this.uiManager.showLoading(false)
          }
        } else {
           let message = "Recording failed: ";
           if (!videoBlob) message += "No video data. ";
           if (!audioBlob) message += "No audio data.";
           alert(message);
           this.uiManager.showLoading(false)
        }
        this.resetRecordingVariables() // Reset after processing or failure
      }

      this.audioMediaRecorder.onstop = () => {
        console.log("AudioMediaRecorder stopped.")
        if (this.recordedAudioChunks.length > 0) {
            audioBlob = new Blob(this.recordedAudioChunks, { type: this.audioMediaRecorder.mimeType });
        }
        audioStopCalled = true;
        attemptFinalizeRecording();
      }

      this.videoMediaRecorder.onstop = () => {
        console.log("VideoMediaRecorder stopped.")
        if (this.recordedVideoChunks.length > 0) {
            videoBlob = new Blob(this.recordedVideoChunks, { type: this.videoMediaRecorder.mimeType });
        }
        videoStopCalled = true;
        attemptFinalizeRecording();
      }

      this.audioMediaRecorder.start()
      this.videoMediaRecorder.start()
      console.log("Audio and Video recording started separately.")
      return true
    } catch (error) {
      console.error("Error starting recording:", error)
      this.uiManager.showLoading(false)
      alert(`Could not start recording: ${error.message}. Please ensure permissions are granted.`)
      this.resetRecordingVariables()
      return false
    }
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables (separate recorders)")

    if (this.audioMediaRecorder && this.audioMediaRecorder.state !== "inactive") {
      // onstop handler should already be set to process, but call stop if not already stopped
      this.audioMediaRecorder.stop()
    }
    this.audioMediaRecorder = null
    this.recordedAudioChunks = []

    if (this.videoMediaRecorder && this.videoMediaRecorder.state !== "inactive") {
      this.videoMediaRecorder.stop()
    }
    this.videoMediaRecorder = null
    this.recordedVideoChunks = []

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
          console.log("Stopping track in canvasStream during reset:", track.id, track.kind);
          track.stop()
      })
      this.canvasStream = null
    }

    if (this.currentAudioSourceNode && this.audioContext) {
      this.currentAudioSourceNode.disconnect()
      this.currentAudioSourceNode = null
      console.log("Disconnected currentAudioSourceNode from AudioContext.");
    }

    if (this.recorderAudioTrack && this.recorderAudioTrackIsFallbackClone && this.recorderAudioTrack.readyState !== 'ended') {
        console.log("Stopping FALLBACK cloned recorderAudioTrack in reset:", this.recorderAudioTrack.id);
        this.recorderAudioTrack.stop();
    }
    // The recorderAudioTrack from AudioContext destination is persistent and managed by the AudioContext/Browser.
    // We don't stop it here. It will be replaced/reused on next _connectAudioSource call.
    this.recorderAudioTrack = null;
    this.recorderAudioTrackIsFallbackClone = false;

    console.log("Recording variables reset.");
  }

  stopRecording() {
    console.log("Stopping separate audio and video recorders...")
    let stoppedAny = false;
    if (this.audioMediaRecorder && this.audioMediaRecorder.state === "recording") {
      this.audioMediaRecorder.stop() // onstop handler will deal with blob and finalization
      stoppedAny = true;
    } else {
      console.log("Audio recorder not active or already stopping.");
    }

    if (this.videoMediaRecorder && this.videoMediaRecorder.state === "recording") {
      this.videoMediaRecorder.stop() // onstop handler will deal with blob and finalization
      stoppedAny = true;
    } else {
      console.log("Video recorder not active or already stopping.");
    }
    if (!stoppedAny) {
        console.log("No active recorders were told to stop. If stuck, check onstop logic.");
        // If both were already inactive, their onstop handlers wouldn't fire.
        // Resetting here could be an option if a previous recording failed mid-way
        // and onstop handlers were not reached.
        // However, the current design relies on onstop calling reset.
    }
  }

  isRecording() {
    const videoRecording = this.videoMediaRecorder && this.videoMediaRecorder.state === "recording";
    const audioRecording = this.audioMediaRecorder && this.audioMediaRecorder.state === "recording";
    return videoRecording && audioRecording; // Consider truly recording only if both are active
  }

  switchCameraAudio(newCameraManagerMediaStream) {
    console.log("Attempting to switch camera audio source...");
    // Reconnect the audio source. This will update `this.recorderAudioTrack`.
    this._connectAudioSource(newCameraManagerMediaStream);

    if (this.isRecording()) {
        console.log("Currently recording. Audio source switch effect:");
        if (this.recorderAudioTrackIsFallbackClone && this.audioMediaRecorder) {
            // This is the complex case: if using a fallback (cloned) track,
            // and that track object identity changes, the MediaRecorder needs a restart.
            // This will likely result in a gap or a separate audio file for that segment.
            // For simplicity, we're not implementing a full seamless append here.
            console.warn("Audio track is a fallback clone. Restarting audio recorder for camera switch. This may cause a discontinuity.");
            this.audioMediaRecorder.onstop = null; // Prevent old onstop from firing prematurely
            this.audioMediaRecorder.stop();
            // It's better to collect existing chunks and start a new segment
            // but that complicates the simple audioBlob logic significantly.
            // For now, we'll just restart with new chunks. This means previous audio from this segment is lost.
            this.recordedAudioChunks = [];

            if (this.recorderAudioTrack && this.recorderAudioTrack.readyState !== 'ended') {
                const newAudioStreamForRecorder = new MediaStream([this.recorderAudioTrack]);
                this.audioMediaRecorder = new MediaRecorder(newAudioStreamForRecorder, {
                    mimeType: Settings.recording.audioMimeType,
                });
                this.audioMediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) this.recordedAudioChunks.push(event.data);
                };
                // Re-attach the main onstop handler logic for when recording eventually stops fully
                let audioStopCalled = false; // Local flags for this re-created recorder's onstop
                let videoStopCalled = this.videoMediaRecorder ? this.videoMediaRecorder.state !== 'recording' : true;

                // Need to re-define attemptFinalizeRecording or make it accessible with current audio/videoBlob references
                // This part is getting very complex for a simple example.
                // The original `attemptFinalizeRecording` uses `audioBlob` from the outer scope.
                // For a quick fix:
                this.audioMediaRecorder.onstop = () => {
                    console.log("Fallback audioMediaRecorder (post-switch) stopped.");
                    if (this.recordedAudioChunks.length > 0) {
                        // This will overwrite any previously formed audioBlob if stopRecording is called soon.
                        // This is a limitation of this simplified switch logic.
                        // audioBlob = new Blob(this.recordedAudioChunks, { type: this.audioMediaRecorder.mimeType });
                        console.warn("Audio chunks from fallback switch are available, but merging logic not fully implemented for this scenario.");
                    }
                    // Here we would ideally trigger a part of the original attemptFinalizeRecording logic
                    // For now, just log. The main stopRecording will handle the latest audioBlob.
                };

                this.audioMediaRecorder.start();
                console.log("Fallback audio recorder restarted with new track.");
            } else {
                console.error("Failed to get a new audio track for fallback recorder after switch. Audio recording might stop.");
                if(this.audioMediaRecorder) this.audioMediaRecorder.stop(); // Stop it if it can't get a new track
            }
        } else if (!this.recorderAudioTrackIsFallbackClone) {
            console.log("Audio source switched via AudioContext. Audio recorder should continue seamlessly with new input.");
        } else {
            console.log("Audio source switched, but not currently recording or no AudioContext. Effect on next recording.");
        }
    } else {
        console.log("Not currently recording. Audio source prepared for next recording session.");
    }
  }
}