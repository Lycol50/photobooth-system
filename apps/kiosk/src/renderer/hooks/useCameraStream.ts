import type { CameraDevice } from '@grace-booth/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const CAPTURE_QUALITY = 0.92;
const IDEAL_WIDTH = 1_920;
const IDEAL_HEIGHT = 1_080;

export type CameraStreamState = {
  stream: MediaStream | null;
  ready: boolean;
  denied: boolean;
};

export type CameraStream = CameraStreamState & {
  videoRef: (element: HTMLVideoElement | null) => void;
  grabJpegBase64: () => string | null;
};

export async function enumerateVideoDevices(): Promise<CameraDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label.length > 0 ? device.label : `Camera ${index + 1}`,
        groupId: device.groupId,
      }));
  } catch {
    return [];
  }
}

/**
 * Owns the single guest-facing camera stream. The stream powers the live viewfinder and is the
 * source for the still frames Electron main asks for during a countdown; nothing here decides when
 * a photo is taken.
 */
export function useCameraStream(enabled: boolean, deviceId?: string | null): CameraStream {
  const [state, setState] = useState<CameraStreamState>({
    stream: null,
    ready: false,
    denied: false,
  });
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Test and headless environments do not implement the media APIs at all.
    const mediaDevices: MediaDevices | undefined =
      typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!enabled || !mediaDevices) {
      return;
    }

    let active = true;
    let acquired: MediaStream | null = null;

    const open = async () => {
      try {
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: IDEAL_WIDTH },
          height: { ideal: IDEAL_HEIGHT },
        };
        if (deviceId) {
          videoConstraints.deviceId = { exact: deviceId };
        } else {
          videoConstraints.facingMode = 'user';
        }
        const stream = await mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });
        if (!active) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        acquired = stream;
        setState({ stream, ready: true, denied: false });
      } catch {
        if (active) setState({ stream: null, ready: false, denied: true });
      }
    };

    void open();
    return () => {
      active = false;
      if (acquired) {
        for (const track of acquired.getTracks()) track.stop();
      }
      setState({ stream: null, ready: false, denied: false });
    };
  }, [enabled, deviceId]);

  const videoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      videoElementRef.current = element;
      if (element && element.srcObject !== state.stream) {
        element.srcObject = state.stream;
      }
    },
    [state.stream],
  );

  useEffect(() => {
    const element = videoElementRef.current;
    if (element && element.srcObject !== state.stream) {
      element.srcObject = state.stream;
    }
  }, [state.stream]);

  const grabJpegBase64 = useCallback((): string | null => {
    const video = videoElementRef.current;
    const width = video?.videoWidth ?? 0;
    const height = video?.videoHeight ?? 0;
    if (!video || width === 0 || height === 0) return null;

    const canvas = (canvasRef.current ??= document.createElement('canvas'));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', CAPTURE_QUALITY);
    const separator = dataUrl.indexOf(',');
    return separator === -1 ? null : dataUrl.slice(separator + 1);
  }, []);

  return { ...state, videoRef, grabJpegBase64 };
}
