# Quini Lab 2.0 — metodología y revisión

Fecha de revisión: 13/10/2026. Versión del motor: 2.0.0.

## Qué responde el ranking

Ordena combinaciones según un modelo probabilístico exploratorio estimado con el historial. No afirma que dicho modelo represente mejor el próximo sorteo que la distribución uniforme. No existe un algoritmo capaz de asegurar los próximos seis números de un mecanismo justo e independiente.

En una extracción uniforme de 6 números de 46, hay C(46,6) = 9.366.819 resultados posibles. Para K combinaciones distintas, la probabilidad de acertar los seis en esa extracción es exactamente K / 9.366.819. No se usa la fórmula de eventos independientes: los K aciertos exactos son mutuamente excluyentes en la misma extracción. Compartir números entre jugadas no cambia esa cobertura de seis aciertos. Sí afecta la distribución conjunta de premios menores, que este ranking no optimiza.

## Modelos comparados

Parámetros prefijados antes de ejecutar la prueba final de esta versión:

| Modelo | Historial | Suavizado hacia 6/46 |
|---|---|---:|
| Uniforme | No requiere | Todos los conjuntos iguales |
| Frecuencia 200 | Completo | 200 pseudoextracciones |
| Frecuencia 1000 | Completo | 1.000 pseudoextracciones |
| Recencia 52 | Decaimiento exponencial, semivida 52 concursos | 200 pseudoextracciones |
| Recencia 156 | Semivida 156 concursos | 200 pseudoextracciones |
| Recencia 416 | Semivida 416 concursos | 200 pseudoextracciones |
| Ensamble | Media de log-odds de los seis anteriores, incluido uniforme | Contracción adicional hacia uniforme |

Para cada número i:

- q_i = (c_i + alpha × 6/46) / (exposición + alpha).
- w_i = q_i / (1-q_i).
- Para un conjunto S de seis números: P_modelo(S) = producto(w_i, i en S) / e_6(w).
- e_6 es la suma de productos de pesos de todos los conjuntos distintos de seis; se calcula exactamente con programación dinámica.

q_i son estimadores suavizados de inclusión usados como parámetros. Después de condicionar a seis, no se presentan como probabilidades marginales calibradas del modelo final. La independencia de Bernoulli antes del condicionamiento es una hipótesis de trabajo, no una afirmación sobre sesgos del bolillero. Tampoco se afirma que esto constituya una inferencia bayesiana conjunta exacta sobre el mecanismo real.

Se preservan las parejas, tríos y atrasos como estadísticas descriptivas. El algoritmo anterior con pesos 43/12/5/27/13 queda disponible por separado. Multiplicar hipótesis sobre parejas y tríos con esta muestra añadiría muchos parámetros; no se les adjudica una ventaja por aparecer más en el pasado.

## Selección temporal sin mirar el concurso objetivo

1. Orden cronológico y agrupación por concurso. Una modalidad no aprende las otras modalidades del mismo concurso.
2. Primer 60 % de concursos: entrenamiento inicial.
3. Siguiente 20 %: se pronostica antes de incorporar cada concurso y se compara la pérdida logarítmica del conjunto completo. Se selecciona una sola alternativa no uniforme entre seis, sin consultar la prueba final.
4. Último 20 %: se audita únicamente la alternativa ya seleccionada, manteniendo fijos sus hiperparámetros. Se actualizan los conteos sólo después de cada concurso observado.
5. Al terminar la auditoría se utiliza ese mismo método, ajustado con el historial completo, para ordenar las próximas jugadas.

El uniforme se informa como referencia y puede superar a todos los candidatos. Aun en ese caso la interfaz ofrece el ranking exploratorio pedido por el usuario y avisa que no hay ventaja demostrada; no vende el ganador entre seis alternativas como superior al uniforme.

La ganancia logarítmica es log(P_modelo(resultado)) - log(1/C(46,6)). Valores positivos favorecen al modelo. Se promedian primero las extracciones dentro del concurso y luego los concursos, para que una fecha con más modalidades no tenga más peso. La media de aciertos usa el mismo criterio. La tabla de distribución conserva el conteo de extracciones.

Los IC 95 % normales aproximados usan la varianza Newey–West de las medias por concurso con lag floor(4 × (n/100)^(2/9)). Un intervalo que contiene cero no prueba una mejora. La etiqueta de señal favorable requiere ganancia positiva en selección, límite inferior positivo en la prueba final y ganancia positiva en cada mitad de la prueba final. Incluso si se cumple, sólo se describe como señal retrospectiva a confirmar, sin promesa de acertar.

