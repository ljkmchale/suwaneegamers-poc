"""Create the two complete raster layers used by the logo animation study.

Outputs:
  - shield-complete.png: the untouched crest artwork with the dragon removed
    and the shield surface reconstructed beneath it.
  - dragon-complete.png: the original visible dragon artwork plus reconstructed
    concealed anatomy, on a transparent background.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps/web/media/images/suwaneegamers-logo-v18-4800p.png"
OUTPUT = ROOT / "apps/web/media/images/logo-animation"
GENERATED_DRAGON = OUTPUT / "dragon-complete.png"
HEIGHT = 1800


def polygon_mask(width: int, height: int, points: list[tuple[float, float]]) -> np.ndarray:
    result = np.zeros((height, width), dtype=np.uint8)
    points_px = np.array(
        [[(round(x * width), round(y * height)) for x, y in points]],
        dtype=np.int32,
    )
    cv2.fillPoly(result, points_px, 255)
    return result


def warm_dragon_masks(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    height, width = rgba.shape[:2]
    rgb = rgba[:, :, :3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, saturation, value = cv2.split(hsv)

    warm = (
        (saturation > 138)
        & (value > 112)
        & ((hue < 36) | (hue > 170))
        & (rgba[:, :, 3] > 160)
    ).astype(np.uint8) * 255
    dark = (
        (rgb[:, :, 0] < 105)
        & (rgb[:, :, 1] < 76)
        & (rgb[:, :, 2] < 58)
        & (rgba[:, :, 3] > 150)
    ).astype(np.uint8) * 255
    yellow = (
        (rgb[:, :, 0] > 170)
        & (rgb[:, :, 1] > 120)
        & (rgb[:, :, 2] < 105)
        & (rgba[:, :, 3] > 150)
    ).astype(np.uint8) * 255

    dragon_regions = [
        # Left wing, shoulder, and claws.
        [
            (0.12, 0.00), (0.29, 0.00), (0.38, 0.08), (0.41, 0.25),
            (0.39, 0.38), (0.34, 0.42), (0.19, 0.42), (0.13, 0.31),
        ],
        # Right wing, shoulder, and claws.
        [
            (0.88, 0.00), (0.71, 0.00), (0.62, 0.08), (0.59, 0.25),
            (0.61, 0.38), (0.66, 0.43), (0.81, 0.43), (0.87, 0.31),
        ],
        # Back, neck, head, and visible central body.
        [
            (0.27, 0.16), (0.68, 0.16), (0.71, 0.27), (0.67, 0.45),
            (0.45, 0.45), (0.41, 0.36), (0.42, 0.31), (0.29, 0.31),
        ],
        # Tail below the crest.
        [
            (0.32, 0.76), (0.48, 0.76), (0.58, 0.81), (0.63, 0.87),
            (0.58, 0.93), (0.50, 0.93), (0.48, 1.00), (0.39, 1.00),
            (0.39, 0.95), (0.44, 0.90), (0.49, 0.88), (0.35, 0.87),
            (0.30, 0.83),
        ],
    ]

    region = np.zeros((height, width), dtype=np.uint8)
    for points in dragon_regions:
        region = cv2.bitwise_or(region, polygon_mask(width, height, points))

    colored = cv2.bitwise_and(warm, region)
    near_color = cv2.dilate(
        colored,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)),
    )
    details = cv2.bitwise_and(cv2.bitwise_or(dark, yellow), near_color)
    visible = cv2.bitwise_or(colored, details)
    visible = cv2.morphologyEx(
        visible,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)),
    )
    visible = cv2.bitwise_and(visible, region)

    regional_cleanup = cv2.dilate(
        visible,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)),
    )
    regional_cleanup = cv2.bitwise_and(regional_cleanup, region)

    # Pick up detached antialiased wing and tail tips that fall just beyond the
    # anatomical polygons. The red ribbon is explicitly protected.
    global_near = cv2.dilate(
        warm,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)),
    )
    global_dragon = cv2.bitwise_or(
        warm,
        cv2.bitwise_and(cv2.bitwise_or(dark, yellow), global_near),
    )
    ribbon_keep = polygon_mask(
        width,
        height,
        [(0.04, 0.62), (0.96, 0.62), (0.96, 0.74), (0.04, 0.74)],
    )
    global_dragon = cv2.bitwise_and(global_dragon, cv2.bitwise_not(ribbon_keep))
    global_cleanup = cv2.dilate(
        global_dragon,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)),
    )
    cleanup = cv2.bitwise_or(regional_cleanup, global_cleanup)
    return visible, cleanup


def composite(bottom: np.ndarray, top: np.ndarray) -> np.ndarray:
    bottom_f = bottom.astype(np.float32) / 255
    top_f = top.astype(np.float32) / 255
    top_a = top_f[:, :, 3:4]
    bottom_a = bottom_f[:, :, 3:4]
    out_a = top_a + bottom_a * (1 - top_a)
    safe_a = np.maximum(out_a, 1e-6)
    out_rgb = (
        top_f[:, :, :3] * top_a
        + bottom_f[:, :, :3] * bottom_a * (1 - top_a)
    ) / safe_a
    return (np.dstack((out_rgb, out_a)) * 255).clip(0, 255).astype(np.uint8)


def reconstruct_shield(rgba: np.ndarray, cleanup: np.ndarray) -> np.ndarray:
    height, width = rgba.shape[:2]
    plate = rgba.copy()

    shield_shape = polygon_mask(
        width,
        height,
        [
            (0.25, 0.31), (0.31, 0.29), (0.42, 0.29), (0.44, 0.31),
            (0.56, 0.31), (0.58, 0.29), (0.69, 0.29), (0.75, 0.33),
            (0.73, 0.63), (0.65, 0.75), (0.58, 0.84), (0.50, 0.90),
            (0.42, 0.84), (0.34, 0.75), (0.27, 0.63),
        ],
    )
    upper_overlap = polygon_mask(
        width,
        height,
        [(0.22, 0.26), (0.78, 0.26), (0.78, 0.435), (0.22, 0.435)],
    )
    repair = cv2.bitwise_and(cv2.bitwise_and(cleanup, shield_shape), upper_overlap)
    erase = cv2.bitwise_and(cleanup, cv2.bitwise_not(shield_shape))
    plate[erase > 0] = (0, 0, 0, 0)
    bottom_zone = polygon_mask(
        width,
        height,
        [(0.25, 0.80), (0.75, 0.80), (0.75, 1.00), (0.25, 1.00)],
    )
    bottom_cleanup = cv2.bitwise_and(cleanup, bottom_zone)
    plate[bottom_cleanup > 0] = (0, 0, 0, 0)

    # Fit the shield's existing cream gradient and use it to rebuild the large
    # areas concealed by the dragon without borrowing orange or dark pixels.
    rgb = rgba[:, :, :3]
    ys, xs = np.indices((height, width))
    neutral = (
        (shield_shape > 0)
        & (cleanup == 0)
        & (rgb[:, :, 0] > 155)
        & (rgb[:, :, 1] > 135)
        & (rgb[:, :, 2] > 105)
        & ((rgb.max(axis=2) - rgb.min(axis=2)) < 85)
    )
    sample_y, sample_x = np.where(neutral)
    stride = max(1, len(sample_x) // 120_000)
    sample_x = sample_x[::stride]
    sample_y = sample_y[::stride]
    nx = sample_x / width
    ny = sample_y / height
    design = np.column_stack(
        (np.ones_like(nx), nx, ny, nx * ny, nx * nx, ny * ny)
    )
    coefficients = [
        np.linalg.lstsq(design, rgb[sample_y, sample_x, channel], rcond=None)[0]
        for channel in range(3)
    ]
    full_x = xs / width
    full_y = ys / height
    full_design = np.stack(
        (
            np.ones_like(full_x),
            full_x,
            full_y,
            full_x * full_y,
            full_x * full_x,
            full_y * full_y,
        ),
        axis=-1,
    )
    predicted = np.stack(
        [np.tensordot(full_design, coefficient, axes=([2], [0])) for coefficient in coefficients],
        axis=-1,
    ).clip(0, 255).astype(np.uint8)

    # Rebuild the complete upper shield surface as one continuous field so no
    # patch boundary or silhouette of the former dragon remains.
    upper_surface = polygon_mask(
        width,
        height,
        [(0.24, 0.275), (0.76, 0.275), (0.76, 0.425), (0.24, 0.425)],
    )
    expanded_repair = cv2.bitwise_and(upper_surface, shield_shape)
    plate[expanded_repair > 0, :3] = predicted[expanded_repair > 0]
    plate[expanded_repair > 0, 3] = 255
    bottom_surface = polygon_mask(
        width,
        height,
        [(0.405, 0.805), (0.500, 0.905), (0.595, 0.805)],
    )
    plate[bottom_surface > 0, :3] = predicted[bottom_surface > 0]
    plate[bottom_surface > 0, 3] = 255

    # Restore the concealed top and bottom border runs as continuous,
    # antialiased strokes matching the source crest.
    border_overlay = np.zeros_like(plate)
    top_path = np.array(
        [
            (round(0.250 * width), round(0.415 * height)),
            (round(0.255 * width), round(0.345 * height)),
            (round(0.285 * width), round(0.315 * height)),
            (round(0.315 * width), round(0.300 * height)),
            (round(0.420 * width), round(0.300 * height)),
            (round(0.420 * width), round(0.322 * height)),
            (round(0.580 * width), round(0.322 * height)),
            (round(0.580 * width), round(0.300 * height)),
            (round(0.685 * width), round(0.300 * height)),
            (round(0.715 * width), round(0.315 * height)),
            (round(0.745 * width), round(0.345 * height)),
            (round(0.750 * width), round(0.415 * height)),
        ],
        dtype=np.int32,
    )
    bottom_path = np.array(
        [
            (round(0.405 * width), round(0.805 * height)),
            (round(0.500 * width), round(0.905 * height)),
            (round(0.595 * width), round(0.805 * height)),
        ],
        dtype=np.int32,
    )
    cv2.polylines(border_overlay, [top_path], False, (60, 35, 21, 255), 26, cv2.LINE_AA)
    cv2.polylines(border_overlay, [top_path], False, (114, 101, 88, 255), 14, cv2.LINE_AA)
    cv2.polylines(border_overlay, [bottom_path], False, (60, 35, 21, 255), 26, cv2.LINE_AA)
    cv2.polylines(border_overlay, [bottom_path], False, (114, 101, 88, 255), 14, cv2.LINE_AA)

    # Only lay reconstructed border strokes over pixels touched by the dragon.
    border_alpha = border_overlay[:, :, 3]
    border_allowed = cv2.dilate(
        cv2.bitwise_or(repair, bottom_surface),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)),
    )
    border_overlay[:, :, 3] = cv2.bitwise_and(border_alpha, border_allowed)
    plate = composite(plate, border_overlay)
    plate[plate[:, :, 3] == 0, :3] = 0
    return plate


def reconstruct_dragon(rgba: np.ndarray) -> np.ndarray:
    height, width = rgba.shape[:2]
    generated = np.asarray(Image.open(GENERATED_DRAGON).convert("RGBA"))
    result = np.asarray(
        Image.fromarray(generated, "RGBA").resize(
            (width, height),
            Image.Resampling.LANCZOS,
        )
    ).copy()
    result[result[:, :, 3] == 0, :3] = 0
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    width = round(source.width * HEIGHT / source.height)
    rgba = np.asarray(source.resize((width, HEIGHT), Image.Resampling.LANCZOS))

    _, cleanup = warm_dragon_masks(rgba)
    shield = reconstruct_shield(rgba, cleanup)
    dragon = reconstruct_dragon(rgba)

    Image.fromarray(shield, "RGBA").save(OUTPUT / "shield-complete.png", optimize=True)
    Image.fromarray(dragon, "RGBA").save(OUTPUT / "dragon-complete.png", optimize=True)

    for legacy_name in (
        "dragon-body.png",
        "dragon-left-wing.png",
        "dragon-right-wing.png",
        "dragon-tail.png",
        "logo-clean-plate.png",
    ):
        legacy_path = OUTPUT / legacy_name
        if legacy_path.exists():
            legacy_path.unlink()

    print(f"Wrote exactly two production layers to {OUTPUT}")
    print(f"Dimensions: {width}x{HEIGHT}")


if __name__ == "__main__":
    main()
