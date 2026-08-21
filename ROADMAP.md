# 🦞 Mission Control - Roadmap

## Fase 1: Fundamentos (Semana 1)
> Mejorar lo que ya existe y añadir datos reales

### 1.2 Integración con Cron Real
- [ ] Leer cron jobs reales de OpenClaw (`cron list`)
- [ ] Mostrar en calendario con próximas ejecuciones
- [ ] Historial de ejecuciones pasadas

### 1.3 Stats Dashboard
- [ ] Contador de actividades por día/semana
- [ ] Tipos de acciones más frecuentes
- [ ] Tasa de éxito/error

---

## Fase 2: Memory & Files (Semana 2)
> Gestión visual del workspace

### 2.1 Memory Browser
- [ ] Vista árbol de `memory/*.md` y archivos principales
- [ ] Editor markdown con preview
- [ ] Crear/renombrar/eliminar archivos
- [ ] Búsqueda dentro de archivos

### 2.2 File Browser
- [ ] Explorador del workspace completo
- [ ] Preview de archivos (código, markdown, JSON)
- [ ] Descargar archivos
- [ ] Upload de archivos

### 2.3 MEMORY.md Viewer
- [ ] Vista especial para MEMORY.md con secciones colapsables
- [ ] Edición inline
- [ ] Historial de cambios (git log)

---

## Fase 3: Cron Manager (Semana 3)
> Control total de tareas programadas

### 3.1 CRUD de Cron Jobs
- [x] Listar todos los jobs con estado (ya existía)
- [ ] Crear nuevo job con form visual (CronJobModal existe pero no está wired up al API)
- [ ] Editar job existente
- [x] Eliminar job (con confirmación)
- [x] Activar/desactivar job

### 3.2 Cron Builder Visual
- [ ] Selector de frecuencia: diario, semanal, mensual, custom
- [ ] Preview de próximas 5 ejecuciones
- [ ] Selector de timezone
- [ ] Templates predefinidos

### 3.3 Historial de Ejecuciones
- [x] ~~Re-ejecutar manualmente~~ → **"Run Now" button** en CronJobCard (llama a `POST /api/cron/run`)
- [x] **Run History inline** → botón History en CronJobCard, llama a `GET /api/cron/runs?id=<id>`
- [ ] Filtrar historial por fecha, estado
- [ ] Log con output completo

### 3.4 Weekly Timeline View ✅ (nuevo — 2026-02-19)
- [x] Vista tipo calendario de 7 días
- [x] Eventos de cron posicionados por día con hora exacta
- [x] Jobs de intervalo mostrados como "recurring" con dashed border
- [x] Leyenda de colores por job
- [x] Toggle Cards / Timeline en header
- [x] Componente: `CronWeeklyTimeline.tsx`
- [x] Nuevas rutas API: `POST /api/cron/run`, `GET /api/cron/runs`

---

## Fase 4: Analytics (Semana 4)
> Visualización de datos

### 4.1 Gráficas de Uso
- [ ] Actividad por hora del día (heatmap)
- [ ] Tokens consumidos por día (line chart)
- [ ] Tipos de tareas (pie chart)
- [ ] Tendencia semanal

### 4.3 Performance Metrics
- [ ] Tiempo promedio de respuesta
- [ ] Tasa de éxito por tipo de tarea
- [ ] Uptime del agente

---

## Fase 5: Comunicación (Semana 5)
> Interacción bidireccional

### 5.1 Command Terminal
- [ ] Input para enviar mensajes/comandos a Tenacitas
- [ ] Output en tiempo real de respuesta
- [ ] Historial de comandos
- [ ] Shortcuts para comandos frecuentes

### 5.2 Notifications Log
- [ ] Lista de mensajes enviados por canal (Telegram, etc.)
- [ ] Filtrar por fecha, canal, tipo
- [ ] Preview del mensaje
- [ ] Estado de entrega

