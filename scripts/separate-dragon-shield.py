"""Separate the Suwanee Gamers logo into two complete, independent layers.

The source logo is a flattened illustration where an orange dragon sits *in
front* of a heraldic crest (shield). This script reconstructs both objects as
whole subjects:

  * shield-complete.png  - the crest with the dragon removed and every hidden
    part of the shield rebuilt (stepped top edge behind the head/claws/wings and
    the bottom point behind the tail). No dragon, no holes, no ink remnants.
  * dragon-complete.png  - the dragon on a transparent background, one continuous
    subject (the dragon is already fully in front in the source, so this is a
    clean color extraction).

Reconstruction strategy for the shield:
  1. Build a robust dragon mask (warm fill + its dark ink outline, dilated) so
     removing the dragon leaves no colored fill or line-art behind.
  2. Mirror-fill: the crest is bilaterally symmetric, so every shield pixel the
     dragon covered is restored from its clean mirror counterpart. Occlusion is
     asymmetric (tail lower-left, head centre-right) so this recovers most of it.
  3. A tight, symmetric geometric silhouette (S_geo) gates a Telea inpaint that
     fills the few pixels hidden on *both* sides (dead-centre top, point tip).
  4. The stepped top rim and bottom point rim are redrawn as clean vector strokes
     (dark rim + gray under-shadow) matching the crest's own edge treatment.

All colours/proportions are sampled from the source; nothing is redesigned.
Deterministic - regenerate any time from the checked-in source PNG.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps/web/public/images/suwaneegamers-logo-v18-4800p.png"
OUT = ROOT / "apps/web/public/images/logo-animation"

# Sampled palette (RGB).
RIM = (60, 35, 21)          # shield outer ink outline
UNDERSHADOW = (114, 101, 88)  # gray bevel band just inside the top rim
CREAM = (201, 187, 164)     # shield face fill

CX = 2340  # shield vertical axis of symmetry (full-res source pixels)

# Right-half silhouette anchors, bottom point -> up right side -> across top to
# centre. Measured from the un-occluded parts of the crest; the left half is a
# mirror of these so the rebuilt shape is perfectly symmetric.
RIGHT_HALF = [
    (2340, 4238),  # bottom point
    (2680, 3915),
    (2973, 3760),  # clean lower-right edge (measured)
    (3210, 3080),
    (3405, 2480),
    (3490, 2050),  # right shoulder (widest)
    (3421, 2000),
    (3300, 1900),
    (3249, 1800),
    (3208, 1700),
    (3173, 1600),
    (3180, 1505),  # right shoulder-tab, top-right corner
    (2600, 1505),  # right shoulder-tab, top-left corner
    (2600, 1600),  # step down to central top
    (2340, 1600),  # top centre
]


def fill_holes(mask: np.ndarray) -> np.ndarray:
    ff = mask.copy()
    h, w = mask.shape
    m = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, m, (0, 0), 255)
    return mask | cv2.bitwise_not(ff)


def outline_polygon() -> np.ndarray:
    """Full closed shield outline (clockwise), right half + mirrored left half."""
    right = RIGHT_HALF
    left = [(2 * CX - x, y) for x, y in reversed(right[:-1])]  # exclude centre dup
    return np.array(right + left, dtype=np.int32)


def top_edge_polyline() -> np.ndarray:
    """Just the top edge (tab -> step -> centre -> step -> tab), for rim redraw."""
    # right shoulder-tab corner down to top-centre, then mirror to the left tab.
    right_top = [
        (3180, 1505), (2600, 1505), (2600, 1600), (2340, 1600),
    ]
    left_top = [(2 * CX - x, y) for x, y in reversed(right_top[:-1])]
    # extend down each shoulder a little so the rim ties into the real side edges
    full = [(3173, 1600), (3180, 1505)] + right_top[1:] + left_top + [(1500, 1505), (1507, 1600)]
    return np.array(full, dtype=np.int32)


def build_dragon_mask(src: np.ndarray) -> np.ndarray:
    h, w = src.shape[:2]
    r, g, b, a = [src[:, :, i].astype(int) for i in range(4)]
    hsv = cv2.cvtColor(src[:, :, :3], cv2.COLOR_RGB2HSV)
    hue, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    warm = ((sat > 90) & (val > 110) & ((hue < 42) | (hue > 163)) & (a > 140)).astype(np.uint8) * 255
    warm[3140:3720, :] = 0  # the red ribbon shares the dragon's hue - exclude its band
    hull = cv2.morphologyEx(warm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35)))
    hull = fill_holes(hull)
    dragon = cv2.dilate(hull, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))) > 0
    near = cv2.dilate(hull, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (45, 45))) > 0
    dark_ink = (r < 105) & (g < 80) & (b < 66) & (a > 120)
    dragon = dragon | (dark_ink & near)
    dragon[3140:3720, :] = False
    return dragon


def reflect(arr: np.ndarray) -> np.ndarray:
    flipped = arr[:, ::-1] if arr.ndim == 2 else arr[:, ::-1, :]
    return np.roll(flipped, 2 * CX - (arr.shape[1] - 1), axis=1)


def build_shield(src: np.ndarray, dragon: np.ndarray) -> np.ndarray:
    h, w = src.shape[:2]

    # provisional shield mask (real cream/die face) to gate the mirror so we never
    # import dragon pixels that sit over transparent background (wings/body arc).
    r, g, b, a = [src[:, :, i].astype(int) for i in range(4)]
    hsv = cv2.cvtColor(src[:, :, :3], cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1]
    cream = (a > 140) & (sat < 70) & (r > 150) & (g > 135) & (b > 110)
    die = (a > 140) & (np.abs(r - 114) < 45) & (np.abs(g - 101) < 45) & (np.abs(b - 88) < 45)
    prov = ((cream | die).astype(np.uint8)) * 255
    prov = cv2.morphologyEx(prov, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    prov = fill_holes(prov)
    n, lab, st, _ = cv2.connectedComponentsWithStats(prov, 8)
    prov = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    gate = cv2.dilate(prov.astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))) > 0

    final = src.copy()
    final[dragon] = 0

    mir, mir_dragon = reflect(src), reflect(dragon)
    fillable = dragon & gate & (~mir_dragon) & (mir[:, :, 3] > 140)
    final[fillable] = mir[fillable]

    # tight geometric silhouette
    s_geo = np.zeros((h, w), np.uint8)
    cv2.fillPoly(s_geo, [outline_polygon()], 255)
    s_geo = s_geo > 0

    recon = cv2.dilate(dragon.astype(np.uint8) * 255,
                       cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) > 0

    # Build a pure "cream plate": inpaint the shield face from the *real cream
    # only*, so dark ink (rim/letters/die) never bleeds into the fill. We then use
    # it to fill every remaining hole in the shield face with clean cream that
    # follows the crest's own subtle gradient.
    fr, fg, fb, fa = [final[:, :, i].astype(int) for i in range(4)]
    fsat = cv2.cvtColor(final[:, :, :3], cv2.COLOR_RGB2HSV)[:, :, 1]
    real_cream = (fa > 140) & (fsat < 70) & (fr > 150) & (fg > 135) & (fb > 110)
    cream_inpaint_mask = (s_geo & ~real_cream).astype(np.uint8) * 255
    cream_plate = cv2.inpaint(cv2.cvtColor(final[:, :, :3], cv2.COLOR_RGB2BGR),
                              cream_inpaint_mask, 5, cv2.INPAINT_TELEA)
    cream_plate = cv2.cvtColor(cream_plate, cv2.COLOR_BGR2RGB)

    holes = (final[:, :, 3] <= 140) & s_geo
    final[holes, :3] = cream_plate[holes]
    final[holes, 3] = 255

    # In the reconstructed zone the crest carries no real detail except at the
    # centre (text/die/ribbon). In the detail-free top and bottom-point bands, wipe
    # every non-cream pixel (residual dragon ink the mask missed) back to clean
    # cream; the rim is repainted afterwards.
    yy = np.arange(h)[:, None]
    detail_free = (yy < 1900) | (yy > 4000)
    wipe = s_geo & detail_free & ~real_cream
    final[wipe, :3] = cream_plate[wipe]
    final[wipe, 3] = 255

    # Redraw the crest edge treatment (gray under-shadow band, then dark rim) but
    # only inside the reconstructed zone, so real edges elsewhere are untouched.
    draw_zone = recon | detail_free  # top/bottom bands always redraw; sides only where occluded
    top = top_edge_polyline()
    shadow = np.zeros((h, w), np.uint8)
    cv2.polylines(shadow, [top], False, 255, 130)
    shadow_mask = (shadow > 0) & draw_zone & s_geo
    final[shadow_mask] = (*UNDERSHADOW, 255)

    rim = np.zeros((h, w), np.uint8)
    cv2.polylines(rim, [outline_polygon()], True, 255, 26)
    cv2.polylines(rim, [top], False, 255, 28)
    rim_mask = (rim > 0) & draw_zone
    final[rim_mask] = (*RIM, 255)

    # Final safety net: in the detail-free bands the crest is either cream, the
    # redrawn rim, or the gray under-shadow. Any dark pixel left (dragon ink the
    # cream plate could not reach) is forced to flat cream.
    leftover = (final[:, :, :3].max(2) < 150)
    stray = detail_free & s_geo & leftover & ~rim_mask & ~shadow_mask
    final[stray] = (*CREAM, 255)

    # Clip anything outside the outline within the reconstructed zone (kills the
    # dragon-over-background area) while keeping real text/ribbon that extend past
    # the shield sides. In the detail-free top/bottom bands there is no legitimate
    # content outside the silhouette, so clip those unconditionally.
    final[(~s_geo) & recon] = 0
    final[(~s_geo) & detail_free] = 0

    # Remove stray floating ink specks: keep only the main connected crest.
    opaque = (final[:, :, 3] > 140).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(opaque, 8)
    if n > 1:
        keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        final[(lab != keep) & (final[:, :, 3] > 0)] = 0

    a2 = final[:, :, 3]
    final[(a2 > 0) & (a2 < 200)] = 0
    return final


def build_dragon(src: np.ndarray, dragon_hull: np.ndarray) -> np.ndarray:
    """Dragon on transparent bg. The dragon is fully in front in the source, so we
    keep exactly the dragon pixels (warm + ink) and leave the neck-arch gap open."""
    out = np.zeros_like(src)
    out[dragon_hull] = src[dragon_hull]
    out[dragon_hull, 3] = 255
    # feather the alpha edge by 1px to avoid a hard jaggy cut
    a = (dragon_hull.astype(np.uint8)) * 255
    a = cv2.GaussianBlur(a, (0, 0), 1.0)
    out[:, :, 3] = np.minimum(out[:, :, 3], a)
    out[out[:, :, 3] == 0, :3] = 0
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = np.asarray(Image.open(SOURCE).convert("RGBA")).copy()

    dragon = build_dragon_mask(src)

    shield = build_shield(src, dragon)
    Image.fromarray(shield).save(OUT / "shield-complete.png", optimize=True)

    # dragon extraction uses the tight hull (not the extra-dilated removal mask)
    r, g, b, a = [src[:, :, i].astype(int) for i in range(4)]
    hsv = cv2.cvtColor(src[:, :, :3], cv2.COLOR_RGB2HSV)
    hue, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    warm = ((sat > 90) & (val > 110) & ((hue < 42) | (hue > 163)) & (a > 140)).astype(np.uint8) * 255
    warm[3140:3720, :] = 0
    hull = fill_holes(cv2.morphologyEx(warm, cv2.MORPH_CLOSE,
                                       cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))))
    dark_ink = ((r < 105) & (g < 80) & (b < 66) & (a > 120)).astype(np.uint8) * 255
    near = cv2.dilate(hull, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (33, 33)))
    hull_full = (hull > 0) | ((dark_ink > 0) & (near > 0))
    hull_full = cv2.morphologyEx(hull_full.astype(np.uint8) * 255, cv2.MORPH_CLOSE,
                                 cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
    dragon_layer = build_dragon(src, hull_full)
    Image.fromarray(dragon_layer).save(OUT / "dragon-complete.png", optimize=True)

    print(f"Wrote shield-complete.png and dragon-complete.png to {OUT}")
    print(f"Source {src.shape[1]}x{src.shape[0]}")


if __name__ == "__main__":
    main()
