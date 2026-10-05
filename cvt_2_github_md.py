#!/usr/bin/env python3
"""cvt_2_github_md.py — convert a Nexus Markdown page into GitHub-legal Markdown.

GitHub sanitizes rendered Markdown: it strips <style> blocks and ignores
class/style attributes, so the Nexus viewer's styling hooks (a <style> block and
<span class="float-right|float-left|center">![alt](src)</span> wrappers) do
nothing on GitHub. This tool rewrites those into the small set of HTML GitHub
*does* honor:

  * <style>...</style> blocks are removed entirely.
  * <span class="center">![alt](src)</span>
        -> <p align="center">
             <img src="<fixed-src>" width="256">
           </p>
  * <span class="float-right">![alt](src)</span>
        -> <img align="right" width="128" src="<fixed-src>">
  * <span class="float-left">![alt](src)</span>
        -> <img align="left" width="128" src="<fixed-src>">
  * a bare image  ![alt](src)
        -> <img width="128" src="<fixed-src>">

Image sources are rewritten by replacing a leading "../" with "src/resources/"
(so the links resolve from the repository root on GitHub). Sources that do not
start with "../" (absolute URLs, already-rooted paths, etc.) are left unchanged.

Usage:
    python3 cvt_2_github_md.py INPUT.md OUTPUT.md
"""

import argparse
import re
import sys


# Width used for each conversion variant.
FLOAT_WIDTH = 128
CENTER_WIDTH = 256
BARE_WIDTH = 128


def fix_src(src):
    """Rewrite an image src for GitHub: a leading '../' becomes 'src/resources/'.

    Only the single leading '../' is replaced (the convention these pages use);
    anything else is returned unchanged.
    """
    src = src.strip()
    if src.startswith("../"):
        return "src/resources/" + src[len("../"):]
    return src


def strip_style_blocks(text):
    """Remove every <style>...</style> block (case-insensitive, across lines)."""
    return re.sub(r"<style\b[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL)


# A Markdown image: ![alt](src) with an optional "title" and optional {attrs}.
# Captures the alt text and the raw src (first whitespace-delimited token).
_IMG = r'!\[(?P<alt>[^\]]*)\]\(\s*(?P<src>[^)\s]+)(?:\s+"[^"]*")?\s*\)(?:\{[^}]*\})?'

# A <span class="..."> wrapping exactly one Markdown image.
_SPAN_IMG = re.compile(
    r'<span\s+class="(?P<cls>[^"]*)"\s*>\s*' + _IMG + r'\s*</span>',
    flags=re.IGNORECASE,
)

# A bare Markdown image (used after spans have been consumed).
_BARE_IMG = re.compile(_IMG)


def _classes(cls_attr):
    return cls_attr.split()


def convert_spans(text):
    """Convert <span class="...">![alt](src)</span> wrappers to GitHub HTML."""
    def repl(m):
        classes = _classes(m.group("cls"))
        src = fix_src(m.group("src"))
        if "center" in classes:
            return (
                '<p align="center">\n'
                '  <img src="%s" width="%d">\n'
                '</p>' % (src, CENTER_WIDTH)
            )
        if "float-right" in classes:
            return '<img align="right" width="%d" src="%s">' % (FLOAT_WIDTH, src)
        if "float-left" in classes:
            return '<img align="left" width="%d" src="%s">' % (FLOAT_WIDTH, src)
        # Unknown class: emit a plain sized image (still fixes the src).
        return '<img width="%d" src="%s">' % (FLOAT_WIDTH, src)

    return _SPAN_IMG.sub(repl, text)


def convert_bare_images(text):
    """Convert any remaining bare ![alt](src) images to <img width=128 src=...>."""
    def repl(m):
        src = fix_src(m.group("src"))
        return '<img width="%d" src="%s">' % (BARE_WIDTH, src)

    return _BARE_IMG.sub(repl, text)


def convert(text):
    text = strip_style_blocks(text)
    # Spans first (they contain images); then any images left in prose/tables.
    text = convert_spans(text)
    text = convert_bare_images(text)
    return text


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Convert Nexus Markdown to GitHub-legal Markdown."
    )
    parser.add_argument("input", help="input .md file")
    parser.add_argument("output", help="output .md file")
    args = parser.parse_args(argv)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        print("error: cannot read %s: %s" % (args.input, e), file=sys.stderr)
        return 1

    result = convert(text)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result)
    except OSError as e:
        print("error: cannot write %s: %s" % (args.output, e), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
