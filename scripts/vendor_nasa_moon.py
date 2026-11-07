#!/usr/bin/env python3
"""Vendor NASA Lunar Reconnaissance Orbiter maps for offline GodSmash.

Primary color: 2025 LROC WAC 16-bit sRGB 4K global color map.
Relief: NASA LRO LOLA 8-bit 1024x512 global elevation preview.
NASA SVS CGI Moon Kit: https://svs.gsfc.nasa.gov/4720/

Requires Pillow. This runs in CI; players do not download 59 MB TIFF files.
"""
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

BASE = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/"
DEST = Path("assets/textures/moon")


def source_bytes(filename: str) -> bytes:
    request = Request(BASE + filename, headers={"User-Agent": "GodSmash lunar texture vendor"})
    with urlopen(request, timeout=120) as response:
        return response.read()


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    source = source_bytes("lroc_color_16bit_srgb_4k.tif")
    with Image.open(BytesIO(source)) as lunar:
        if lunar.size != (4096, 2048):
            raise RuntimeError(f"NASA lunar color dimensions changed: {lunar.size}")
        image = ImageOps.exif_transpose(lunar).convert("RGB")
        image.save(
            DEST / "moon_4096.jpg", "JPEG", quality=89,
            subsampling=0, optimize=True, progressive=True,
        )

    elevation = source_bytes("ldem_3_8bit.jpg")
    with Image.open(BytesIO(elevation)) as lunar:
        if lunar.size != (1024, 512):
            raise RuntimeError(f"NASA lunar height dimensions changed: {lunar.size}")
        lunar.convert("L").save(
            DEST / "moon_height_1024.jpg", "JPEG",
            quality=93, optimize=True, progressive=True
        )

    for file in sorted(DEST.glob("*.jpg")):
        print(f"{file}: {file.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
