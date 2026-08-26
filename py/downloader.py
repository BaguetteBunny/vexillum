import json
import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from constants import (FLAGPEDIA_CODES_URL,FLAGPEDIA_SVG_URL,HEADERS,SIZES,DIRS)


def fetch_country_codes() -> dict:
    """Fetch country code mappings from Flagcdn."""
    response = requests.get(FLAGPEDIA_CODES_URL, headers=HEADERS, timeout=10)
    response.raise_for_status()
    return response.json()

def prepare_directories() -> dict:
    """Generate target folder mapping and create output directories under api/."""
    dir_mapping = DIRS.copy()

    for size in SIZES:
        dir_mapping[size] = f"api/w{size}"

    for path in dir_mapping.values():
        os.makedirs(path, exist_ok=True)

    return dir_mapping


def download_single_flag(url: str, file_path: str) -> bool:
    """Download a single flag asset if not already cached locally."""
    if os.path.exists(file_path): return True

    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            with open(file_path, "wb") as f:
                f.write(res.content)
            return True
        print(f"HTTP {res.status_code} for URL: {url}")
        return False
    except Exception as err:
        print(f"Failed to download {url}: {err}")
        return False


def extract_all_flags(codes: dict, dir_mapping: dict) -> None:
    """Concurrently download SVG files and standard PNG width files."""
    download_queue = []

    with ThreadPoolExecutor(max_workers=12) as executor:
        for code in codes.keys():
            code_lower = code.lower()

            # Fetch SVG: https://flagcdn.com/{code}.svg
            svg_url = f"{FLAGPEDIA_SVG_URL}/{code_lower}.svg"
            svg_path = os.path.join(dir_mapping['svg'], f"{code_lower}.svg")
            download_queue.append(
                executor.submit(download_single_flag, svg_url, svg_path)
            )

            # Fetch PNGs: https://flagcdn.com/w{width}/{code}.png
            for size in SIZES:
                png_url = f"{FLAGPEDIA_SVG_URL}/w{size}/{code_lower}.png"
                png_path = os.path.join(dir_mapping[size], f"{code_lower}.png")
                download_queue.append(
                    executor.submit(download_single_flag, png_url, png_path)
                )

        completed_count = sum(1 for future in as_completed(download_queue) if future.result())
        print(f"Successfully downloaded {completed_count}/{len(download_queue)} assets.")


def main() -> None:
    print("Fetching country codes")
    country_codes = fetch_country_codes()

    print("Preparing output folders")
    dir_mapping = prepare_directories()

    print(f"Downloading flag assets (SVG + widths {SIZES})")
    extract_all_flags(country_codes, dir_mapping)

    print("Done.")


if __name__ == "__main__":
    main()