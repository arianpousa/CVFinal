"""make_samples.py: generate the two sample "phone photos" in samples/ (opencv-expert, Iris).

The shell that built this project has no internet, so instead of downloading photos we
render them: a printed document is drawn flat, then photographed "virtually" with a
perspective warp onto a desk texture, uneven lighting, a soft shadow, lens blur, sensor
noise and JPEG compression. The result looks like a phone photo, not a diagram.

Outputs (deterministic, seeded):
  samples/receipt.jpg  tilted shop receipt on a wooden desk, warm uneven light, slight blur
  samples/letter.jpg   letter-size page with paragraphs, shot at an angle, a hand/phone shadow
  samples/truth.json   the true page corners in each photo (used by the tests)

Usage (from the repo root):  python tools/make_samples.py
Needs: opencv-python, numpy (pip install opencv-python numpy)
Sources: cv2.getPerspectiveTransform / warpPerspective
  https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html
"""
import json
import pathlib

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "samples"
rng = np.random.default_rng(20261124)

FONT = cv2.FONT_HERSHEY_SIMPLEX
MONO = cv2.FONT_HERSHEY_PLAIN


# ---------- flat documents ----------
def receipt_doc() -> np.ndarray:
    w, h = 620, 1500
    doc = np.full((h, w, 3), (236, 240, 242), np.uint8)          # thermal paper, slightly cool
    ink = (55, 50, 50)
    def text(s, y, x=40, scale=1.6, th=2, font=MONO, center=False):
        if center:
            (tw, _), _ = cv2.getTextSize(s, font, scale, th)
            x = (w - tw) // 2
        cv2.putText(doc, s, (x, y), font, scale, ink, th, cv2.LINE_AA)
    text("CORNER MARKET", 90, scale=1.25, th=3, font=FONT, center=True)
    text("128 Ocean Drive, Miami FL", 135, scale=1.3, center=True)
    text("Tel 305-555-0142", 170, scale=1.3, center=True)
    text("-" * 38, 215, scale=1.3)
    items = [("Whole milk 1 gal", "4.29"), ("Sourdough bread", "5.49"), ("Bananas 2.1 lb", "1.24"),
             ("Coffee beans 12oz", "11.99"), ("Eggs large 12ct", "3.89"), ("Spinach bag", "2.99"),
             ("Cheddar block", "6.49"), ("Olive oil 500ml", "8.75"), ("Pasta penne", "1.89"),
             ("Tomato sauce", "2.59"), ("Greek yogurt", "4.99"), ("Paper towels", "7.29")]
    y = 265
    for name, price in items:
        text(name, y)
        text(price, y, x=w - 40 - len(price) * 18)
        y += 52
    text("-" * 38, y, scale=1.3); y += 50
    for label, val in (("SUBTOTAL", "61.89"), ("TAX 7%", "4.33"), ("TOTAL", "66.22")):
        text(label, y, scale=1.8 if label == "TOTAL" else 1.6, th=3 if label == "TOTAL" else 2)
        text(val, y, x=w - 40 - len(val) * 20, scale=1.8 if label == "TOTAL" else 1.6, th=3 if label == "TOTAL" else 2)
        y += 55
    y += 20
    text("VISA **** 4417   APPROVED", y, scale=1.3); y += 45
    text("11/24/2026  14:32  #0042", y, scale=1.3); y += 70
    text("THANK YOU FOR SHOPPING!", y, scale=1.4, th=2, center=True); y += 60
    # barcode
    x = 110
    while x < w - 110:
        bw = int(rng.integers(2, 7))
        cv2.rectangle(doc, (x, y), (x + bw, y + 90), ink, -1)
        x += bw + int(rng.integers(3, 8))
    # thermal paper fade + faint creases
    fade = np.linspace(1.0, 0.93, h)[:, None, None]
    doc = (doc * fade).astype(np.uint8)
    for cy in (480, 1010):
        doc[cy:cy + 2] = (doc[cy:cy + 2] * 0.9).astype(np.uint8)
    return doc


