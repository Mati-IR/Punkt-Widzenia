"""Deterministic item selection for the §3.3 content sample (same rule for every outlet).
Usage: python -I select_items.py <leads_raw.json> <out_items.json>

Leads (10): for each sample day, the first homepage candidate that is not
non-news (sport/showbiz/lifestyle subdomains, shop, horoscope). Missing day ->
recorded as 'no-snapshot'; substitute = first unused candidate from the nearest
sampled day (recorded as substitute).

Comparative (10): 2 items per topic, chosen from all homepage candidates in the
sample window (5-27 Oct 2026), in date order then page position, excluding items
already used as leads. An item counts for the first topic whose keywords match its
title (topic order below). If fewer than 2 match, the gap is recorded as
'site-search-needed' and filled by hand from the outlet's site search with the
query and date recorded in coding notes.
"""
import json, re, sys
TOPICS = [
 ("budget-taxes", r"\bbudżet|\bpodat|\bdeficyt|\bVAT\b|\bPIT\b|\bCIT\b|\bskładk|\bdług\w* publiczn|\bfinans\w* publiczn"),
 ("rule-of-law", r"\bsąd|\bsędz|\bpraworządn|\bKRS\b|\bTrybuna\w+ Konstytucyjn|\bTK\b|\bprokurat|\bŻurek|\bneosędz"),
 ("migration", r"\bmigra|\bimigra|\bmigrant|\buchodźc|\bgranic\w* z Białoru|\bpakt\w* migracyjn|\bazyl"),
 ("eu", r"\bUE\b|\bUni[ia] Europejsk|\bBruksel|\bKomisj\w+ Europejsk|\bKPO\b|\bMercosur|\bParlament\w* Europejsk|\bunijn"),
 ("current-dispute", r"\bwet[oa]\b|\bwetuje|\bzawetow|\bNawrock\w*.{0,40}\b(rząd|Tusk|ustaw)|\b(rząd|Tusk)\w*.{0,40}\bNawrock"),
]
NON_NEWS = re.compile(r"//(sport|rozrywka|plotek|kobieta|pudelek|horoskop|gry|sklep|moto|kultura)\.|/(sport|horoskop|rozrywka|show-?biznes|lifestyle)/", re.I)
CLEAN = re.compile(r"^(\d+\s+(minut|godzin\w*|dni)\s+temu\s+)?(Artykuł|Wideo|Podcast|Galeria)?\s*", re.I)
def clean(t):
    t = re.sub(r"\s{2,}.*?\d{1,2}:\d{2}$", "", t)          # trailing date/time stamps
    t = re.sub(r"\s{3,}(Opinie|Kraj|Świat|Polityka)\s.*$", "", t)
    return CLEAN.sub("", t).strip()
def main():
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    outlets = sorted({k.split("|")[0] for k in raw})
    out = {}
    for o in outlets:
        days = sorted(k.split("|")[1] for k in raw if k.startswith(o + "|"))
        used, items, gaps = set(), [], []
        pool = []
        for d in days:
            e = raw[f"{o}|{d}"]
            if e.get("status") != "ok": continue
            for pos, c in enumerate(e["candidates"]):
                if NON_NEWS.search(c["url"]): continue
                pool.append({"date": d, "pos": pos, "title": clean(c["title"]), "url": c["url"]})
        for d in days:
            e = raw[f"{o}|{d}"]
            day_pool = [p for p in pool if p["date"] == d and p["url"] not in used]
            if e.get("status") == "ok" and day_pool:
                p = day_pool[0]; used.add(p["url"])
                items.append({**p, "kind": "lead"})
            else:
                gaps.append({"date": d, "status": e.get("status", "missing")})
        for g in gaps:  # substitute from nearest sampled day
            for p in sorted(pool, key=lambda p: (abs(int(p["date"][-2:]) - int(g["date"][-2:])), p["pos"])):
                if p["url"] not in used:
                    used.add(p["url"]); items.append({**p, "kind": "lead", "substituteFor": g["date"]}); break
        for name, rx in TOPICS:
            got = 0
            for p in pool:
                if got == 2: break
                if p["url"] in used: continue
                first = next((n for n, r in TOPICS if re.search(r, p["title"], re.I if n != "eu" else 0)), None)
                if first == name:
                    used.add(p["url"]); items.append({**p, "kind": "comparative", "topic": name}); got += 1
            if got < 2: gaps.append({"topic": name, "status": "site-search-needed", "missing": 2 - got})
        out[o] = {"items": items, "gaps": gaps,
                  "daysOk": sum(raw[f"{o}|{d}"].get("status") == "ok" for d in days), "daysTotal": len(days)}
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for o, v in out.items():
        print(o, "items", len(v["items"]), "daysOk", v["daysOk"], "/", v["daysTotal"], "gaps", [g.get("topic") or g["date"] for g in v["gaps"]])
main()