### 5.4 Notifications System ✅ (nuevo — 2026-02-20)
- [x] **API de notificaciones** → `GET/POST/PATCH/DELETE /api/notifications`
- [x] **NotificationDropdown component** → Bell icon en TopBar con dropdown funcional
- [x] **Unread count badge** → Contador de notificaciones no leídas
- [x] **Notificación types** → info, success, warning, error con iconos y colores
- [x] **Mark as read/unread** → Individual o todas
- [x] **Delete notifications** → Individual o clear all read
- [x] **Links** → Notificaciones pueden tener links a páginas internas
- [x] **Auto-refresh** → Poll cada 30 segundos
- [x] **Integración con cron** → Cron Run Now genera notificación
- [x] **Storage** → JSON file en `data/notifications.json` (hasta 100 notificaciones)
- **Archivos:**
  - NEW: `src/app/api/notifications/route.ts`
  - NEW: `src/components/NotificationDropdown.tsx`
  - MODIFIED: `src/components/TenacitOS/TopBar.tsx`
  - MODIFIED: `src/app/api/cron/run/route.ts` (integración)

---

## Fase 6: Configuración (Semana 6)
> Admin del sistema

### 6.2 Integration Status
- [ ] Estado de conexiones (Twitter, Gmail, etc.)
- [ ] Última actividad por integración
- [ ] Test de conectividad
- [ ] Reautenticar si necesario

### 6.3 Config Editor
- [ ] Ver configuración actual de OpenClaw
- [ ] Editar valores seguros
- [ ] Validación antes de guardar
- [ ] Reiniciar gateway si necesario

---

## Fase 7: Real-time (Semana 7)
> WebSockets y notificaciones live

### 7.2 System Status
- [ ] Heartbeat del agente
- [ ] CPU/memoria del VPS
- [ ] Cola de tareas pendientes

---

## Fase 9: Agent Intelligence (Semana 11)
> Features experimentales y visualizaciones avanzadas

### 9.3 Knowledge Graph Viewer
- [ ] Visualización de conceptos/entidades en MEMORY.md y brain
- [ ] Grafo interactivo con nodes y links
- [ ] Click en un nodo → muestra snippets relacionados
- [ ] Clustering por temas
- [ ] Búsqueda visual
- [ ] Export a imagen

### 9.4 Quick Actions Hub
- [ ] Panel de botones para acciones frecuentes:
  - Backup workspace now
  - Clear temp files
  - Test all integrations
  - Re-authorize expired tokens
  - Git status all repos
  - Restart Gateway
  - Flush message queue
- [ ] Status de cada acción (last run, next scheduled)
- [ ] One-click execution con confirmación

### 9.5 Model Playground
- [ ] Input un prompt
- [ ] Seleccionar múltiples modelos para comparar
- [ ] Ver respuestas lado a lado
- [ ] Mostrar tokens/coste/tiempo de cada uno
- [ ] Guardar experimentos
- [ ] Share results (copy link)

### 9.6 Smart Suggestions Engine
- [ ] Analiza patrones de uso
- [ ] Sugiere optimizaciones:
  - "Usas mucho Opus para tareas simples, prueba Sonnet"
  - "Muchos errores en cron X, revisar configuración"
  - "Heartbeats muy frecuentes, considera reducir intervalo"
  - "Token usage alto en horario Y, programar tareas pesadas en horario valle"
- [ ] Tarjetas de sugerencia con botón "Apply" o "Dismiss"
- [ ] Learn from dismissals

---

## Fase 10: Sub-Agent Orchestra (Semana 12)
> Gestión y visualización de multi-agent workflows

### 10.1 Sub-Agent Dashboard
- [ ] Lista de sub-agentes activos en tiempo real
- [ ] Estado: running, waiting, completed, failed
- [ ] Task description y progreso
- [ ] Modelo usado
- [ ] Tokens consumidos por cada uno
- [ ] Timeline de spawns/completions

