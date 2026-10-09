# Specification: clean-video-cloning

## Requirement: Copy Video Messages by Server Reference
The system MUST copy video messages from the source channel to the destination channel without downloading/re-uploading video files to disk and without including the "Forwarded from" header.

### Scenario: Video Message Cloned with Full Caption and Entities
- **Given** a message in the source channel containing a video with caption text and styling entities (bold, hashtags, links),
- **When** the worker processes this message,
- **Then** it sends a new message to the destination channel using the video's `InputDocument` reference,
- **And** the destination message contains the identical caption and formatting entities,
- **And** the destination message does NOT have a `fwd_from` header.

### Scenario: Non-Video Message Encountered
- **Given** a message in the source channel that does not contain a video,
- **When** the worker evaluates the message,
- **Then** it skips the message and records a `SKIPPED_NOT_VIDEO` log event without halting the queue.
