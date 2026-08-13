#!/usr/bin/env python3
"""Taie automat liniștea dintr-un video.

Folosire:
    python3 autocut.py intrare.mp4 iesire.mp4

Scriptul ascultă pista audio, găsește porțiunile de liniște (vânt fără voce,
așteptare între trăgături, pauze de vorbit) și lipește la loc doar bucățile
în care se aude ceva. Are nevoie de ffmpeg și ffprobe în PATH.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

# Valori implicite, alese pentru filmări în exterior la lac (vânt de fond).
PRAG_IMPLICIT = "-32dB"
LINISTE_MINIMA = 0.6      # secunde de liniște sub care nu tăiem nimic
MARGINE = 0.15            # secunde păstrate în plus la capetele fiecărei bucăți
SEGMENT_MINIM = 0.4       # bucăți mai scurte de atât se aruncă (ar clipi urât)


class EroareAutocut(Exception):
    """Eroare pe care o arătăm frumos utilizatorului, fără traceback."""


def ruleaza(comanda, capteaza=True):
    """Rulează o comandă externă și întoarce (cod, stdout, stderr)."""
    proces = subprocess.run(
        comanda,
        stdout=subprocess.PIPE if capteaza else None,
        stderr=subprocess.PIPE if capteaza else None,
        text=True,
    )
    return proces.returncode, proces.stdout or "", proces.stderr or ""


def verifica_unelte():
    for unealta in ("ffmpeg", "ffprobe"):
        if shutil.which(unealta) is None:
            raise EroareAutocut(
                f"Nu găsesc {unealta} în PATH. Instalează ffmpeg și încearcă din nou."
            )


def descrie_fisier(cale):
    """Întoarce (durata_in_secunde, are_audio) pentru fișierul de intrare."""
    cod, iesire, eroare = ruleaza([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-show_entries", "stream=codec_type",
        "-of", "json", cale,
    ])
    if cod != 0:
        raise EroareAutocut(f"ffprobe nu poate citi {cale}:\n{eroare.strip()}")

    date = json.loads(iesire)
    durata = float(date.get("format", {}).get("duration") or 0)
    tipuri = [s.get("codec_type") for s in date.get("streams", [])]
    if "video" not in tipuri:
        raise EroareAutocut(f"{cale} nu conține pistă video.")
    if durata <= 0:
        raise EroareAutocut(f"Nu pot afla durata pentru {cale}.")
    return durata, "audio" in tipuri


def gaseste_liniste(cale, prag, liniste_minima, durata):
    """Întoarce lista de intervale de liniște [(start, sfârșit), ...]."""
    cod, _, jurnal = ruleaza([
        "ffmpeg", "-hide_banner", "-nostats",
        "-i", cale,
        "-af", f"silencedetect=noise={prag}:d={liniste_minima}",
        "-f", "null", "-",
    ])
    if cod != 0:
        raise EroareAutocut(f"ffmpeg a eșuat la analiza audio:\n{jurnal.strip()[-2000:]}")

    intervale = []
    start = None
    for potrivire in re.finditer(
        r"silence_(start|end):\s*(-?\d+(?:\.\d+)?)", jurnal
    ):
        eticheta, valoare = potrivire.group(1), float(potrivire.group(2))
        if eticheta == "start":
            start = max(0.0, valoare)
        elif start is not None:
            intervale.append((start, min(valoare, durata)))
            start = None
    if start is not None:            # liniște care ține până la final
        intervale.append((start, durata))
    return [(a, b) for a, b in intervale if b > a]


def calculeaza_segmente(liniste, durata, margine, segment_minim):
    """Din intervalele de liniște scoate bucățile de păstrat."""
    pastrate = []
    cursor = 0.0
    for start, sfarsit in sorted(liniste):
        if start > cursor:
            pastrate.append([cursor, min(start, durata)])
        cursor = max(cursor, sfarsit)
    if cursor < durata:
        pastrate.append([cursor, durata])

    # Lărgim fiecare bucată cu marginea, ca să nu tăiem primul/ultimul cuvânt.
    for bucata in pastrate:
        bucata[0] = max(0.0, bucata[0] - margine)
        bucata[1] = min(durata, bucata[1] + margine)

    # Marginile pot suprapune bucăți vecine — le lipim.
    unite = []
    for bucata in pastrate:
        if unite and bucata[0] <= unite[-1][1]:
            unite[-1][1] = max(unite[-1][1], bucata[1])
        else:
            unite.append(bucata)

    return [(a, b) for a, b in unite if b - a >= segment_minim]


def scrie_filtru(segmente, cale_filtru, are_audio):
    """Scrie filter_complex într-un fișier (comanda ar fi prea lungă altfel)."""
    linii = []
    for indice, (start, sfarsit) in enumerate(segmente):
        linii.append(
            f"[0:v]trim=start={start:.3f}:end={sfarsit:.3f},"
            f"setpts=PTS-STARTPTS[v{indice}];"
        )
        if are_audio:
            linii.append(
                f"[0:a]atrim=start={start:.3f}:end={sfarsit:.3f},"
                f"asetpts=PTS-STARTPTS[a{indice}];"
            )

    if are_audio:
        intrari = "".join(f"[v{i}][a{i}]" for i in range(len(segmente)))
        linii.append(f"{intrari}concat=n={len(segmente)}:v=1:a=1[vout][aout]")
    else:
        intrari = "".join(f"[v{i}]" for i in range(len(segmente)))
        linii.append(f"{intrari}concat=n={len(segmente)}:v=1:a=0[vout]")

    with open(cale_filtru, "w", encoding="utf-8") as fisier:
        fisier.write("\n".join(linii))


def taie(intrare, iesire, segmente, are_audio, crf, preset):
    director = tempfile.mkdtemp(prefix="autocut-")
    cale_filtru = os.path.join(director, "filtru.txt")
    try:
        scrie_filtru(segmente, cale_filtru, are_audio)
        comanda = [
            "ffmpeg", "-hide_banner", "-y",
            "-i", intrare,
            "-filter_complex_script", cale_filtru,
            "-map", "[vout]",
        ]
        if are_audio:
            comanda += ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
        comanda += [
            "-c:v", "libx264", "-crf", str(crf), "-preset", preset,
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            iesire,
        ]
        cod, _, jurnal = ruleaza(comanda)
        if cod != 0:
            raise EroareAutocut(f"ffmpeg a eșuat la montaj:\n{jurnal.strip()[-2000:]}")
    finally:
        shutil.rmtree(director, ignore_errors=True)


def copiaza(intrare, iesire):
    cod, _, jurnal = ruleaza([
        "ffmpeg", "-hide_banner", "-y", "-i", intrare,
        "-c", "copy", "-movflags", "+faststart", iesire,
    ])
    if cod != 0:
        raise EroareAutocut(f"ffmpeg a eșuat la copiere:\n{jurnal.strip()[-2000:]}")


def format_timp(secunde):
    minute, secunde = divmod(secunde, 60)
    ore, minute = divmod(int(minute), 60)
    return f"{ore:d}:{minute:02d}:{secunde:06.3f}"


def normalizeaza_prag(valoare):
    """Acceptă -32dB, -32, 32dB sau 32 și întoarce mereu forma '-32dB'."""
    text = str(valoare).strip().lower()
    if text.endswith("db"):
        text = text[:-2].strip()
    try:
        numar = float(text)
    except ValueError:
        raise EroareAutocut(
            f"Prag audio nevalid: {valoare}. Scrie ceva de forma -32dB."
        )
    return f"{-abs(numar):g}dB"


def lipeste_valorile_negative(argv):
    """argparse crede că -32dB e o opțiune; lipim valoarea de --prag.

    Așa merge și `--prag -32dB`, nu doar `--prag=-32dB`.
    """
    rezultat = []
    indice = 0
    while indice < len(argv):
        argument = argv[indice]
        urmator = argv[indice + 1] if indice + 1 < len(argv) else None
        if (
            argument == "--prag"
            and urmator is not None
            and re.fullmatch(r"-\d+(?:\.\d+)?(?:dB)?", urmator, re.IGNORECASE)
        ):
            rezultat.append(f"--prag={urmator}")
            indice += 2
            continue
        rezultat.append(argument)
        indice += 1
    return rezultat


def argumente(argv=None):
    parser = argparse.ArgumentParser(
        description="Taie automat liniștea dintr-un video.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("intrare", help="fișierul video de intrare")
    parser.add_argument("iesire", help="fișierul video rezultat")
    parser.add_argument(
        "--prag", default=PRAG_IMPLICIT,
        help="sub ce nivel considerăm liniște (ex. -32dB, -40dB)",
    )
    parser.add_argument(
        "--liniste-minima", type=float, default=LINISTE_MINIMA,
        help="cât trebuie să țină liniștea (secunde) ca să merite tăiată",
    )
    parser.add_argument(
        "--margine", type=float, default=MARGINE,
        help="secunde păstrate în plus la capetele fiecărei bucăți",
    )
    parser.add_argument(
        "--segment-minim", type=float, default=SEGMENT_MINIM,
        help="bucățile mai scurte de atât (secunde) se aruncă",
    )
    parser.add_argument("--crf", type=int, default=20, help="calitate x264 (mai mic = mai bun)")
    parser.add_argument("--preset", default="medium", help="preset x264")
    parser.add_argument(
        "--lista", action="store_true",
        help="arată doar bucățile păstrate, fără să scrie fișierul",
    )
    if argv is None:
        argv = sys.argv[1:]
    return parser.parse_args(lipeste_valorile_negative(list(argv)))


def main(argv=None):
    optiuni = argumente(argv)

    try:
        verifica_unelte()
        optiuni.prag = normalizeaza_prag(optiuni.prag)
        if not os.path.isfile(optiuni.intrare):
            raise EroareAutocut(f"Nu găsesc fișierul de intrare: {optiuni.intrare}")
        if not optiuni.lista and os.path.abspath(optiuni.intrare) == os.path.abspath(optiuni.iesire):
            raise EroareAutocut("Fișierul de ieșire nu poate fi același cu cel de intrare.")

        durata, are_audio = descrie_fisier(optiuni.intrare)
        print(f"Intrare : {optiuni.intrare}  ({format_timp(durata)})")

        if not are_audio:
            raise EroareAutocut(
                "Fișierul nu are pistă audio, deci nu am după ce să tai liniștea."
            )

        print(f"Analizez audio (prag {optiuni.prag}, liniște ≥ {optiuni.liniste_minima}s)...")
        liniste = gaseste_liniste(
            optiuni.intrare, optiuni.prag, optiuni.liniste_minima, durata
        )
        segmente = calculeaza_segmente(
            liniste, durata, optiuni.margine, optiuni.segment_minim
        )

        if not segmente:
            raise EroareAutocut(
                "Tot materialul intră la liniște. Încearcă un prag mai jos, ex. --prag -45dB."
            )

        pastrat = sum(b - a for a, b in segmente)
        print(f"Bucăți păstrate: {len(segmente)}")
        print(
            f"Durată: {format_timp(durata)} -> {format_timp(pastrat)} "
            f"(tăiat {format_timp(durata - pastrat)}, {100 * (1 - pastrat / durata):.1f}%)"
        )

        if optiuni.lista:
            for indice, (start, sfarsit) in enumerate(segmente, 1):
                print(f"  {indice:3d}. {format_timp(start)} -> {format_timp(sfarsit)}")
            return 0

        if len(segmente) == 1 and segmente[0][0] <= 0.001 and segmente[0][1] >= durata - 0.001:
            print("Nu e nimic de tăiat, copiez fișierul ca atare.")
            copiaza(optiuni.intrare, optiuni.iesire)
        else:
            print("Montez...")
            taie(
                optiuni.intrare, optiuni.iesire, segmente,
                are_audio, optiuni.crf, optiuni.preset,
            )

        print(f"Gata: {optiuni.iesire}")
        return 0

    except EroareAutocut as eroare:
        print(f"Eroare: {eroare}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nÎntrerupt.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