### 10.2 Agent Communication Graph
- [ ] Visualización de mensajes entre main agent y sub-agents
- [ ] Flow diagram tipo Sankey o network graph
- [ ] Ver contenido de mensajes al hacer click
- [ ] Filtrar por sesión, fecha, tipo

### 10.3 Multi-Agent Orchestration
- [ ] Crear workflows visuales de múltiples agentes
- [ ] Drag & drop tasks → auto-spawn agents
- [ ] Dependencies entre tasks
- [ ] Parallel vs sequential execution
- [ ] Template workflows guardables

---

## Fase 11: Advanced Visualizations (Semana 13)
> Porque los dashboards cool tienen gráficas cool

### 11.1 3D Workspace Explorer
- [ ] Vista 3D del árbol de archivos
- [ ] Tamaño de nodos = tamaño de archivo
- [ ] Color = tipo de archivo
- [ ] Navigate con mouse
- [ ] Click → preview/edit
- [ ] Wow factor 📈

### 11.3 Sankey Diagrams
- [ ] Flow de tokens: input → cache → output
- [ ] Flow de tareas: type → status
- [ ] Flow de tiempo: hora → actividad → resultado

### 11.4 Word Cloud de Memories
- [ ] Palabras más frecuentes en MEMORY.md
- [ ] Tamaño = frecuencia
- [ ] Click en palabra → buscar en memories
- [ ] Animated on hover

---

## Fase 12: Collaboration (Semana 14)
> Share y trabajo en equipo

### 12.1 Shareable Reports
- [ ] Generar report de actividad semanal/mensual
- [ ] Export a PDF
- [ ] Share link público (read-only)
- [ ] Custom date ranges

### 12.2 Team Dashboard (futuro)
- [ ] Multi-user support
- [ ] Ver actividad de otros agentes
- [ ] Compare performance
- [ ] Shared memory bank

---

## Stack Técnico

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 16 + App Router + React 19 |
| Styling | Tailwind v4 (latest) |
| Charts | Recharts (básicos) + D3.js (avanzados) |
| Editor | Monaco Editor (code) + TipTap (markdown) |
| Real-time | Server-Sent Events (SSE) o Socket.io |
| Graphs/Networks | Cytoscape.js o Vis.js |
| Animations | Framer Motion |
| Storage | JSON files (actual) → SQLite (fase 2) → PostgreSQL (futuro multi-user) |
| AI Integration | OpenClaw API + direct model calls para suggestions |
| PDF Generation | jsPDF o Puppeteer |

---

## Prioridad Recomendada

### Tier 1: Core Functionality (Must Have)
1. **Fase 3** - Cron Manager completo → uso diario
2. **Fase 2** - Memory Browser → gestión de conocimiento

### Tier 2: High Value (Should Have)
3. **Fase 5** - Command Terminal → interacción directa
4. **Fase 9.4** - Quick Actions Hub → productividad inmediata
5. **Fase 10.1** - Sub-Agent Dashboard → visibilidad de workflows

### Tier 3: Intelligence & Insights (Nice to Have)
6. **Fase 4** - Analytics básicos → métricas
7. **Fase 9.6** - Smart Suggestions → IA que se auto-mejora

### Tier 4: Advanced Features (Wow Factor)
8. **Fase 9.3** - Knowledge Graph → visualización avanzada
9. **Fase 10.2** - Agent Communication Graph → debugging multi-agent

### Tier 5: Polish & Experimental (Future)
10. **Fase 7** - Real-time updates → UX premium
11. **Fase 11.1** - 3D Workspace Explorer → alternativa visual
12. **Fase 12** - Collaboration → equipo/público

### Tier 6: Admin & Config (When Needed)
13. **Fase 6** - Config Editor → cuando sea necesario

---

*Creado: 2026-02-07*
*Última actualización: 2026-02-21 (Tenacitas nightly shift)*
