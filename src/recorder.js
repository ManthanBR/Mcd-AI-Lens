import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.cameraManager = cameraManager;
    this.canvasStream = null

    // AudioContext setup for robust audio track switching
    this.audioContext = null;
    this.audioDestinationNode = null;
    this.currentAudioSourceNode = null;
    this.recorderAudioTrack = null; // The stable track from audioDestinationNode

    // Initialize AudioContext if supported
    try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioDestinationNode = this.audioContext.createMediaStreamDestination();
        // Get the stable audio track that will be fed to MediaRecorder
        if (this.audioDestinationNode.stream.getAudioTracks().length > 0) {
            this.recorderAudioTrack = this.audioDestinationNode.stream.getAudioTracks()[0];
        } else {
            // Fallback or error if destination stream has no audio track initially (should not happen)
            console.warn("AudioDestinationNode stream has no audio tracks initially. Audio recording might fail.");
        }
    } catch (e) {
        console.error("AudioContext is not supported in this browser. Audio track switching during recording may not be seamless.", e);
        // App can continue, but switchCameraAudio might not work as expected or might rely on simpler track replacement
    }
  }

  _connectAudioSource(mediaStream) {
    if (!this.audioContext || !this.audioDestinationNode || !mediaStream) return;

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newAudioTrack = audioTracks[0];
      if (this.currentAudioSourceNode) {
        this.currentAudioSourceNode.disconnect();
      }
      // Create a new MediaStream with only the desired audio track to avoid issues if the stream has video
      const audioStreamForSourceNode = new MediaStream([newAudioTrack]);
      this.currentAudioSourceNode = this.audioContext.createMediaStreamSource(audioStreamForSourceNode);
      this.currentAudioSourceNode.connect(this.audioDestinationNode);
      console.log("Audio source connected to AudioContext destination.");
    } else {
      console.warn("New mediaStream has no audio tracks to connect.");
      if (this.currentAudioSourceNode) {
        this.currentAudioSourceNode.disconnect(); // Disconnect old one if new one is missing
        this.currentAudioSourceNode = null;
      }
    }
  }

  async startRecording(liveRenderTarget, cameraManagerInstance) {
    try {
      if (!cameraManagerInstance || !cameraManagerInstance.mediaStream) {
        console.error("CameraManager instance or its mediaStream is not available for recording.")
        this.uiManager.showLoading(false)
        alert("Camera not ready. Cannot start recording.")
        return false
      }

      // Ensure AudioContext is resumed (for browsers that start it in suspended state)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this._connectAudioSource(cameraManagerInstance.mediaStream);

      if (!this.recorderAudioTrack && this.audioDestinationNode) { // Attempt to get it again if it wasn't ready at construction
         if (this.audioDestinationNode.stream.getAudioTracks().length > 0) {
            this.recorderAudioTrack = this.audioDestinationNode.stream.getAudioTracks()[0];
         }
      }

      if (!this.recorderAudioTrack && (!this.audioContext || !this.audioDestinationNode)) {
          // Fallback to direct track cloning if AudioContext setup failed or no track
          console.warn("AudioContext not available or recorderAudioTrack missing, falling back to direct audio track cloning.");
          const audioTracks = cameraManagerInstance.mediaStream.getAudioTracks();
          if (audioTracks.length === 0) {
            console.error("No audio track found for recording (fallback).")
            this.uiManager.showLoading(false)
            alert("Microphone not accessible. Cannot start recording with audio.")
            return false;
          }
          this.recorderAudioTrack = audioTracks[0].clone(); // Fallback track
      } else if (!this.recorderAudioTrack) {
          console.error("Failed to obtain a stable audio track for MediaRecorder via AudioContext.");
          this.uiManager.showLoading(false);
          alert("Audio recording setup failed. Cannot start recording.");
          return false;
      }


      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      // Add the stable audio track from AudioContext or the fallback cloned track
      this.canvasStream.addTrack(this.recorderAudioTrack);


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
        if (this.recordedChunks.length > 0) { 
            try {
                const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
                finalBlob = fixedBlob;
            } catch (ffmpegError) {
                console.error("FFmpeg processing failed:", ffmpegError);
            }
        } else {
            console.warn("No data recorded.");
            this.uiManager.showLoading(false);
            this.uiManager.toggleRecordButton(true); 
            this.resetRecordingVariables();
            return;
        }
        
        const url = URL.createObjectURL(finalBlob)
        this.uiManager.showLoading(false)
        this.uiManager.displayPostRecordButtons(url, finalBlob, this, this.cameraManager)
        this.resetRecordingVariables() 
      }

      this.mediaRecorder.start()
      console.log("Recording started")
      return true
    } catch (error) {
      console.error("Error starting recording:", error)
      this.uiManager.showLoading(false)
      alert(`Could not start recording: ${error.message}. Please ensure permissions are granted.`)
      this.resetRecordingVariables(); 
      return false
    }
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables");
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
        this.mediaRecorder.stop(); 
    }
    this.mediaRecorder = null
    this.recordedChunks = []

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        // Only stop the track if it's the fallback one we cloned and added directly.
        // The recorderAudioTrack from AudioDestinationNode should not be stopped here, as it's managed by AudioContext.
        if (this.audioContext && this.recorderAudioTrack && track.id === this.recorderAudioTrack.id) {
            // This is the track from AudioDestinationNode, do not stop it here.
            // It will stop when AudioContext is closed or if it's a fallback.
        } else if (track.id === this.recorderAudioTrack?.id) { // Fallback scenario where recorderAudioTrack was a direct clone
             track.stop();
        } else { // Other tracks (like video from canvas)
             track.stop();
        }
        // A simpler approach if worried: remove the track from canvasStream but don't stop it if it's the audioDestination's track
        // this.canvasStream.removeTrack(track); // Then decide to stop
      })
      // More targeted track removal and stopping
      const videoTrack = this.canvasStream.getVideoTracks()[0];
      if(videoTrack) videoTrack.stop();

      // If using AudioContext, the recorderAudioTrack is from audioDestinationNode and shouldn't be stopped here.
      // If it was a fallback clone, it might need stopping.
      if (this.recorderAudioTrack && (!this.audioContext || trackWasAFallbackClone)) {
          // Check if recorderAudioTrack is still in canvasStream and if it was a fallback
          const existingAudioTrackInCanvasStream = this.canvasStream.getAudioTracks().find(t => t.id === this.recorderAudioTrack.id);
          if (existingAudioTrackInCanvasStream && !this.audioContext) { // Only stop if it was a fallback clone
              this.recorderAudioTrack.stop();
          }
      }
      this.canvasStream = null;
    }

    if (this.currentAudioSourceNode) {
      this.currentAudioSourceNode.disconnect();
      this.currentAudioSourceNode = null;
    }
     // The recorderAudioTrack (if from AudioContext) itself is not stopped here, it's persistent.
     // If it was a fallback clone, it should have been stopped if it was added to canvasStream.
     // For simplicity in reset, if not using AudioContext, ensure cloned track is stopped.
    if (!this.audioContext && this.recorderAudioTrack && typeof this.recorderAudioTrack.stop === 'function') {
        // If it was a fallback clone and might not have been in canvasStream to be stopped above
        // This check is a bit defensive.
    }
    // recorderAudioTrack is reset to its initial state from constructor next time startRecording is called.
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop() 
      console.log("Recording stopping...")
    } else {
       console.log("Recorder not active or already stopped.");
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

    if (this.audioContext && this.audioDestinationNode) {
        console.log("Switching audio source via AudioContext.");
        this._connectAudioSource(newCameraManagerMediaStream);
    } else {
        // Fallback: direct track replacement in canvasStream (less robust, might cause recorder to stop)
        console.warn("AudioContext not available, attempting direct track replacement for MediaRecorder.");
        if (!this.canvasStream) {
            console.error("Canvas stream not available for audio track replacement (fallback).")
            return;
        }
        const newAudioTracks = newCameraManagerMediaStream.getAudioTracks();
        if (newAudioTracks.length === 0) {
            console.warn("New camera stream has no audio track (fallback).");
        }
        const newAudioTrack = newAudioTracks.length > 0 ? newAudioTracks[0] : null;

        this.canvasStream.getAudioTracks().forEach(track => {
            console.log("Removing old audio track from canvasStream (fallback):", track.label, track.id);
            this.canvasStream.removeTrack(track);
            track.stop(); // Stop the old cloned track
        });

        if (newAudioTrack) {
            const clonedNewTrack = newAudioTrack.clone();
            console.log("Adding new cloned audio track to canvasStream (fallback):", clonedNewTrack.label, clonedNewTrack.id);
            this.canvasStream.addTrack(clonedNewTrack);
            this.recorderAudioTrack = clonedNewTrack; // Update reference if using fallback
        } else {
             this.recorderAudioTrack = null;
        }
    }
    console.log("Audio track switch attempt for MediaRecorder completed.")
  }
}