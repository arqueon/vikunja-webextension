# Kanban y triage de tareas desde la extensión

**Proyecto:** vikunja-webextension (Vikunja Companion) · **Fecha:** 2026-11-25 · **Estado:** evaluación pendiente de VoBo

## Contexto

La extensión ya cubre captura (URL, contexto, pipeline con proyecto+labels por defecto) y lista
con filas de dos líneas. Lo que falta para el flujo diario de Rubén es el **triage**: decidir qué
hacer con las tareas que van llegando al Inbox (proyecto 1, alimentado por Hermes con las etiquetas
personal/trabajo/academia) y clasificarlas sin abrir la web de Vikunja.

Petición: usar otras vistas, sobre todo la **kanban**, y poder hacer triage desde la misma extensión.

## Viabilidad técnica (verificada contra la API)

- Los kanbans de Vikunja son **vistas** de un proyecto: la extensión ya consume
  `GET /projects/{id}/views` (usa `listProjectViews` para el orden manual), así que encontrar
  vistas de tipo kanban es directo.
- `GET /projects/{id}/views/{view}/buckets` devuelve los buckets (columnas) del tablero;
  `GET /projects/{id}/views/{view}/tasks` las tareas de esa vista (ya usado por el popup).
- Cada tarea lleva `bucket_id` y `position`; mover una tarjeta = `PATCH /api/v2/tasks/{id}`
  con `bucket_id` (el mismo merge-patch que la extensión ya usa para done/priority). No hacen
  falta permisos de API nuevos.
- Riesgo menor: Vikunja usa además `kanban_position` para el orden dentro de la columna
  (drag con reordenado fino). Para v1 basta arrastrar "a la columna" y dejar que el servidor
  coloque al final; el reordenado fino dentro de la columna puede quedar para después.

**Conclusión: es viable sin permisos ni endpoints nuevos.** El trabajo es de UI: tablero con
columnas horizontales, tarjetas compactas y drag & drop.

## Decisiones a tomar

:::question
¿Dónde vive el tablero kanban?

El popup mide 480px: caben 2-3 columnas apretadas y el drag es incómodo. Una página propia de la
extensión abierta en una pestaña da espacio real y no toca el popup.

- [ ] Pestaña propia (página `kanban/kanban.html` abierta en tab, ancho completo) — espacio real para columnas y drag cómodo; se lanza desde un botón del popup
- [ ] Dentro del popup de 480px — todo en un sitio, pero 2 columnas visibles y tarjetas recortadas
- [ ] Ventana flotante tipo panel (window.open ~900px) — aislada como una app de triage, se puede dejar abierta al lado

Recommended: Pestaña propia (página `kanban/kanban.html` abierta en tab, ancho completo) — espacio real para columnas y drag cómodo; se lanza desde un botón del popup
:::

:::question
¿Las columnas son buckets reales de un tablero kanban, o columnas de triage sintéticas?

Tus proyectos no tienen hoy vistas kanban (el triage actual es mover de Inbox al proyecto destino).
Un kanban real requiere crear la vista+ buckets en Vikunja una vez; el sintético funciona con lo
que ya hay.

- [ ] Buckets reales de una vista kanban del proyecto — fiel a Vikunja, el mismo tablero se ve en la web; requiere crear la vista/buckets una vez
- [ ] Columnas de triage sintéticas mapeadas a proyectos — p. ej. columnas = proyectos destino (personal/trabajo/academia/…), arrastrar = mover de proyecto; cero configuración nueva
- [ ] Híbrido: si el proyecto tiene vista kanban úsala, si no muestra columnas=proyectos — más código, cubre ambos mundos

Recommended: Columnas de triage sintéticas mapeadas a proyectos — p. ej. columnas = proyectos destino (personal/trabajo/academia/…), arrastrar = mover de proyecto; cero configuración nueva
:::

:::question
¿Qué tablero abre por defecto al pulsar el botón?

- [ ] Siempre Inbox (proyecto 1) — el triage siempre empieza donde cae lo nuevo de Hermes
- [ ] Selector de proyecto al abrir, recordando el último usado — sirve también como panel general de otros proyectos
- [ ] Proyecto de captura configurado (captureProjectId de las opciones) — coherente con el resto de la extensión

Recommended: Siempre Inbox (proyecto 1) — el triage siempre empieza donde cae lo nuevo de Hermes
:::

:::question
¿Qué hace cada tarjeta al arrastrarla? (alcance del gesto de triage)

Su pipeline: tarea en Inbox → clasificar por proyecto destino y opcionalmente etiqueta/fecha.

