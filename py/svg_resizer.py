import argparse
import re
import xml.etree.ElementTree as ET

ET.register_namespace("", "http://www.w3.org/2000/svg")

_NUMERIC_LENGTH_RE = re.compile(r"^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$")


def _parse_length(value: str) -> float | None:
    if not value:
        return None
    match = _NUMERIC_LENGTH_RE.match(value)
    if not match:
        return None
    number = float(match.group(1))
    return number if number > 0 else None


def _parse_viewbox(value: str) -> tuple[float, float, float, float] | None:
    if not value:
        return None
    parts = value.replace(",", " ").split()
    if len(parts) != 4:
        return None
    try:
        min_x, min_y, w, h = (float(p) for p in parts)
    except ValueError:
        return None
    if w <= 0 or h <= 0:
        return None
    return min_x, min_y, w, h


def _format_num(n: float) -> str:
    return str(int(n)) if n == int(n) else str(n)


def fix_svg_size(svg_path: str) -> str:
    tree = ET.parse(svg_path)
    root = tree.getroot()

    width = _parse_length(root.get("width", ""))
    height = _parse_length(root.get("height", ""))
    viewbox = _parse_viewbox(root.get("viewBox", ""))

    if width and height and viewbox:
        return "ok"

    if viewbox and not (width and height):
        _, _, vb_w, vb_h = viewbox
        root.set("width", _format_num(vb_w))
        root.set("height", _format_num(vb_h))
    elif width and height and not viewbox:
        root.set("viewBox", f"0 0 {_format_num(width)} {_format_num(height)}")
    else:
        return "unfixable"

    tree.write(svg_path, encoding="utf-8", xml_declaration=True)
    return "fixed"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("svg_path")
    args = parser.parse_args()

    status = fix_svg_size(args.svg_path)
    print(f"{status}: {args.svg_path}")

# Run with:
# python py/svg_resizer.py assets/misc/io-ba.svg
if __name__ == "__main__":
    main()