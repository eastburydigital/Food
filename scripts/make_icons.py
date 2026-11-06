"""Draw the app icon: a cream bowl with a green sprout, on sage green."""
from PIL import Image, ImageDraw

def leaf(S, cx, cy, w, h, angle, color):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([S/2 - w/2, S/2 - h/2, S/2 + w/2, S/2 + h/2], fill=color)
    layer = layer.rotate(angle, resample=Image.BICUBIC)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(layer, (int(cx - S/2), int(cy - S/2)), layer)
    return out

def icon(size, scale, path, rounded):
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    bg, cream, green = (79, 122, 90, 255), (246, 241, 233, 255), (196, 225, 186, 255)
    if rounded: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=bg)
    else: d.rectangle([0, 0, S, S], fill=bg)
    u = S * scale; c = S / 2
    # stem
    d.line([(c, c + u*0.05), (c, c - u*0.30)], fill=green, width=int(u*0.07))
    im.alpha_composite(leaf(S, c + u*0.20, c - u*0.38, u*0.42, u*0.20, 30, green))
    im.alpha_composite(leaf(S, c - u*0.18, c - u*0.24, u*0.36, u*0.17, -30, green))
    d = ImageDraw.Draw(im)
    # bowl rim + body + foot
    d.rounded_rectangle([c - u*0.62, c + u*0.02, c + u*0.62, c + u*0.10], radius=int(u*0.04), fill=cream)
    d.chord([c - u*0.56, c - u*0.40, c + u*0.56, c + u*0.58], 0, 180, fill=cream)
    d.rounded_rectangle([c - u*0.20, c + u*0.52, c + u*0.20, c + u*0.62], radius=int(u*0.04), fill=cream)
    im = im.resize((size, size), Image.LANCZOS)
    if not rounded: im = im.convert("RGB")
    im.save(path)

icon(192, 0.62, "public/icons/icon-192.png", True)
icon(512, 0.62, "public/icons/icon-512.png", True)
icon(512, 0.48, "public/icons/icon-maskable-512.png", False)
icon(180, 0.66, "public/icons/apple-touch-icon.png", False)
