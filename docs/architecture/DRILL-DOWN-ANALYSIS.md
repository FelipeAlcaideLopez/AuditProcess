# Salesforce Org Audit Dashboard - Drill-Down Architecture Analysis

## Executive Summary

**Problema identificado:** El dashboard actual muestra información a nivel de resumen pero **NO permite drill-down a nivel de detalle individual**. Por ejemplo, un usuario ve "914 violations ApexDoc" pero no puede ver CUÁLES son esas 914 violaciones específicas.

**Benchmark de competidores:**
- **Hubbl.com**: Issue Lifecycle Management con visibilidad de issues individuales, prioritización por impacto, roadmap de acción
- **Quality Clouds**: Drill-down desde categoría → regla → archivo → línea de código
- **CodeScan**: Vista a nivel de archivo con resaltado de líneas problemáticas

---

## Gap Analysis por Módulo

### 1. PMD Analysis (Apex Code Quality)

| Lo que muestra ahora | Lo que FALTA |
|---------------------|--------------|
| Total violations: 3,053 | Lista de cada violación individual |
| By Category chart | Click en categoría → ver violaciones de esa categoría |
| By Rule chart | Click en regla → ver dónde se viola |
| Top Files table | Click en archivo → ver todas las violaciones en ese archivo |
| | **Ver línea exacta y mensaje de cada violación** |

**Data Disponible:** El reporte PMD original (`reports/pmd/pmd-report.json`) tiene TODA la información:
```json
{
  "filename": "SomeClass.cls",
  "violations": [
    {
      "beginline": 45,
      "begincolumn": 12,
      "endline": 45,
      "endcolumn": 35,
      "rule": "ApexDoc",
      "ruleset": "Documentation",
      "priority": 3,
      "description": "Missing ApexDoc comment"
    }
  ]
}
```

**Acción:** El script `analyze-pmd-results.js` DESCARTA esta información. Línea 91-94 crea un array `violations` pero NUNCA lo llena.

---

### 2. Flow Analysis

| Lo que muestra ahora | Lo que FALTA |
|---------------------|--------------|
| Total Flows: 81 | Ver todos los flows con sus issues |
| Issues Summary counts | Click en "DML in Loops: 5" → ver cuáles 5 flows |
| Complex Flows table | Click en flow → ver DÓNDE están los issues dentro del flow |
| | **Ver elementos específicos del flow con problemas** |
| | **Ver el hardcoded ID específico detectado** |

**Data Disponible:** El JSON tiene issues por flow pero no los detalles granulares.

**Acción:** Mejorar `analyze-flows.js` para capturar:
- Nombres de elementos con DML en loop
- Los IDs hardcodeados encontrados
- Variables específicas no usadas

---

### 3. Apex Classes & Coverage

| Lo que muestra ahora | Lo que FALTA |
|---------------------|--------------|
| Org Coverage: X% | Ver todas las clases con su coverage |
| Low Coverage table (top 20) | **Ver TODAS las clases, no solo 20** |
| Test Issues table | Click en test class → ver código problemático |
| | **Ver líneas NO cubiertas de cada clase** |
| | **Filtrar/ordenar por coverage, API version, type** |

**Data Disponible:** `apex-classes-analysis.json` tiene el array `classes` con toda la info.

**Acción:** El dashboard solo muestra `lowCoverageClasses.slice(0, 20)`. Necesita tabla completa con paginación/filtros.

---

### 4. Objects & Fields

| Lo que muestra ahora | Lo que FALTA |
|---------------------|--------------|
| Summary counts | Ver lista completa de objetos |
| Limits warnings | Click en objeto → ver todos sus fields |
| Top objects table (20) | Ver TODOS los fields de un objeto |
| | **Ver qué campos faltan description** |
| | **Ver validation rules completas** |

**Data Disponible:** `object-analysis.json` tiene `objects[]` con todo.

---

