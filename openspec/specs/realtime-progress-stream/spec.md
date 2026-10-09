# Specification: realtime-progress-stream

## Requirement: Server-Sent Events (SSE) Progress Reporting
The system MUST provide an SSE endpoint `GET /api/jobs/{job_id}/stream` that broadcasts live progress events to connected clients.

### Scenario: Emitting Real-Time Progress Updates
- **Given** a running migration job with 500 videos,
- **When** each video is processed,
- **Then** the SSE stream emits a JSON event containing:
  - `job_id`: string
  - `status`: `RUNNING` | `PAUSED_FLOOD_WAIT` | `COMPLETED` | `FAILED`
  - `total_videos`: integer
  - `processed_videos`: integer
  - `percentage`: float
  - `current_caption`: string
  - `timestamp`: ISO-8601 string
