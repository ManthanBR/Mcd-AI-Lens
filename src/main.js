/**
 * Camera Kit Web Demo with Recording Feature
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA
 */

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import "./styles/index.v3.css" // Make sure this path is correct
import { CameraManager } from "./camera"
import { MediaRecorderManager } from "./recorder"
import { UIManager } from "./ui"
import { VideoProcessor } from "./videoProcessor"
import { Settings } from "./settings"

// DOM Elements
const startScreen = document.getElementById('start-screen');
const startScreenContent = document.getElementById('start-screen-content');
const startScreenInteractive = document.getElementById('start-screen-interactive');
const startButton = document.getElementById('start-button');
const permissionStatusElem = document.getElementById('permission-status');
const mainAppContainer = document.getElementById('main-app-container');
const loadingElementInsideStartScreen = startScreenContent.querySelector("#loading");

// --- NEW: Global variables for audio monitoring ---
let g_monitorNodes = [];
let g_audioContexts = []; 

// --- NEW: Make mediaRecorder instance accessible for dynamic audio addition ---
let mediaRecorderInstance = null; // Will be assigned when MediaRecorderManager is created

// --- NEW: Audio Monitoring Setup Functions (inspired by "new" main.js) ---
function setupAudioContextMonitor() {
    if (window.AudioContext) { 
        const originalAudioContext = window.AudioContext || window.webkitAudioContext;
        if (!originalAudioContext) {
            console.warn("AudioContext not available. Lens audio monitoring might not work.");
            return;
        }

        window.AudioContext = window.webkitAudioContext = function (...args) {
            const capturedAudioContext = new originalAudioContext(...args);
            console.log("Audio context created:", capturedAudioContext);
            g_audioContexts.push(capturedAudioContext);
            return capturedAudioContext;
        };
        console.log("AudioContext constructor overridden for monitoring.");
    } else {
         console.warn("window.AudioContext is not available. Lens audio monitoring setup skipped.");
    }
}

