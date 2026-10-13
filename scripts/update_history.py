#!/usr/bin/env python3
"""Actualiza Quini Lab desde CSV abierto (CC BY 4.0), preservando trazabilidad."""
import csv
import io
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

URL = "https://www.observatoriodesorteos.com.ar/data/quini6.csv"
TARGET = Path("app/data.json")
MODES = ("Tradicional", "La Segunda", "Revancha", "Siempre Sale")

def valid(numbers):
    return len(numbers) == 6 and len(set(numbers)) == 6 and all(0 <= x <= 45 for x in numbers)

def main():
    request = urllib.request.Request(URL, headers={"User-Agent": "QuiniLab/1.0 (historical data; source attribution)"})
    with urllib.request.urlopen(request, timeout=45) as r:
        raw = r.read(8_000_000)
    rows = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    groups = defaultdict(dict)
    dates = {}
    nrows = 0
    for row in rows:
        contest = str(int(row["sorteo"]))
        day = row["fecha"].strip()
        mode = row["modalidad"].strip()
        if mode not in MODES:
            raise ValueError("Modalidad desconocida: " + mode)
        datetime.strptime(day, "%Y-%m-%d")
        if day > datetime.now(timezone.utc).strftime("%Y-%m-%d"):
            raise ValueError("Fecha futura en la fuente: " + day)
        nums = [int(row["numero" + str(i)]) for i in range(1, 7)]
        if not valid(nums):
            raise ValueError(f"Números inválidos {contest} {mode}")
        if contest in dates and dates[contest] != day:
            raise ValueError("Fechas inconsistentes " + contest)
        dates[contest] = day
        if mode in groups[contest]:
            raise ValueError("Modalidad duplicada " + contest + " " + mode)
        groups[contest][mode] = sorted(nums)
        nrows += 1
    if len(groups) < 100 or nrows < 400:
        raise ValueError("La fuente devolvió una serie insuficiente: " + str(nrows))
    draws = []
    incomplete = 0
    for contest in sorted(groups, key=int, reverse=True):
        if len(groups[contest]) != len(MODES):
            incomplete += 1
        draws.append({"contest": int(contest), "date": dates[contest], "results": groups[contest]})
    data = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Observatorio de Sorteos (CC BY 4.0)",
        "source_url": URL,
        "official_reference": "https://www.loteriasantafe.gov.ar/",
        "attribution": "Datos: Observatorio de Sorteos — licencia Creative Commons Atribución 4.0",
        "draw_count": len(draws),
        "record_count": nrows,
        "incomplete_draws": incomplete,
        "first_date": min(dates.values()),
        "last_date": max(dates.values()),
        "draws": draws,
    }
    if incomplete:
        raise ValueError(f"Fuente incompleta: {incomplete} concursos; conservar la base hasta el próximo intento")
    if TARGET.exists():
        old = json.loads(TARGET.read_text(encoding="utf-8"))
        if old.get("draw_count", 0) > len(draws):
            raise ValueError("Fuente contiene menos sorteos que la base actual; no sobrescribir")
        by_contest = {d["contest"]: d for d in draws}
        for previous in old.get("draws", []):
            current = by_contest.get(previous["contest"])
            if current is None or not set(previous["results"]).issubset(current["results"]):
                raise ValueError("La fuente perdió datos del concurso " + str(previous["contest"]))
            if current != previous:
                raise ValueError("Cambio en un concurso ya importado; requiere revisión: " + str(previous["contest"]))
        comparable = {k: v for k, v in data.items() if k != "updated"}
        if comparable == {k: v for k, v in old.items() if k != "updated"}:
            print("Sin concursos nuevos ni cambios; se conserva la fecha de actualización")
            return
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    temporary = TARGET.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(TARGET)
    print(f"Actualizado: {len(draws)} concursos, {nrows} extracciones; {incomplete} concursos parciales; {data['first_date']} a {data['last_date']}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        raise
