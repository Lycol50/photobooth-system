# Sony camera integration gate

## Current support status

Grace Booth MVP is complete only against `MockCameraAdapter`. `SonyCameraAdapter` implements the locked camera interface but reports `unsupported_pending_model_verification` for connection, preview, and capture. It imports no Sony SDK code and makes no claim that an unknown Sony A7 body is supported.

Moving the adapter beyond this boundary requires a separate architecture decision because the exact body, firmware, USB behavior, SDK license, SDK binary distribution terms, and capture staging behavior are not yet known.

## Evidence required before implementation

Record all of the following from the physical booth kit before selecting an SDK package or changing the adapter:

- Exact camera marketing name and body model code.
- Firmware version shown by the camera.
- Windows USB device identifiers and installed driver version.
- Lens model and whether autofocus is required.
- Required preview resolution and acceptable preview latency.
- Whether the booth can enable PC Remote mode and disable automatic sleep.
- Official Sony Camera Remote SDK version whose compatibility table explicitly lists the body and firmware.
- SDK license terms that permit local installation and packaging for this deployment.

Community reverse-engineered libraries, webcam emulation, and browser `getUserMedia` are not acceptable substitutes for this gate.

The kiosk does ship a separate, supported `webcam` adapter that captures from the laptop or system camera through `getUserMedia`, and it is the default adapter. It is a distinct product path for laptop-based booths, not a Sony implementation: it does not satisfy, shortcut, or relax any requirement above, `SonyCameraAdapter` keeps reporting `unsupported_pending_model_verification`, and every gate item below must still be completed before `GRACE_BOOTH_CAMERA_ADAPTER=sony` is used with guests.

## Compatibility spike

Run the spike on a supported Windows 11 or Windows 10 ESU device that matches the production booth hardware.

1. Install the official Sony SDK and its documented prerequisites outside this repository.
2. Connect only one body over a direct USB port. Disable Wi-Fi transfer and unrelated tethering software.
3. Use Sony's official sample application to prove discovery, connection, remote shutter, image transfer, disconnect, and reconnect.
4. Record whether the API returns JPEG bytes or requires a plaintext staging file.
5. Measure connection time, capture-to-byte time, transferred dimensions, EXIF orientation, content type, and byte size.
6. Disconnect USB during preview and during transfer. Record the SDK error codes and whether reconnection works without restarting Windows.
7. Put the camera to sleep, wake it, remove the battery, and reconnect it. Record all observable state changes.

If the SDK requires a plaintext staging file, stop for a storage-security decision. The production design either needs an SDK byte-return path or a documented Windows full-volume-encryption requirement plus immediate encrypted ingestion and deletion. The application must never retain an unencrypted guest image intentionally.

## Adapter implementation rules

The implemented adapter must preserve the shared `CameraAdapter` interface and map vendor data into sanitized domain errors. SDK objects, file paths, USB identifiers, native handles, and vendor error messages must not cross preload or appear in guest UI.

The adapter must:

- Perform SDK work outside the renderer.
- Serialize connection and capture calls.
- Validate every received JPEG before reporting capture success.
- Prefer an adapter-owned byte buffer. Use a staging path only if the security gate explicitly approves it.
- Support cancellation and bounded timeouts without abandoning native handles.
- Report capability truthfully. Do not label a static or mock image as a live viewfinder.
- Close the SDK session during application shutdown and after unrecoverable camera errors.
- Emit only the stable sanitized reasons already modeled by shared contracts.

No SDK binary, header, redistributable, or copied sample source may be committed until its license and packaging rules are approved.

## USB remote-shoot acceptance test

On the exact production body and firmware, verify all of the following:

- Fresh Windows boot, cold camera connection, and initial health check.
- Live preview start and stop when the body supports it.
- Four captures with the kiosk's real eight-second countdown.
- JPEG validation, orientation handling, encrypted ingestion, review display, and collage output.
- Retake-all followed by four replacement captures while prior round assets remain retained.
- Cable removal before countdown, during countdown, during shutter, and during transfer.
- Calm Recovery UI with no path, SDK code, token, or technical exception shown.
- Operator-authenticated restart and successful reconnection.
- Application restart with the camera connected and disconnected.
- No unexplained plaintext image remaining in application or SDK staging directories.

Record actual timings and error mappings as test artifacts. A single successful shutter is not sufficient evidence.

## Twenty-capture soak test

Run five uninterrupted four-photo sessions for at least 20 captures total. Include one retake-all cycle and one deliberate disconnect/reconnect cycle. The soak passes only when:

- All requested captures produce one valid JPEG each.
- Capture order and session ownership remain correct.
- No duplicate callbacks or orphan staging files occur.
- Working-set growth stabilizes after warm-up.
- All camera handles close cleanly on exit.
- The processing queue remains FIFO with concurrency one.
- Every retained local asset is encrypted at rest.
- Guest-visible state never advances to Review without four valid captures.

Any repeated unresolved failure triggers the controlling brief's stop condition. Preserve logs with tokens, filesystem paths, USB serials, and guest data redacted, then request an explicit hardware or architecture decision.

## Production enablement gate

Real Sony support may be marked enabled only after the compatibility spike, USB acceptance test, and soak test pass on the exact body and firmware; the SDK redistribution decision is recorded; native modules package successfully in the Windows installer; and the Mock adapter regression suite still passes. Until then `unsupported_pending_model_verification` is the only honest Sony adapter result.