No se elige el candidato con más aciertos en la prueba final. Tampoco se prueban repetidamente nuevos pesos hasta que esta base produzca un resultado favorable. La prueba es retrospectiva y se recalcula sobre ventanas móviles; las revisiones futuras del código, la consulta de varias modalidades y la reutilización del historial limitan cualquier interpretación confirmatoria. La confirmación sólida requiere un registro de predicciones emitidas antes de sorteos nuevos; ese registro prospectivo persistente todavía no está implementado.

Con menos de 500 concursos se usa Frecuencia 1000 y se informa que no hay prueba independiente suficiente.

## Ranking de combinaciones completas

Los pesos se ordenan de mayor a menor. Una cola de prioridad explora conjuntos de seis índices crecientes, empezando por los seis primeros. Cada vecino incrementa un índice manteniendo el orden; por lo tanto, nunca mejora el puntaje de su padre. Cada conjunto es alcanzable desde el inicial. El recorrido best-first devuelve los K conjuntos globalmente mejores del modelo, con deduplicación y desempate determinista.

Se evita enumerar explícitamente los 9,3 millones de resultados, sin restringir la búsqueda a una muestra. El ranking se verifica contra una enumeración exhaustiva independiente en universos pequeños, incluyendo empates. Las listas de 1, 10 y 100 comparten el mismo prefijo.

El puntaje mostrado es 100 × P_modelo(S) / P_modelo(S_primero). Es una escala relativa, **no un porcentaje de ganar**. Se conserva la probabilidad uniforme como referencia real bajo el supuesto de un sorteo justo. El ranking no impone diversidad artificial entre combinaciones: hacerlo cambiaría el orden pedido.

## Resultado de la revisión

Sobre 1.669 concursos / 6.676 extracciones hasta el 11/10/2026:

- Entrenamiento inicial: 1.001 concursos.
- Selección: 334 concursos.
- Prueba final: 334 concursos; 334 extracciones por modalidad o 1.336 en Todas.
- El uniforme tuvo menor pérdida logarítmica que todas las alternativas en la selección de las cuatro modalidades y del historial combinado.
- Ninguna modalidad cumplió el criterio de señal favorable en prueba final.
- No se observaron seis aciertos del primer conjunto del nuevo modelo en esa prueba. Esto no permite medir con precisión un evento tan raro.

Los valores completos, modelos, intervalos, primeras diez combinaciones y hash del dataset se guardan en `reports/revision-2026-10-13.json`. Ese archivo es un corte, no la fuente de pronósticos de la interfaz.

## Correcciones técnicas

- El backtest anterior modificaba `nOut` declarada const: se corrigió a let.
- En Todas, el modelo anterior podía incorporar resultados de otras modalidades del concurso objetivo: se excluyen del entrenamiento.
- El motor nuevo agrupa y evalúa el concurso entero antes de actualizar conteos.
- Se rechazan duplicados, números inválidos, fechas inválidas y datos futuros en la carga pública.
- Una solicitud obsoleta de cálculo no sobrescribe una modalidad o cantidad elegida después.
- Copiar/exportar se bloquea al cambiar parámetros o ante errores de datos.
- La publicación incluye pruebas automáticas y se enlaza a la finalización del importador.
- El importador conserva bytes y fecha cuando nada cambió; aborta ante datos parciales, pérdida de datos o correcciones históricas pendientes de revisión.

## Fuentes y límites

- [Reglas de Quini 6 — Lotería de Santa Fe](https://www.loteriasantafe.gov.ar/quini-preguntas-frecuentes/): seis números del 00 al 45. Probabilidades calculadas a partir de esa regla.
- [Base de Observatorio de Sorteos](https://www.observatoriodesorteos.com.ar/data/quini6.csv): fuente de terceros con atribución CC BY 4.0 indicada en la base. No se auditó cada resultado contra el extracto oficial.
- [GitHub — disparo de workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow): los pushes con GITHUB_TOKEN no inician otro workflow de push. Pages utiliza además workflow_run.

Todas mezcla modalidades y presupone un mismo proceso estadístico. No calcula probabilidades conjuntas de cuatro sorteos ni probabilidades de cobrar premios con reglas diferentes. No se agregó historial anterior al 11/07/2010 ni un sistema nuevo de notificaciones.