### 5. Documentation (Descriptions)

| Lo que muestra ahora | Lo que FALTA |
|---------------------|--------------|
| Missing counts by type | Ver TODOS los items sin description |
| Tables limited to 20 | **Paginación/filtros para ver todos** |
| | Exportar lista para remediation |

---

## Diseño de Solución: Modal Drill-Down Pattern

### Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Vista actual)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Summary Card │  │    Chart     │  │   Summary Table  │  │
│  │   914 docs   │  │   by Rule    │  │  Top 15 files    │  │
│  │  [Ver todo]  │  │ [clickable]  │  │  [expandable]    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Click
┌─────────────────────────────────────────────────────────────┐
│              MODAL DETAIL VIEW (Nueva funcionalidad)         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ApexDoc Violations (914 total)           [Export] [X]   ││
│  │─────────────────────────────────────────────────────────││
│  │ Filter: [Severity ▼] [File ▼]  Search: [________]       ││
│  │─────────────────────────────────────────────────────────││
│  │ File                  │ Line │ Message         │ Sev    ││
│  │─────────────────────────────────────────────────────────││
│  │ AccountService.cls    │  45  │ Missing ApexDoc │ Medium ││
│  │ AccountService.cls    │  67  │ Missing ApexDoc │ Medium ││
│  │ ContactHelper.cls     │  12  │ Missing ApexDoc │ Medium ││
│  │ ...                                                      ││
│  │─────────────────────────────────────────────────────────││
│  │ Showing 1-50 of 914  [◀ Prev] [1][2][3]...[19] [Next ▶] ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Plan de Implementación

### Fase 1: Data Enhancement (Scripts) - ALTA PRIORIDAD

#### 1.1 PMD Script Enhancement
**Archivo:** `scripts/analyze-pmd-results.js`

```javascript
// ANTES (línea 90-94):
if (!analysis.byFile[fileName]) {
    analysis.byFile[fileName] = { count: 0, violations: [] };
}
analysis.byFile[fileName].count++;
// violations array NEVER populated!

// DESPUÉS:
if (!analysis.byFile[fileName]) {
    analysis.byFile[fileName] = { count: 0, violations: [] };
}
analysis.byFile[fileName].count++;
analysis.byFile[fileName].violations.push({
    line: violation.beginline,
    column: violation.begincolumn,
    rule: violation.rule,
    severity: severity,
    message: violation.description,
    ruleset: violation.ruleset
});
```

Nuevo archivo output: `pmd-violations-detail.json`
```json
{
  "totalViolations": 3053,
  "violations": [
    {
      "file": "AccountService.cls",
      "line": 45,
      "column": 12,
      "rule": "ApexDoc",
      "severity": "Medium",
      "message": "Missing ApexDoc comment",
      "category": "Documentation"
    }
  ]
}
```

#### 1.2 Flow Script Enhancement
**Archivo:** `scripts/analyze-flows.js`

Capturar detalles específicos:
```javascript
// Para hardcoded IDs - guardar cuáles son
if (analysis.hardcodedIds > 0) {
    analysis.issues.push(`${analysis.hardcodedIds} hardcoded IDs`);
    analysis.hardcodedIdDetails = potentialIds; // ← NUEVO: guardar los IDs
}

// Para DML en loops - identificar elementos
// Guardar nombres de elementos problemáticos
```

---

### Fase 2: Dashboard UI Enhancement - ALTA PRIORIDAD

#### 2.1 Modal Component
**Archivo:** `docs/dashboard/index.html` - Añadir modal HTML

```html
<!-- Detail Modal -->
<div id="detail-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="modal-title">Details</h2>
            <div class="modal-actions">
                <button id="export-btn" class="btn-export">Export CSV</button>
                <button class="modal-close">&times;</button>
            </div>
        </div>
        <div class="modal-filters">
            <select id="modal-filter-severity">...</select>
            <select id="modal-filter-file">...</select>
            <input type="text" id="modal-search" placeholder="Search...">
        </div>
        <div class="modal-body">
            <table id="modal-table">...</table>
        </div>
        <div class="modal-pagination">...</div>
    </div>
</div>
```

