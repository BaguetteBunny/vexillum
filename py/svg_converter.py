import argparse
import json
import os
import resvg_py
from constants import SIZES

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(SCRIPT_DIR, "..", "api")

def convert_svg_to_pngs(svg_path: str, sizes: list[int] = None) -> None:
    """Render an SVG into ../api/w{width}/, keeping the SVG's exact base filename."""
    if not os.path.isfile(svg_path):
        raise FileNotFoundError(f"No such SVG file: {svg_path}")

    sizes = sizes or SIZES
    base_name = os.path.splitext(os.path.basename(svg_path))[0]

    for width in sizes:
        out_dir = os.path.join(API_DIR, f"w{width}")
        os.makedirs(out_dir, exist_ok=True)

        png_bytes = resvg_py.svg_to_bytes(svg_path=svg_path, width=width)

        out_path = os.path.join(out_dir, f"{base_name}.png")
        with open(out_path, "wb") as f:
            f.write(png_bytes)
        print(f"Wrote {out_path}")


def convert_misc_batch(svg_names: dict, sizes: list[int] = None) -> None:
    """Convert each {key}.svg under assets/misc/, keyed by a {key: description} dict."""
    sizes = sizes or SIZES
    failed = []
 
    for key, description in svg_names.items():
        svg_path = os.path.join("assets", "misc", f"{key.lower()}.svg")
        print(f"--- {key} ({description}) ---")
        try:
            convert_svg_to_pngs(svg_path, sizes)
        except Exception as err:
            print(f"  FAILED: {err}")
            failed.append(key)
 
    if failed: print(f"\n{len(failed)}/{len(svg_names)} failed: {', '.join(failed)}")

def _load_mapping(raw: str) -> dict:
    """Parse --batch input: either a raw JSON object or a path to a .json file."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        with open(raw, "r", encoding="utf-8") as f:
            return json.load(f)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert SVG file(s) into ../api/w{width}/ PNGs at each configured width."
    )
    parser.add_argument("svg_path", nargs="?", help="Path to a single source SVG file")
    parser.add_argument(
        "-w", "--widths", type=int, nargs="+",
        help=f"Widths to render in pixels (default: {SIZES})"
    )
    parser.add_argument(
        "-b", "--batch",
        help='A JSON object, or path to a .json file, of {"svg-key": "description"} pairs '
             'to convert from assets/misc/, e.g. \'{"io-cn": "Commonwealth of Nations"}\''
    )
    args = parser.parse_args()

    if args.batch:
        convert_misc_batch(_load_mapping(args.batch), args.widths)
    elif args.svg_path:
        convert_svg_to_pngs(args.svg_path, args.widths)
    else:
        parser.error("either svg_path or --batch is required")


if __name__ == "__main__":
    '''
    Usage:
    python py/svg_converter.py assets/misc/io-acs.svg -w 20 40 80 160 320 640 1280 2560
    python py/svg_converter.py assets/misc/io-acs.svg
    python py/svg_converter.py --batch '{"io-cn": "Commonwealth of Nations"}'
    python py/svg_converter.py --batch misc_flags.json
    '''
    main()