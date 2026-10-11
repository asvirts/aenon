# Stylized ground sources

Six CC0 texture sets by Katsukagi from 3dtextures.me supply the ground colour and normal maps. Each subdirectory retains unmodified 1K source images and source.json with official page, public download folder, file ID, download URL, date, bytes and SHA-256. License.txt records the official CC0 declaration and complete terms.

The shader uses grass twice: lush green near water and warm golden grass on drier land. Dirt, settlement stones, sand, mud and slope rock make seven blended colour zones from six source sets. It derives masks from existing road/village geometry, water distance, surface slope and noise; there are no authored splat maps or geography changes.

Run `KTX_BIN=/path/to/ktx/bin python3 scripts/art/prepare-ground-textures.py` to rebuild all 12 shipped maps. Colour uses ETC1S in sRGB; normals use UASTC + Zstd with normalized XYZ in RGB, not the alternative XY swizzle. Conversion.json records exact output bytes and hashes. Every shipped file has one manifest entry.
