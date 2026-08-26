#!/usr/bin/env python3
"""Generate a GitHub social preview banner (1280x640) for the Family Tree project."""
import struct, zlib, math, os

OUT = "/home/z/my-project/download/screenshots/social-preview.png"
W, H = 1280, 640

def make_png(pixels, w, h):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw.extend(pixels[y*w*4:(y+1)*w*4])
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

# Build background: dark slate gradient with subtle dot grid
pixels = bytearray(W * H * 4)
for y in range(H):
    for x in range(W):
        # Diagonal gradient from #1e1b4b (indigo-950) to #4c1d95 (purple-900) to #831843 (pink-900)
        t = (x / W + y / H) / 2
        if t < 0.5:
            s = t * 2
            r = int(30 + (76 - 30) * s)
            g = int(27 + (29 - 27) * s)
            b = int(75 + (149 - 75) * s)
        else:
            s = (t - 0.5) * 2
            r = int(76 + (131 - 76) * s)
            g = int(29 + (24 - 29) * s)
            b = int(149 + (67 - 149) * s)
        i = (y * W + x) * 4
        # Dot grid overlay
        if x % 32 == 0 and y % 32 == 0:
            r = min(255, r + 30); g = min(255, g + 30); b = min(255, b + 30)
        pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = 255

# Draw the FT logo (rounded square with gradient + tree silhouette) at left
logo_cx, logo_cy = 180, 320
logo_size = 140
for y in range(H):
    for x in range(W):
        dx, dy = x - logo_cx, y - logo_cy
        # Rounded square (corners cut)
        in_square = abs(dx) < logo_size/2 and abs(dy) < logo_size/2
        if in_square:
            # Cut corners
            corner_r = 28
            ax = abs(dx) - (logo_size/2 - corner_r)
            ay = abs(dy) - (logo_size/2 - corner_r)
            if ax > 0 and ay > 0 and (ax*ax + ay*ay) > corner_r*corner_r:
                continue
            i = (y * W + x) * 4
            # Logo gradient: purple→pink→amber
            t = (dx + dy + logo_size) / (2 * logo_size)
            if t < 0.5:
                s = t * 2
                r = int(139 + (236 - 139) * s); g = int(92 + (72 - 92) * s); b = int(246 + (153 - 246) * s)
            else:
                s = (t - 0.5) * 2
                r = int(236 + (245 - 236) * s); g = int(72 + (158 - 72) * s); b = int(153 + (11 - 153) * s)
            pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = 255

# Draw tree silhouette in white at logo center
tree_cx, tree_cy = logo_cx, logo_cy + 10
canopy_r = 35
trunk_w = 14
trunk_h = 35
trunk_top = tree_cy + canopy_r * 0.5
for y in range(H):
    for x in range(W):
        dx, dy = x - tree_cx, y - tree_cy + 10
        dist = math.sqrt(dx*dx + dy*dy)
        i = (y * W + x) * 4
        if dist <= canopy_r:
            pixels[i] = 255; pixels[i+1] = 255; pixels[i+2] = 255; pixels[i+3] = 255
        elif trunk_top <= y <= trunk_top + trunk_h and abs(x - tree_cx) <= trunk_w / 2:
            pixels[i] = 255; pixels[i+1] = 255; pixels[i+2] = 255; pixels[i+3] = 255

# Add text "Family Tree" (approximate by drawing block letters as rectangles)
# This is a simplified approach — for a real text rendering we'd need a font lib.
# Instead, we'll leave the text to the README.md that displays the image.

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "wb") as f:
    f.write(make_png(pixels, W, H))
print(f"Generated: {OUT} ({os.path.getsize(OUT)} bytes)")
