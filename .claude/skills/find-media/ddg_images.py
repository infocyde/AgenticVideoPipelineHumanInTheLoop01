"""DuckDuckGo (Bing) image search as a LEAD FINDER for find-media. Never a license source.

DDG's image results and license filter come from Bing, which guesses the license from page
metadata and mislabels stock, agency and copied images. Trace every hit to its source page
and confirm the license there. See sources.md, "DuckDuckGo".

  .venv/Scripts/python.exe -I -X utf8 .claude/skills/find-media/ddg_images.py "MQ-9 Reaper" --federal
  .venv/Scripts/python.exe -I -X utf8 .claude/skills/find-media/ddg_images.py "Tu-160 bomber" --license public

One JSON object per line on stdout, a summary on stderr. Exit 0 = ok (maybe 0 hits), 2 = blocked/error.
"""
import argparse
import json
import sys
from urllib.parse import urlparse

from ddgs.engines.bing_images import BingImages
from ddgs.engines.duckduckgo_images import DuckduckgoImages
from ddgs.exceptions import DDGSException

# ddgs 9.16 sends "Connection: keep-alive", which primp 2.x rejects over HTTP/2 ("malformed headers").
DuckduckgoImages.headers_update = {k: v for k, v in DuckduckgoImages.headers_update.items() if k != "Connection"}

# friendly name -> (DDG license value, the same Bing filter)
LICENSES = {"public": ("Public", "L1"), "share-commercially": ("ShareCommercially", "L2_L3_L4"),
            "modify-commercially": ("ModifyCommercially", "L2_L3"), "any": (None, None)}
FEDERAL = ["af.mil", "army.mil", "navy.mil", "marines.mil", "defense.gov", "war.gov", "dvidshub.net",
           "nasa.gov", "noaa.gov", "usgs.gov", "loc.gov", "archives.gov"]
CC_HOSTS = ["commons.wikimedia.org", "upload.wikimedia.org", "wikipedia.org", "flickr.com", "openverse.org"]
# Stock, agency, wallpaper, social and news hosts: a substring of the domain rejects.
REJECT = ["gettyimages", "shutterstock", "alamy", "istockphoto", "stock.adobe", "adobestock", "dreamstime",
          "depositphotos", "123rf", "apimages", "apnews", "reuters", "afp.com", "pinterest", "pexels",
          "pixabay", "unsplash", "rawpixel", "freepik", "vecteezy", "bigstock", "stocksy", "agefotostock",
          "wallpaper", "wallhaven", "alphacoders", "pxfuel", "pikist", "peakpx", "picryl", "hdqwalls",
          "imgur", "reddit", "x.com", "twitter", "facebook", "instagram", "tiktok", "youtube", "ytimg",
          "news", "times", "post", "herald", "tribune", "gazette", "cnn.", "bbc.", "foxnews", "nbc", "cbs",
          "guardian", "telegraph", "dailymail", "independent.", "forbes", "bloomberg", "aljazeera", "rt.com",
          "tass", "sputnik", "military.com", "thedrive", "twz.com", "armyrecognition", "-technology.com",
          "janes", "popularmechanics", "insider", "nationalinterest", "19fortyfive", "aviationist", "flightglobal"]


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(2)


def hint(dom):
    if dom.endswith(".mil") or any(dom == d or dom.endswith("." + d) for d in FEDERAL):
        return "federal-domain"
    if any(dom == d or dom.endswith("." + d) for d in CC_HOSTS):
        return "known-cc-host"
    return "reject-domain" if any(r in dom for r in REJECT) else "unknown"


def search_ddg(query, lic):
    eng = DuckduckgoImages(timeout=15)
    payload = eng.build_payload(query, "us-en", "moderate", None, size="Large", license_image=lic)
    r = eng.http_client.request("GET", eng.search_url, params=payload)
    if r.status_code != 200 or "botnet_challenge" in r.text:
        return None  # 202/403 = DDG's anti-bot challenge or rate limit
    return [vars(x) for x in eng.extract_results(r.text)]


def search_bing(query, lic):
    eng = BingImages(timeout=15)
    payload = eng.build_payload(query, "us-en", "moderate", None, max_results=35)
    payload["qft"] = "+filterui:imagesize-large" + (f"+filterui:license-{lic}" if lic else "")
    r = eng.http_client.request("GET", eng.search_url, params=payload)
    return [vars(x) for x in eng.extract_results(r.text)] if r.status_code == 200 else None


def main():
    ap = argparse.ArgumentParser(description="DuckDuckGo image lead finder (verify every license yourself).")
    ap.add_argument("query")
    ap.add_argument("--license", choices=LICENSES,
                    help="DDG/Bing filter, a hint only (default: public; any with --site/--federal)")
    ap.add_argument("--site", action="append", default=[], help="limit to a domain (repeatable)")
    ap.add_argument("--federal", action="store_true", help="limit to US federal media domains")
    ap.add_argument("--engine", default="auto", choices=["auto", "ddg", "bing"], help="auto: DDG, Bing if DDG blocks")
    ap.add_argument("--max", type=int, default=30)
    ap.add_argument("--min-width", type=int, default=1280)
    ap.add_argument("--show-rejected", action="store_true")
    a = ap.parse_args()

    sites = a.site + (FEDERAL if a.federal else [])
    query = a.query + (" (" + " OR ".join(f"site:{s}" for s in sites) + ")" if sites else "")
    # Bing's filter doesn't tag federal pages as public domain, so with site: it drops them and pads with junk.
    ddg_lic, bing_lic = LICENSES[a.license or ("any" if sites else "public")]
    raw, used = None, None
    try:  # one request per engine, no retry loop
        if a.engine in ("auto", "ddg"):
            raw, used = search_ddg(query, ddg_lic), "ddg"
        if raw is None and a.engine in ("auto", "bing"):
            if used:
                print("# DDG returned a bot challenge or rate limit; using Bing (same index and license filter)",
                      file=sys.stderr)
            raw, used = search_bing(query, bing_lic), "bing"
    except DDGSException as e:
        die(f"Search error: {e}. Wait a few minutes before trying again; don't retry in a loop.")
    if raw is None:
        die(f"{used} refused the request (rate limit or bot challenge). Wait several minutes; don't loop.")

    counts, shown = {}, 0
    for r in raw:
        w, h = int(r.get("width") or 0), int(r.get("height") or 0)
        if w < a.min_width:
            continue
        host = (urlparse(r.get("url") or "").hostname or "").lower()
        dom = host[4:] if host.startswith("www.") else host
        v = hint(dom)
        counts[v] = counts.get(v, 0) + 1
        if (v == "reject-domain" and not a.show_rejected) or shown >= a.max:
            continue
        shown += 1
        print(json.dumps({"title": r.get("title"), "image": r.get("image"), "page": r.get("url"),
                          "domain": dom, "width": w, "height": h, "verdict_hint": v}, ensure_ascii=False))
    print(f"# engine={used} license={a.license or ('any' if sites else 'public')} query={query!r} raw={len(raw)} >={a.min_width}px: {counts} shown={shown}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