function setupAudioNodeMonitor() {
    if (typeof AudioNode === 'undefined' || !AudioNode.prototype || typeof AudioNode.prototype.connect !== 'function') {
        console.warn("AudioNode.prototype.connect not available. Lens audio monitoring might not work.");
        return;
    }
    const originalConnect = AudioNode.prototype.connect;

    AudioNode.prototype.connect = function (destinationNode, outputIndex, inputIndex) {
        if (destinationNode instanceof AudioDestinationNode) {
            try {
                if (!this.context || typeof this.context.createMediaStreamDestination !== 'function') {
                    console.warn("Cannot create MediaStreamDestination for node, context invalid or method missing.", this);
                } else {
                    const monitorNode = this.context.createMediaStreamDestination();
                    originalConnect.call(this, monitorNode); 

                    if (monitorNode.stream && monitorNode.stream.getAudioTracks().length > 0) {
                        const alreadyExists = g_monitorNodes.some(mn => mn.stream.id === monitorNode.stream.id);
                        if (!alreadyExists) {
                            console.log("Adding monitorNode with audio track(s):", monitorNode.stream.id, "from context:", this.context.sampleRate);
                            g_monitorNodes.push(monitorNode);

                            // --- NEW: Attempt to dynamically add this new source to the recorder ---
                            if (mediaRecorderInstance && mediaRecorderInstance.isMixerActive()) {
                                console.log("Attempting to dynamically add new lens audio source to recorder:", monitorNode.stream.id);
                                mediaRecorderInstance.dynamicallyAddLensAudioSource(monitorNode);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Error creating or connecting monitor node:", e, "Source Node:", this);
            }
        }

        if (outputIndex !== undefined && inputIndex !== undefined) {
            return originalConnect.call(this, destinationNode, outputIndex, inputIndex);
        } else if (outputIndex !== undefined) {
            return originalConnect.call(this, destinationNode, outputIndex);
        } else {
            return originalConnect.call(this, destinationNode);
        }
    };
    console.log("AudioNode.prototype.connect overridden for monitoring.");
}


async function requestMotionPermissions() {
  permissionStatusElem.style.display = 'none';

  const isIPhone = /iPhone/i.test(navigator.userAgent);

  if (isIPhone && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    console.log("iPhone detected, attempting to request motion permissions.");
    try {
      const permissionState = await DeviceMotionEvent.requestPermission();
      if (permissionState === 'granted') {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          try {
            await DeviceOrientationEvent.requestPermission();
            console.log("Orientation permission granted on iPhone.");
          }
          catch (orientError) {
            console.warn('Could not get orientation permission on iPhone, but motion was granted:', orientError);
          }
        }
        console.log("Motion permission granted on iPhone.");
        return true;
      } else {
        permissionStatusElem.textContent = 'Motion sensor permission was denied. Please enable it in Safari settings (Settings > Safari > Motion & Orientation Access).';
        permissionStatusElem.style.display = 'block';
        console.log("Motion permission denied on iPhone.");
        return false;
      }
    } catch (error) {
      console.error('Error requesting motion permission on iPhone:', error);
      permissionStatusElem.textContent = 'Could not request motion sensor permissions. An error occurred.';
      permissionStatusElem.style.display = 'block';
      return false;
    }
  } else {
    const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOSDevice && !isIPhone) {
        console.log('iOS device (not iPhone) detected. Motion permissions handled by OS/browser.');
    } else if (!isIOSDevice) {
        console.log('Non-iOS device detected. Assuming motion permissions are granted or not strictly required.');
    } else {
        console.log('iPhone detected, but DeviceMotionEvent.requestPermission not found (older iOS).');
    }
    return true;
  }
}

function showStartScreenLoading(show) {
    if (show) {
        if(startScreenInteractive) startScreenInteractive.style.display = 'none';
        if(loadingElementInsideStartScreen) loadingElementInsideStartScreen.style.display = 'flex';
        if(permissionStatusElem) permissionStatusElem.style.display = 'none';
    } else {
        if(loadingElementInsideStartScreen) loadingElementInsideStartScreen.style.display = 'none';
        if(startScreenInteractive) startScreenInteractive.style.display = 'flex';
    }
}

async function initializeAppAndCameraKit() {
  setupAudioContextMonitor();
  setupAudioNodeMonitor();

  const apiToken = process.env.API_TOKEN;
  const lensID = process.env.LENS_ID;
  const groupID = process.env.GROUP_ID;

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables.");
    if(permissionStatusElem) {
        permissionStatusElem.textContent = "Configuration error. App cannot start.";
        permissionStatusElem.style.display = 'block';
    }
    showStartScreenLoading(false);
    if(startButton) {
        startButton.disabled = false;
        startButton.textContent = 'Try Again';
    }
    return;
  }

  const cameraManager = new CameraManager();
  const uiManager = new UIManager();
  const videoProcessor = new VideoProcessor();
  
  // --- NEW: Assign to mediaRecorderInstance ---
  mediaRecorderInstance = new MediaRecorderManager(videoProcessor, uiManager, cameraManager, g_monitorNodes);

  try {
    const cameraKit = await bootstrapCameraKit({ apiToken });
    const liveRenderTarget = document.getElementById("canvas");
    const session = await cameraKit.createSession({ liveRenderTarget });
    const mediaStream = await cameraManager.initializeCamera();
    const initialSource = createMediaStreamSource(mediaStream, {
      cameraType: cameraManager.isBackFacing ? "environment" : "user",
      disableSourceAudio: false, 
    });
    cameraManager.currentSource = initialSource; 
    await session.setSource(initialSource);

    if (!cameraManager.isBackFacing) {
      initialSource.setTransform(Transform2D.MirrorX);
    }
    await session.setFPSLimit(Settings.camera.fps);

    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID);
    await session.applyLens(lens); 
    await session.play();

    if(startScreen) startScreen.style.display = 'none';
    if(mainAppContainer) mainAppContainer.style.display = 'block';

    uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget);

    if (uiManager.recordButton) {
        uiManager.recordButton.addEventListener("click", async () => {
            if (uiManager.recordPressedCount % 2 === 0) {
                const success = await mediaRecorderInstance.startRecording(liveRenderTarget, cameraManager);
                if (success) uiManager.updateRecordButtonState(true);
            } else {
                uiManager.updateRecordButtonState(false);
                uiManager.toggleRecordButton(false);
                mediaRecorderInstance.stopRecording();
            }
        });
    }
    if (uiManager.switchButton) {
        uiManager.switchButton.addEventListener("click", async () => {
            if (uiManager.switchButton) uiManager.switchButton.style.display = 'none';

            try {
                const newSource = await cameraManager.updateCamera(session); 
                uiManager.updateRenderSize(newSource, liveRenderTarget);

                if (mediaRecorderInstance.isRecording() || mediaRecorderInstance.isMixerActive()) { 
                     mediaRecorderInstance.switchCameraAudio(cameraManager.mediaStream);
                }
                
                if (uiManager.actionButton && uiManager.actionButton.style.display === 'none') {
                   if (uiManager.switchButton) uiManager.switchButton.style.display = 'block';
                }

            } catch (error) {
                console.error("Error switching camera:", error);
                 if (uiManager.actionButton && uiManager.actionButton.style.display === 'none') {
                   if (uiManager.switchButton) uiManager.switchButton.style.display = 'block';
                }
            }
        });
    }
    window.addEventListener("resize", () => uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget));

  } catch (error) {
    console.error("Error during app initialization:", error);
    if(permissionStatusElem) {
        permissionStatusElem.textContent = `Error initializing: ${error.message}. Please refresh.`;
        permissionStatusElem.style.display = 'block';
    }
    showStartScreenLoading(false);
    if(startButton) {
        startButton.disabled = false;
        startButton.textContent = 'Try Again';
    }
    if(mainAppContainer) mainAppContainer.style.display = 'none';
  }
}

if (startButton) {
    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      startButton.textContent = 'Please Wait...';
      if(permissionStatusElem) permissionStatusElem.style.display = 'none';

      const permissionsGranted = await requestMotionPermissions();

      if (permissionsGranted) {
        showStartScreenLoading(true);
        await initializeAppAndCameraKit();
      } else {
        startButton.disabled = false;
        startButton.textContent = 'Grant Permissions & Start';
        showStartScreenLoading(false);
      }
    });
} else {
    console.error("#start-button not found. Start screen interactivity will not work.");
}