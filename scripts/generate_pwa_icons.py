#!/usr/bin/env python3
"""Generate PWA icons (192, 512, maskable 512) for the Family Tree app."""
import struct
import zlib
import os
import math

OUT_DIR = "/home/z/my-project/public"

def make_png(pixels, width, height):
    """Build a PNG from RGBA pixel data."""
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    # PNG signature
    sig = b"\x89PNG\r\n\x1a\n"
    # IHDR: width, height, bit depth 8, color type 6 (RGBA)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    # Raw pixel data with filter byte (0) per row
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * width * 4:(y + 1) * width * 4])
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

def draw_gradient_circle(width, height, maskable=False):
    """Draw a purple→pink→amber gradient circle on transparent/white background."""
    pixels = bytearray(width * height * 4)
    cx, cy = width / 2, height / 2
    # For maskable, the safe zone is the central 80% — scale the circle down
    radius = (width * 0.42) if maskable else (width * 0.46)
    for y in range(height):
        for x in range(width):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            i = (y * width + x) * 4
            if dist <= radius:
                # Radial gradient: center=purple, edge=amber
                t = dist / radius
                # Three-stop gradient: purple (#8b5cf6) → pink (#ec4899) → amber (#f59e0b)
                if t < 0.5:
                    s = t * 2
                    r = int(139 + (236 - 139) * s)
                    g = int(92 + (72 - 92) * s)
                    b = int(246 + (153 - 246) * s)
                else:
                    s = (t - 0.5) * 2
                    r = int(236 + (245 - 236) * s)
                    g = int(72 + (158 - 72) * s)
                    b = int(153 + (11 - 153) * s)
                pixels[i] = r
                pixels[i + 1] = g
                pixels[i + 2] = b
                pixels[i + 3] = 255
            elif maskable:
                # Maskable: fill background with theme color so it looks good cropped
                pixels[i] = 139
                pixels[i + 1] = 92
                pixels[i + 2] = 246
                pixels[i + 3] = 255
            # else: leave transparent
    return pixels

# Add a simple "tree" silhouette in white at the center
def add_tree_overlay(pixels, width, height):
    """Draw a simple tree silhouette (trunk + canopy) in white at the center."""
    cx, cy = width / 2, height / 2
    # Canopy: filled circle
    canopy_r = width * 0.18
    # Trunk: rectangle below canopy
    trunk_w = width * 0.06
    trunk_h = height * 0.16
    trunk_top = cy + canopy_r * 0.3
    for y in range(height):
        for x in range(width):
            dx, dy = x - cx, y - cy + canopy_r * 0.4
            dist = math.sqrt(dx * dx + dy * dy)
            i = (y * width + x) * 4
            # Canopy (circle)
            if dist <= canopy_r:
                pixels[i] = 255
                pixels[i + 1] = 255
                pixels[i + 2] = 255
                pixels[i + 3] = 255
            # Trunk (rectangle)
            elif (trunk_top <= y <= trunk_top + trunk_h) and (abs(x - cx) <= trunk_w / 2):
                pixels[i] = 255
                pixels[i + 1] = 255
                pixels[i + 2] = 255
                pixels[i + 3] = 255

os.makedirs(OUT_DIR, exist_ok=True)

# 192
p = draw_gradient_circle(192, 192)
add_tree_overlay(p, 192, 192)
with open(f"{OUT_DIR}/icon-192.png", "wb") as f:
    f.write(make_png(p, 192, 192))

# 512
p = draw_gradient_circle(512, 512)
add_tree_overlay(p, 512, 512)
with open(f"{OUT_DIR}/icon-512.png", "wb") as f:
    f.write(make_png(p, 512, 512))

# Maskable 512
p = draw_gradient_circle(512, 512, maskable=True)
add_tree_overlay(p, 512, 512)
with open(f"{OUT_DIR}/icon-maskable-512.png", "wb") as f:
    f.write(make_png(p, 512, 512))

print("Generated: icon-192.png, icon-512.png, icon-maskable-512.png")
