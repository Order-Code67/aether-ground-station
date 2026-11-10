export {
  listCaptureDevices,
  openCaptureStream,
  stopStream,
  readVideoMetrics,
  createRecorder,
} from "./captureService";

export {
  getVideoAdapter,
  mediaDevicesAdapter,
  rtspAdapter,
  webrtcAdapter,
  isRtspBridgeHandle,
} from "./adapters";
export type {
  VideoAdapter,
  VideoAdapterKind,
  RtspBridgeHandle,
} from "./adapters";
export { saveRecordingToDisk } from "./recording";

export function isVideoCaptureAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
}