#### 2.2 Modal JavaScript
**Archivo:** `docs/dashboard/app.js` - Añadir lógica modal

```javascript
// Modal management
let modalData = [];
let currentPage = 1;
const itemsPerPage = 50;

function openDetailModal(title, data, columns) {
    modalData = data;
    currentPage = 1;
    document.getElementById('modal-title').textContent = title;
    renderModalTable(columns);
    document.getElementById('detail-modal').classList.add('active');
}

function renderModalTable(columns) {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = modalData.slice(start, start + itemsPerPage);
    // Render table with pagination
}

function exportToCSV() {
    // Export current filtered data to CSV
}
```

#### 2.3 CSS Styles
**Archivo:** `docs/dashboard/styles.css` - Modal styles

```css
.modal { /* Overlay */ }
.modal.active { display: flex; }
.modal-content { /* Centered panel */ }
.modal-pagination { /* Page controls */ }
```

---

### Fase 3: Click Handlers - MEDIA PRIORIDAD

#### 3.1 PMD Section
- Click en chart bar → Modal con violaciones de esa regla
- Click en file row → Modal con violaciones de ese archivo
- Click en count badge → Modal con todas las violaciones

#### 3.2 Flow Section
- Click en flow name → Modal con detalles del flow
- Click en issue count → Modal con flows que tienen ese issue

#### 3.3 Apex Classes Section
- Click en class name → Modal con detalles de coverage
- Click en coverage metric → Modal con clases filtradas

---

### Fase 4: Export Functionality - MEDIA PRIORIDAD

- Export to CSV
- Export to JSON
- Copy to clipboard
- Print-friendly view

---

## Priorización por Impacto

| Mejora | Impacto | Esfuerzo | Prioridad |
|--------|---------|----------|-----------|
| PMD violations detail | ALTO - Data ya existe | BAJO | 1 |
| Modal component | ALTO - Patrón reusable | MEDIO | 2 |
| PMD drill-down UI | ALTO | BAJO | 3 |
| Flow details enhancement | ALTO | MEDIO | 4 |
| Apex classes full table | MEDIO | BAJO | 5 |
| Export CSV | MEDIO | BAJO | 6 |
| Objects detail view | MEDIO | MEDIO | 7 |
| Documentation full list | BAJO | BAJO | 8 |

---

## Quick Wins (Implementar primero)

1. **PMD violations detail data** - Solo cambiar script, data ya existe en PMD report
2. **Tables sin límite de 20** - Mostrar todos con scroll/pagination
3. **Click handlers básicos** - Mostrar alert/console con más info

---

## Comparativa con Competidores

| Feature | Nuestra App | Hubbl | Quality Clouds |
|---------|-------------|-------|----------------|
| Summary Dashboard | ✅ | ✅ | ✅ |
| Drill-down to Rule | ❌ | ✅ | ✅ |
| Drill-down to File | ❌ | ✅ | ✅ |
| Drill-down to Line | ❌ | ✅ | ✅ |
| Export Results | ❌ | ✅ | ✅ |
| Issue Tracking | ❌ | ✅ | ✅ |
| Remediation Roadmap | Partial | ✅ | ✅ |
| Historical Trends | ❌ | ✅ | ✅ |

---

## Conclusión

El gap principal es que **tenemos los datos pero no los mostramos**. El PMD report tiene toda la información a nivel de línea, pero nuestro script la descarta.

**Acción inmediata:** Modificar scripts para preservar datos detallados, luego implementar modal drill-down.

**Estimated effort:**
- Fase 1 (Data): 2-3 horas
- Fase 2 (UI): 4-6 horas
- Fase 3-4 (Polish): 2-3 horas