- [ ] Solo mover (columna/proyecto destino) — mínimo viable, el resto se edita aparte
- [ ] Mover + etiqueta rápida en la tarjeta — al soltar, la tarjeta ofrece chips de labels frecuentes (personal/trabajo/academia/…) de un clic
- [ ] Mover + etiqueta + fecha en la tarjeta — gestor completo: chips de labels y presets de fecha (hoy/mañana/esta semana) al soltar

Recommended: Mover + etiqueta rápida en la tarjeta — al soltar, la tarjeta ofrece chips de labels frecuentes (personal/trabajo/academia/…) de un clic
:::

:::question
¿Qué interacción de movimiento implementamos?

- [ ] Drag & drop nativo (HTML5 DnD) con botones ←/→ como alternativa teclado/precisión — cómodo con ratón, usable con teclado
- [ ] Solo botones ←/→ por tarjeta — más simple, menos elegante
- [ ] Solo drag & drop — mínimo código, inaccesible sin ratón

Recommended: Drag & drop nativo (HTML5 DnD) con botones ←/→ como alternativa teclado/precisión — cómodo con ratón, usable con teclado
:::

:::question
¿Qué se puede hacer con una tarjeta además de moverla? (v1)

- [ ] Ver + mover + completar (checkbox en la tarjeta) + abrir en la web — cubre el triage completo diario
- [ ] Solo ver + mover — primera versión mínima
- [ ] Editor completo en la tarjeta (due, priority, description, borrar) — más potencia, más tiempo de desarrollo

Recommended: Ver + mover + completar (checkbox en la tarjeta) + abrir en la web — cubre el triage completo diario
:::

:::question
¿Qué tareas se muestran en el tablero?

- [ ] Solo pendientes (done = false) — el tablero es triage, lo hecho no estorba
- [ ] Todas con toggle — útil para revisar lo recién completado

Recommended: Solo pendientes (done = false) — el tablero es triage, lo hecho no estorba
:::

## Propuesta de implementación (si se aprueba)

1. `kanban/kanban.html|css|js` — página propia con el mismo sistema de diseño Proton y tokens
   (`styles/common.css`); selector de proyecto y columnas con scroll horizontal.
2. `lib/vikunja.js`: `listBuckets`/`moveTaskToBucket` (o `moveTaskToProject` si columnas=proyectos),
   reutilizando `paginate` y el merge-patch existente.
3. Botón en el header del popup (icono de tablero) que abre `browser.tabs.create`.
4. Smoketests del flujo mover (mock de buckets + assert del PATCH) y del fallback sintético.
5. README + locales (en/es/de/ru).

Estimación: una sesión de trabajo (UI + drag + tests), más otra si se pide editor completo por tarjeta.

## Respuestas (2026-11-25)

Respuestas recibidas vía Plannotator (compuerta .revision/kanban-triage-2026-11-25.respuesta.json), 7/7 respondidas:

1. **¿Dónde vive el tablero?** → Ventana flotante tipo panel (window.open ~900px).
2. **¿Columnas?** → Columnas de triage sintéticas mapeadas a proyectos. Nota: «Igual que en vikunja».
3. **¿Tablero por defecto?** → Siempre Inbox (proyecto 1).
4. **¿Qué hace la tarjeta al mover?** → Otro: «Se usaron los objetos con prefijo GTG- pero hay otros proyectos en vikunja, estas son vistas de filtro, las vistas kanban ya están definidas en vikunja podemos usar esas mismas columnas (generalmente los proyectos tienen To-Do, Doing, Done y las vistas GTD- el traige de GTD), debemos poder separar ya sea por las vistas o por los proyectos y tener la vista de kanban que tengan definida en vikunja».
5. **¿Interacción?** → Drag & drop nativo con botones ←/→ como alternativa.
6. **¿Qué permite la tarjeta?** → Ver + mover + completar (checkbox) + abrir en la web.
7. **¿Qué tareas se muestran?** → Todas con toggle.

### Alcance autorizado resultante

- Página `kanban/kanban.html` abierta en **ventana flotante ~900px** desde un botón del popup.
- **Agrupación dual**: «Por vistas» (usa la vista kanban real del proyecto y sus buckets/columnas,
  p. ej. To-Do/Doing/Done) y «Por proyectos» (columnas sintéticas = proyectos destino); selector
  de modo y fallback automático a proyectos cuando el proyecto no tiene vista kanban.
- Proyecto por defecto: **Inbox**, con selector para otros proyectos.
- Drag & drop + botones ←/→; tarjeta con checkbox de completar y enlace a la web.
- Todas las tareas visibles por defecto, con toggle de solo pendientes.
