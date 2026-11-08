"""Aggregate hand-coded sample items per outlet (see CODEBOOK.md).
Usage: python -I aggregate.py <coding_dir> <outlets_dir> <out_json>"""
import json, os, sys
RANK = ["government-aligned", "leans-government", "independent-mixed", "leans-opposition", "opposition-aligned"]
def main():
    cdir, odir, outp = sys.argv[1:4]
    res = {}
    for f in sorted(os.listdir(cdir)):
        if not f.endswith(".json"): continue
        c = json.load(open(os.path.join(cdir, f), encoding="utf-8"))
        oid = c["outlet"]; items = c["items"]
        P = [i for i in items if i["headline"] != "na"]
        g = sum(i["headline"] == "pro-gov" for i in P); o = sum(i["headline"] == "pro-opp" for i in P)
        n = len(P)
        side, hi, lo = ("government", g, o) if g >= o else ("opposition", o, g)
        share = hi / n if n else 0
        if n < 10: value = None
        elif share >= 2 / 3: value = f"{side}-aligned?"   # needs structural/audience indicator
        elif share > 0.5 and lo <= hi / 4: value = f"leans-{side}"
        else: value = "independent-mixed"
        cur = json.load(open(os.path.join(odir, oid + ".json"), encoding="utf-8"))["leaning"]["polish"]["value"]
        res[oid] = {"items": len(items), "political": n, "proGov": g, "proOpp": o,
                    "oneSidedShare": round(share, 2), "sampleValue": value, "currentValue": cur}
        print(f"{oid:22} n={len(items):2} P={n:2} gov={g:2} opp={o:2} share={share:.2f} sample={value} current={cur}")
    json.dump(res, open(outp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
main()
