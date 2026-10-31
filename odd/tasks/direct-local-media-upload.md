# Feature: Direct Local Media Upload & Channel Content Management
Allow users to upload and publish local files (videos, photos, documents) directly to any channel without prior cloning, as well as editing captions and deleting messages in target channels.
Delivery strategy: single-pr

## Specs
- S1: Backend Gateway & Port methods: send_local_media, send_text_message, delete_channel_message, edit_channel_message.
- S2: API Endpoints in channels.py:
  - POST /api/channels/{channel_id}/upload (multipart file + caption/text)
  - DELETE /api/channels/{channel_id}/messages/{message_id}
  - PATCH /api/channels/{channel_id}/messages/{message_id}
- S3: Frontend UI component DirectUploadModal.tsx with file drag & drop, file size preview, caption editor, and upload progress.
- S4: Trigger button "+ Subir Local" in MigrationControlPanel.tsx connected to selected target channel.

## Tasks
- [x] T1 (S1): Add upload, text, delete, and edit methods to TelegramGatewayPort and TelethonAdapter [inline]
- [x] T2 (S1): Write tests in test_channel_upload_and_management.py verifying upload, delete, and edit endpoints [inline]
- [x] T3 (S2): Implement endpoints in channels.py router with multipart handling [inline]
- [x] T4 (S3): Create DirectUploadModal.tsx in frontend [inline]
- [x] T5 (S4): Wire "+ Subir Local" button into MigrationControlPanel.tsx and migrationApi.ts [inline]
- [x] T6 (S1-S4): Run backend test suite (pytest: 36 tests passing) and frontend build (vite) [inline]
- [x] T7 (S1-S4): Deploy to Docker and commit with Conventional Commits [inline]

## Log
- L1: User requested ability to upload local content directly to a channel without cloning, plus edit/delete channel content.
- L2: Implementados métodos send_local_media, send_text_message, delete_channel_message, edit_channel_message en TelethonAdapter y TelegramGatewayPort.
- L3: Integrado python-multipart y añadidos endpoints POST upload, DELETE y PATCH message en channels.py.
- L4: Verificados 4 nuevos tests en test_channel_upload_and_management.py (36 tests totales en 6.01s).
- L5: Creado DirectUploadModal.tsx con drag & drop de videos/fotos/documentos, preview de peso, editor de caption y barra de progreso.
- L6: Añadido botón "Subir desde mi PC (+ Publicar directo)" en MigrationControlPanel.tsx bajo el canal destino ("Para:").
- L7: Frontend compilado en 2.32s y desplegado en contenedor Nginx.