def letter_doc() -> np.ndarray:
    w, h = 1275, 1650                                             # US letter at 150 dpi
    doc = np.full((h, w, 3), (246, 248, 250), np.uint8)
    ink = (40, 36, 34)
    cv2.putText(doc, "Department of Computer Vision", (110, 150), FONT, 1.5, ink, 3, cv2.LINE_AA)
    cv2.line(doc, (110, 180), (w - 110, 180), (90, 90, 90), 2)
    cv2.putText(doc, "November 24, 2026", (110, 250), FONT, 0.95, ink, 2, cv2.LINE_AA)
    cv2.putText(doc, "Dear Student,", (110, 330), FONT, 1.0, ink, 2, cv2.LINE_AA)
    paragraphs = [
        "Thank you for submitting your final project. This letter confirms that your document "
        "scanner was received and will be reviewed by the course staff this week.",
        "The scanner should find the edges of a page in an ordinary phone photo, flatten it with "
        "a perspective warp, and clean it into a crisp black and white image that is easy to read.",
        "All processing must happen in the browser. OpenCV.js runs as WebAssembly inside a Web "
        "Worker, so the page stays responsive, and every image buffer is released when it is done.",
        "Saved scans are kept in IndexedDB on your own device. Nothing is uploaded to a server, and "
        "a single button resets the app if anything ever gets stuck.",
        "Please bring two sample photos to the demo: one receipt and one printed page.",
    ]
    y = 400
    for para in paragraphs:
        x, first = 160, True
        for word in para.split():
            (tw, _), _ = cv2.getTextSize(word, FONT, 0.85, 2)
            if x + tw > w - 110:
                y += 42
                x = 110
            cv2.putText(doc, word, (x, y), FONT, 0.85, ink, 2, cv2.LINE_AA)
            x += tw + 14
        y += 42 + 30
    cv2.putText(doc, "Sincerely,", (110, y + 30), FONT, 1.0, ink, 2, cv2.LINE_AA)
    pts = np.array([[110 + i * 9, y + 110 + int(18 * np.sin(i / 3.0))] for i in range(40)], np.int32)
    cv2.polylines(doc, [pts], False, (120, 60, 20), 3, cv2.LINE_AA)  # signature scribble
    return doc


# ---------- backgrounds ----------
def wood_desk(w: int, h: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    noise = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 25)
    warp = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 120) * 40
    grain = np.sin((xx * 0.004 + noise * 2.5 + warp * 0.05 + yy * 0.0004) * 14.0) * 0.6 + np.sin(xx * 0.09 + noise * 9) * 0.25
    fine = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.2)
    t = (0.55 + 0.25 * grain + 0.06 * fine)[..., None]
    dark, light = np.array([30, 55, 95], np.float32), np.array([70, 115, 170], np.float32)   # BGR browns
    return np.clip(dark + (light - dark) * t, 0, 255).astype(np.uint8)


def fabric_desk(w: int, h: int) -> np.ndarray:
    base = np.array([62, 58, 54], np.float32)
    weave = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.5) * 9
    blot = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 60) * 140
    return np.clip(base + (weave + blot)[..., None], 0, 255).astype(np.uint8)


# ---------- "camera" ----------
def photograph(doc, desk, corners, light_center, light_strength, shadow=None, blur=1.4, seed_noise=5.0):
    h, w = desk.shape[:2]
    dh, dw = doc.shape[:2]
    src = np.float32([[0, 0], [dw - 1, 0], [dw - 1, dh - 1], [0, dh - 1]])
    M = cv2.getPerspectiveTransform(src, np.float32(corners))
    warped = cv2.warpPerspective(doc, M, (w, h), flags=cv2.INTER_AREA)
    mask = cv2.warpPerspective(np.full((dh, dw), 255, np.uint8), M, (w, h))
    # soft drop shadow under the paper
    sh = cv2.GaussianBlur(cv2.warpPerspective(np.full((dh, dw), 255, np.uint8), M @ np.array([[1, 0, 6], [0, 1, 10], [0, 0, 1]], np.float64), (w, h)), (0, 0), 9)
    img = desk.astype(np.float32) * (1 - 0.45 * sh[..., None] / 255.0)
    m = cv2.GaussianBlur(mask, (3, 3), 0)[..., None] / 255.0          # anti-aliased paper edge
    img = img * (1 - m) + warped.astype(np.float32) * m
    # uneven light: bright spot + vignette
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot(xx - light_center[0], yy - light_center[1]) / np.hypot(w, h)
    light = 1.08 - light_strength * d ** 1.3
    img *= light[..., None]
    img *= np.array([0.96, 1.0, 1.04], np.float32)                       # warm white balance (BGR)
    if shadow is not None:                                               # phone/hand shadow polygon
        s = np.zeros((h, w), np.uint8)
        cv2.fillPoly(s, [np.int32(shadow)], 255)
        s = cv2.GaussianBlur(s, (0, 0), 45).astype(np.float32) / 255.0
        img *= (1 - 0.38 * s)[..., None]
    img = cv2.GaussianBlur(img, (0, 0), blur)                            # slight focus blur
    img += rng.normal(0, seed_noise, img.shape).astype(np.float32)       # sensor noise
    return np.clip(img, 0, 255).astype(np.uint8)


