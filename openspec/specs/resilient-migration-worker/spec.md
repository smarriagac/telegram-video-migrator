# Specification: resilient-migration-worker

## Requirement: Rate-Limited Queue with FloodWait Backoff and Idempotency
The worker MUST process migrations sequentially with a deliberate delay between operations and recover gracefully from Telegram rate limits.

### Scenario: Enforced Rate Limiting Delay
- **Given** a migration job with multiple video messages,
- **When** a video is successfully posted to the destination channel,
- **Then** the worker sleeps for an interval between 1.5 and 2.0 seconds before dispatching the next message.

### Scenario: Handling Telegram FloodWait
- **Given** Telegram returns a `FloodWaitError` with a cooldown period of `N` seconds,
- **When** the worker catches the error,
- **Then** it emits a `FLOOD_WAIT` progress status with the remaining wait time,
- **And** sleeps for `N + 2` seconds,
- **And** automatically resumes migration from the exact failed message without failing the job.

### Scenario: Job Resumption from Checkpoint
- **Given** an active migration job interrupted at video index 230 out of 500,
- **When** the user clicks "Resume Migration" or restarts the server,
- **Then** the worker queries the checkpoint database for `last_processed_message_id`,
- **And** resumes processing from message index 231, preventing duplicate posts in the destination channel.
