# Quini Lab

Aplicación de análisis del Quini 6: [abrir Quini Lab](https://bunker4444.github.io/quini-lab/) · [historial de solo lectura](https://bunker4444.github.io/quini-lab/historial.html).

## Versión 2.0

- Generación de **1 a 100 combinaciones distintas**, con ranking exacto según el modelo seleccionado. Al aumentar la cantidad, se conserva el prefijo de la lista.
- Copia de la primera jugada, de todas las jugadas y descarga CSV con modalidad, versión y fecha de corte.
- Seis modelos exploratorios regularizados frente al azar uniforme. Selección por pérdida logarítmica de conjuntos completos de seis números.
- Validación temporal 60/20/20, sin usar modalidades del concurso que se intenta anticipar. Prueba final del método fijado en la etapa de selección.
- Frecuencias, ausencia descriptiva, parejas, tríos, últimos concursos y comparación con el algoritmo anterior.
- Cálculo en Web Worker; alternativa sin Worker para navegadores que no lo soportan.

**Ningún método demostró una ventaja predictiva con la base auditada el 13/10/2026.** El ranking ordena puntajes de un modelo exploratorio; no identifica números realmente más probables. En una extracción uniforme, cualquier combinación tiene probabilidad 1 / 9.366.819. K jugadas distintas cubren K / 9.366.819 de los resultados posibles de una extracción, independientemente del ranking.

## Datos

En la revisión del 13/10/2026: **1.669 concursos, 6.676 extracciones**, del 11/07/2010 al 11/10/2026, último concurso 3416. Fuente: [Observatorio de Sorteos](https://www.observatoriodesorteos.com.ar/data/quini6.csv), con la atribución indicada CC BY 4.0. No existe una auditoría oficial integral ni cobertura anterior a julio de 2010.

La revisión conserva `app/data.json` y `app/historial.html` sin cambios. La base se actualiza por GitHub Actions; el motor se recalcula al abrir o comprobar la actualización de la web.

## Publicación y actualización

`pages.yml` publica `app/` después de las pruebas. Se ejecuta por push a main, manualmente y al finalizar correctamente `Actualizar historial Quini 6`. El evento `workflow_run` evita depender de un push realizado con GITHUB_TOKEN, que no dispara otro workflow de push.

`update-history.yml` conserva los tres horarios de importación de las noches de miércoles y domingo. El importador no cambia la fecha ni crea commits si el contenido no cambió. Rechaza resultados parciales, fechas futuras, pérdida de historial y cambios de concursos ya importados; estos últimos requieren revisión explícita. Usa escritura atómica para proteger la base.

## Verificación

Sin dependencias de producción:

```sh
node --test tests/model.test.js
python -m unittest discover -s tests -p '*_test.py'
```

QA opcional de navegador, con Playwright y su Chromium instalados:

```sh
node tests/ui.cjs
```

Ver [METODOLOGIA.md](METODOLOGIA.md) y el [resultado reproducible de la revisión](reports/revision-2026-10-13.json). Este informe es un corte histórico; la aplicación vuelve a calcular el análisis con cada base nueva.