# ---------- pinhole camera: where the page corners land in the photo ----------
def camera_corners(doc_w, doc_h, img_w, img_h, f, tilt_x, tilt_y, roll, dist, shift=(0, 0)):
    """Project a flat page (doc_w x doc_h units) seen by a pinhole camera with focal length f (px).
    tilt_x / tilt_y tip the page away from the camera, roll spins it in its own plane, all in degrees.
    A real camera projection keeps the page's true aspect ratio recoverable from its 4 corners."""
    rx, ry, rz = np.radians([tilt_x, tilt_y, roll])
    Rx = np.array([[1, 0, 0], [0, np.cos(rx), -np.sin(rx)], [0, np.sin(rx), np.cos(rx)]])
    Ry = np.array([[np.cos(ry), 0, np.sin(ry)], [0, 1, 0], [-np.sin(ry), 0, np.cos(ry)]])
    Rz = np.array([[np.cos(rz), -np.sin(rz), 0], [np.sin(rz), np.cos(rz), 0], [0, 0, 1]])
    pts = np.array([[-doc_w / 2, -doc_h / 2, 0], [doc_w / 2, -doc_h / 2, 0], [doc_w / 2, doc_h / 2, 0], [-doc_w / 2, doc_h / 2, 0]])
    cam = (Rx @ Ry @ Rz @ pts.T).T + np.array([0, 0, dist])
    u = f * cam[:, 0] / cam[:, 2] + img_w / 2 + shift[0]
    v = f * cam[:, 1] / cam[:, 2] + img_h / 2 + shift[1]
    return [[round(float(a)), round(float(b))] for a, b in zip(u, v)]


def main() -> None:
    OUT.mkdir(exist_ok=True)
    truth = {}

    # receipt: portrait 1500x2000 photo; page tipped 28 degrees away and rotated 10 degrees
    W, H = 1500, 2000
    rc = camera_corners(620, 1500, W, H, f=1700, tilt_x=-28, tilt_y=6, roll=10, dist=1750, shift=(-10, -60))
    img = photograph(receipt_doc(), wood_desk(W, H), rc, light_center=(1300, 150), light_strength=0.85, blur=1.6)
    cv2.imwrite(str(OUT / "receipt.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 86])
    truth["receipt.jpg"] = {"width": W, "height": H, "corners": rc, "page_aspect": 1500 / 620}

    # letter: landscape 2000x1500 photo; page tipped 35 degrees (strong keystone), shadow bottom-left
    W, H = 2000, 1500
    lc = camera_corners(1275, 1650, W, H, f=1800, tilt_x=-35, tilt_y=-8, roll=4, dist=2500, shift=(40, -60))
    shadow = [[0, 900], [700, 1050], [1100, 1500], [0, 1500]]
    img = photograph(letter_doc(), fabric_desk(W, H), lc, light_center=(1500, 200), light_strength=0.7, shadow=shadow, blur=1.3)
    cv2.imwrite(str(OUT / "letter.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 86])
    truth["letter.jpg"] = {"width": W, "height": H, "corners": lc, "page_aspect": 1650 / 1275}

    (OUT / "truth.json").write_text(json.dumps(truth, indent=2) + "\n", encoding="utf-8")
    for f in ("receipt.jpg", "letter.jpg"):
        print(f, (OUT / f).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
