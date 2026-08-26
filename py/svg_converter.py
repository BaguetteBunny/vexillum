import argparse
import os
import resvg_py
from constants import SIZES

def convert_svg_to_pngs(svg_path: str, output_dir: str = None, sizes: list[int] = None) -> None:
    """Render an SVG file to PNG files at each of the given widths."""
    if not os.path.isfile(svg_path):
        raise FileNotFoundError(f"No such SVG file: {svg_path}")

    sizes = sizes or SIZES
    output_dir = output_dir or os.path.dirname(os.path.abspath(svg_path))
    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(svg_path))[0]

    for width in sizes:
        png_bytes = resvg_py.svg_to_bytes(svg_path=svg_path, width=width)

        out_path = os.path.join(output_dir, f"{base_name}_w{width}.png")
        with open(out_path, "wb") as f:
            f.write(png_bytes)
        print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert an SVG file to PNG files at multiple widths."
    )
    parser.add_argument("svg_path", help="Path to the source SVG file")
    parser.add_argument(
        "-o", "--output-dir",
        help="Directory to write PNGs to (default: same folder as the SVG)"
    )
    parser.add_argument(
        "-w", "--widths", type=int, nargs="+",
        help=f"Widths to render in pixels (default: {SIZES})"
    )
    args = parser.parse_args()

    convert_svg_to_pngs(args.svg_path, args.output_dir, args.widths)


if __name__ == "__main__":
    '''
    Usage:
    python py/svg_converter.py assets/misc/commonwealth.svg -w 20 40 80 160 320 640 1280 2560 -o out/
    python py/svg_converter.py assets/misc/commonwealth.svg
    '''
    main()