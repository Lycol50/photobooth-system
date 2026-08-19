# MediaPipe crop provider provenance

The MVP contains the `MediaPipeCropStrategy` integration boundary but intentionally does not ship or execute a MediaPipe model in the Node.js Sharp worker. The official `@mediapipe/tasks-vision` runtime is designed for browser APIs that are unavailable in this worker architecture.

When model-specific integration is later approved, use an official MediaPipe face detector model from Google AI Edge, record its immutable download URL, SHA-256 digest, model card, license, and package version here before packaging. Until then the provider reports `unavailable_in_worker_runtime` and the deterministic `CenterCropStrategy` is used.

This file is the authoritative provenance record for the disabled provider. No model binary is represented as present.
