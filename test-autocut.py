#!/usr/bin/env python3
"""Teste pentru autocut.py: python3 test-autocut.py"""

import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import autocut

TRECUTE = 0
PICATE = 0


def verifica(nume, obtinut, asteptat):
    global TRECUTE, PICATE
    if obtinut == asteptat:
        TRECUTE += 1
        print(f"  ok   {nume}")
    else:
        PICATE += 1
        print(f"  PICAT {nume}\n        obtinut : {obtinut}\n        asteptat: {asteptat}")


def rotunjeste(segmente):
    return [(round(a, 3), round(b, 3)) for a, b in segmente]


def test_segmente():
    print("calculeaza_segmente")

    verifica(
        "fără liniște păstrează tot",
        rotunjeste(autocut.calculeaza_segmente([], 10.0, 0.0, 0.4)),
        [(0.0, 10.0)],
    )

    verifica(
        "o liniște la mijloc taie în două",
        rotunjeste(autocut.calculeaza_segmente([(4.0, 6.0)], 10.0, 0.0, 0.4)),
        [(0.0, 4.0), (6.0, 10.0)],
    )

    verifica(
        "marginea lărgește bucățile fără să iasă din film",
        rotunjeste(autocut.calculeaza_segmente([(4.0, 6.0)], 10.0, 0.5, 0.4)),
        [(0.0, 4.5), (5.5, 10.0)],
    )

    verifica(
        "liniște de la început",
        rotunjeste(autocut.calculeaza_segmente([(0.0, 3.0)], 10.0, 0.0, 0.4)),
        [(3.0, 10.0)],
    )

    verifica(
        "liniște până la final",
        rotunjeste(autocut.calculeaza_segmente([(7.0, 10.0)], 10.0, 0.0, 0.4)),
        [(0.0, 7.0)],
    )

    verifica(
        "bucata prea scurtă se aruncă",
        rotunjeste(autocut.calculeaza_segmente([(0.0, 5.0), (5.2, 10.0)], 10.0, 0.0, 0.4)),
        [],
    )

    verifica(
        "marginea mare lipește bucățile vecine",
        rotunjeste(autocut.calculeaza_segmente([(4.0, 5.0)], 10.0, 1.0, 0.4)),
        [(0.0, 10.0)],
    )

    verifica(
        "linistea totală nu lasă nimic",
        rotunjeste(autocut.calculeaza_segmente([(0.0, 10.0)], 10.0, 0.0, 0.4)),
        [],
    )

    verifica(
        "intervale suprapuse nu dublează bucățile",
        rotunjeste(autocut.calculeaza_segmente([(2.0, 5.0), (3.0, 4.0)], 10.0, 0.0, 0.4)),
        [(0.0, 2.0), (5.0, 10.0)],
    )


def test_format_timp():
    print("format_timp")
    verifica("secunde", autocut.format_timp(6.6), "0:00:06.600")
    verifica("minute", autocut.format_timp(125.5), "0:02:05.500")
    verifica("ore", autocut.format_timp(3725.0), "1:02:05.000")


def test_prag():
    print("pragul audio")
    verifica("forma completă", autocut.normalizeaza_prag("-32dB"), "-32dB")
    verifica("fără unitate", autocut.normalizeaza_prag("-32"), "-32dB")
    verifica("fără semn", autocut.normalizeaza_prag("32dB"), "-32dB")
    verifica("cu zecimale", autocut.normalizeaza_prag("-28.5"), "-28.5dB")
    verifica("db cu literă mică", autocut.normalizeaza_prag("-40db"), "-40dB")

    try:
        autocut.normalizeaza_prag("tare")
        verifica("prag aiurea dă eroare", "fără eroare", "EroareAutocut")
    except autocut.EroareAutocut:
        verifica("prag aiurea dă eroare", "EroareAutocut", "EroareAutocut")

    # argparse ar lua -40dB drept opțiune dacă nu l-am lipi de --prag.
    verifica(
        "--prag -40dB e citit ca valoare",
        autocut.argumente(["a.mp4", "b.mp4", "--prag", "-40dB"]).prag,
        "-40dB",
    )
    verifica(
        "--prag=-40dB merge la fel",
        autocut.argumente(["a.mp4", "b.mp4", "--prag=-40dB"]).prag,
        "-40dB",
    )
    verifica(
        "--prag -25 fără unitate e citit ca valoare",
        autocut.argumente(["a.mp4", "b.mp4", "--prag", "-25"]).prag,
        "-25",
    )
    verifica(
        "fișierele rămân pe poziții",
        [autocut.argumente(["a.mp4", "b.mp4", "--prag", "-40dB"]).intrare,
         autocut.argumente(["a.mp4", "b.mp4", "--prag", "-40dB"]).iesire],
        ["a.mp4", "b.mp4"],
    )


def test_capat_la_capat():
    print("cap la cap (ffmpeg)")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("  sarit  ffmpeg/ffprobe lipsesc")
        return

    director = tempfile.mkdtemp(prefix="test-autocut-")
    try:
        intrare = os.path.join(director, "intrare.mp4")
        iesire = os.path.join(director, "iesire.mp4")
        sunet = (
            "aevalsrc=exprs='0.5*sin(1000*2*PI*t)"
            "*(between(t\\,0\\,2)+between(t\\,5\\,7)+between(t\\,10\\,12))':d=12:s=48000"
        )
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=12",
                "-f", "lavfi", "-i", sunet,
                "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-shortest", intrare,
            ],
            check=True,
        )

        cod = autocut.main([intrare, iesire])
        verifica("scriptul se termină cu succes", cod, 0)
        verifica("fișierul de ieșire există", os.path.isfile(iesire), True)

        durata = float(subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", iesire],
            capture_output=True, text=True, check=True,
        ).stdout.strip())
        # 3 bucăți de 2s + margine de 0,15s la capete disponibile ≈ 6,6s
        verifica("durata rezultatului e în jur de 6,6s", abs(durata - 6.6) < 0.5, True)
    finally:
        shutil.rmtree(director, ignore_errors=True)


def main():
    test_segmente()
    test_format_timp()
    test_prag()
    test_capat_la_capat()
    print(f"\n{TRECUTE} trecute, {PICATE} picate")
    return 1 if PICATE else 0


if __name__ == "__main__":
    sys.exit(main())
