# DannyZCars Marketplace — PRD

## Original Problem Statement
> Necesito que esta pagina la hagas como market place de facebook para publicar y buscar tambien quiero un login de administrador para que solo yo pueda hacer cambios a esa maquina tambien que las secciones que tengo en la pagina las habras y se puedan ver las cosas listadas

## User Choices
- Tipo: Autos / vehículos / **principalmente autopartes**
- Solo admin publica
- Login admin: email/contraseña (JWT)
- Subida de imágenes con almacenamiento de archivos (object storage)
- Contacto: WhatsApp + mensajería interna

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui · Fonts: Syne (display) + Manrope (body)
- **Backend**: FastAPI + Motor (MongoDB)
- **Auth**: JWT (httpOnly cookie + Bearer fallback in localStorage), admin seeded from env at startup
- **Object Storage**: Emergent Object Storage (`/objstore`) for listing images, files proxied through `/api/files/{path}`
- **Aesthetic**: Dark luxury automotive — `#0b0b0d` background, `#ff3d00` accent, grain noise overlay

## User Personas
- **Admin (Danny)** — Único usuario con privilegios: publica, edita, elimina, modera mensajes
- **Visitante / Comprador** — Navega, busca, filtra, contacta por WhatsApp o mensaje interno (sin registro)

## Implemented (2026-02)
### Backend
- Auth: POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`
- Listings (público): GET `/api/listings` (filtros: q, category, subcategory, condition, min_price, max_price, sort), GET `/api/listings/{id}`
- Listings (admin): POST/PUT/DELETE `/api/listings`
- Upload: POST `/api/upload` (multipart, max 5MB, jpg/png/webp/gif), GET `/api/files/{path:path}`
- Messages: POST `/api/messages` (público), GET `/api/admin/threads`, GET/POST/DELETE `/api/admin/threads/{id}`, POST `/api/admin/threads/{id}/reply`
- Misc: GET `/api/categories`, GET `/api/admin/stats`
- Admin seed automático desde `.env` + índices MongoDB

### Frontend
- `/` Home — hero cinemático, search bar, chips de categoría, 3 bloques (Refacciones / Rines / Autos) con últimas 8 publicaciones cada uno
- `/browse` — grid con filtros laterales (subcategoría, condición, precio min/max, orden) y resultados en vivo
- `/listing/:id` — galería con thumbnails + flechas, sticky sidebar con precio, specs, botón WhatsApp + diálogo de mensaje interno, pestañas descripción/detalles
- `/admin/login` — formulario con glow effect
- `/admin` — dashboard con stats, tabla de inventario, toggle activo, editar, eliminar (confirmación)
- `/admin/new` y `/admin/edit/:id` — formulario completo con subida múltiple de imágenes
- `/admin/messages` — bandeja dual-pane (lista + conversación activa) con respuesta inline

## Test Credentials
- Email: `admin@dannyzcars.com`
- Password: `DannyZ2026!`

## Tests
- Backend: 29/29 pytest passing
- Frontend: 100% flows OK (smoke + e2e via testing agent)

## Backlog (Prioridad)
### P1
- Reemplazar `CORS_ORIGINS=*` con dominio explícito de producción
- Endpoint para soft-delete de imágenes subidas (evitar huérfanos)
- Notificación por email al admin cuando llega mensaje nuevo (Resend o SendGrid)
- WhatsApp click-to-chat: enlace por publicación + número global en footer

### P2
- Búsqueda avanzada con texto completo (índice text de MongoDB ya creado)
- Galería con zoom / lightbox
- Compartir publicación (Open Graph meta + botones sociales)
- Reportes admin (top categorías, vistas por publicación)
- Lockout brute-force en `/api/auth/login`
- Recovery de contraseña admin por email

### P3
- Carrito / cotizaciones
- Pasarela de pago (Stripe en MXN)
- Marketplace multi-vendedor (registro de tiendas)
