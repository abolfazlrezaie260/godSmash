# Moon surface assets — NASA LRO

The game displays *real lunar mapping data* rather than procedural cartoon
circles on the Moon. Both binary assets are committed to this directory by
`scripts/vendor_nasa_moon.py` and
`.github/workflows/vendor-nasa-moon.yml`.

| Asset | Resolution | Original NASA source | Processing |
| --- | --- | --- | --- |
| `moon_4096.jpg` | 4096×2048 | `lroc_color_16bit_srgb_4k.tif` | 2025 global LROC WAC natural-color map, converted from 16-bit TIFF to JPEG |
| `moon_height_1024.jpg` | 1024×512 | `ldem_3_8bit.jpg` | LRO Lunar Orbiter Laser Altimeter (LOLA) grayscale elevation preview, recompressed |

**Source:** [NASA Scientific Visualization Studio — CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/). Credit: NASA's Scientific Visualization Studio / Ernie Wright, LROC camera and LOLA instrument teams. Source imagery is NASA open imagery; no fictional craters are baked into these source photos.

The high-resolution image is the 2025 **original NASA 4K raster**, not an upscale
of a lower-resolution web preview. The game loads the local assets from GitHub
Pages first, keeps the painting canvas writable for persistent crater marks,
and includes optional remote and procedural fallbacks for deployments without
these assets. The Moon is rendered matte and airless; the height preview
provides a subtle Three.js bump map.

To reproduce offline assets: `python -m pip install Pillow==11.3.0` then run
`python scripts/vendor_nasa_moon.py`. The vendor workflow can also be
dispatched manually from the GitHub Actions page.
