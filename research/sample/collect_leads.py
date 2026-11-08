"""Collect candidate lead items from archived homepages (Wayback Machine).
Usage: python -I collect_leads.py <outlets_dir> <out_json> [outlet_id ...]
Snapshot target: 08:00 UTC (10:00 Warsaw, CEST) on each sample day. Accepts the
closest snapshot within +/- 6 h; otherwise records 'no-snapshot'."""
import json, sys, os, re, html, time, ssl, urllib.request, urllib.error, urllib.parse, datetime
DAYS = ["2026-10-05","2026-10-07","2026-10-12","2026-10-14","2026-10-15",
        "2026-10-17","2026-10-18","2026-10-19","2026-10-22","2026-10-27"]
UA = {"User-Agent": "punkt-widzenia-research/0.1"}
# Python 3.13+ enables VERIFY_X509_STRICT by default; the local CA chain fails it
# ("Basic Constraints of CA cert not marked critical"). Normal chain/hostname
# verification stays on; only the strict RFC 5280 extension check is relaxed.
CTX = ssl.create_default_context(); CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT
PACE = 4  # seconds between requests; archive.org returns 429 when pushed
def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60, context=CTX) as r:
                time.sleep(PACE)
                return r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            err = e
            ra = e.headers.get("Retry-After", "")
            time.sleep(int(ra) if ra.isdigit() else (60 * (i + 1) if e.code == 429 else 5 * (i + 1)))
        except Exception as e:
            err = e; time.sleep(5 * (i + 1))
    raise err
def candidates(page, base_host):
    out, seen = [], set()
    for m in re.finditer(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S | re.I):
        href, txt = m.group(1), html.unescape(re.sub(r"<[^>]+>|\s+", " ", m.group(2))).strip()
        if len(txt) < 35 or len(txt) > 260: continue
        href = re.sub(r"^https?://web\.archive\.org/web/\d+[a-z_]*/", "", href)
        if href.startswith("/"): href = "https://" + base_host + href
        key = txt.lower()
        if key in seen: continue
        seen.add(key); out.append({"title": txt, "url": href})
        if len(out) >= 25: break
    return out
def main():
    odir, outp, only = sys.argv[1], sys.argv[2], sys.argv[3:]
    res = json.load(open(outp, encoding="utf-8")) if os.path.exists(outp) else {}
    for f in sorted(os.listdir(odir)):
        d = json.load(open(os.path.join(odir, f), encoding="utf-8"))
        oid = d["id"]
        if only and oid not in only: continue
        host = urllib.parse.urlparse(d["url"]).netloc
        for day in DAYS:
            k = f"{oid}|{day}"
            if k in res and res[k].get("status") == "ok": continue
            ts = day.replace("-", "") + "080000"
            try:
                av = json.loads(get(f"https://archive.org/wayback/available?url={urllib.parse.quote(d['url'])}&timestamp={ts}"))
                snap = av.get("archived_snapshots", {}).get("closest")
                st = snap["timestamp"] if snap else None
                dt = abs((datetime.datetime.strptime(st, "%Y%m%d%H%M%S") - datetime.datetime.strptime(ts, "%Y%m%d%H%M%S")).total_seconds()) if st else None
                if not st:
                    res[k] = {"status": "no-snapshot"}
                elif dt > 6 * 3600:
                    res[k] = {"status": "no-snapshot", "closest": st}
                else:
                    page = get(f"https://web.archive.org/web/{st}id_/{d['url']}")
                    res[k] = {"status": "ok", "snapshot": st, "candidates": candidates(page, host)}
            except Exception as e:
                res[k] = {"status": "error", "error": str(e)[:200]}
            json.dump(res, open(outp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(k, res[k]["status"], flush=True)
            time.sleep(2)
main()
