"""PUN-9: apply reliability fact-check sweep results (dataset v0.5.0).

Idempotent only on first run: it acts on records whose reliability rationale
still starts with the "Ocena wstępna" prefix.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "data"
DATE = "2026-11-08"
PREFIX = ("Ocena wstępna: opiera się tylko na naszym sprawdzeniu strony redakcji, "
          "bez przeglądu fact-checkerów; zostanie uzupełniona w kolejnej wersji. ")
NOFC = ("Fact-checkerzy (Demagog, AFP Sprawdzam, FakeNews.pl) i Rada Etyki Mediów: "
        "nie znaleziono wykazanych fałszywych informacji tej redakcji z ostatnich "
        "24 miesięcy (przegląd 2026-11-08). ")
CORR = ("Brak opublikowanej polityki korekt na stronie (sprawdzenie 2026-11-08); "
        "sprostowania wymagane prawem prasowym. ")
K = "krrit-sprawozdanie-2025"

NEW_SOURCES = [
    {"id": K,
     "title": "Sprawozdanie Krajowej Rady Radiofonii i Telewizji z działalności w 2025 roku "
              "(druk sejmowy nr 2725; rozdz. 2.1.4: kary i upomnienia; załącznik nr 2: "
              "wykaz decyzji o ukaraniu)",
     "publisher": "Krajowa Rada Radiofonii i Telewizji / Sejm RP",
     "url": "https://api.sejm.gov.pl/sejm/term10/prints/2725/2725.pdf",
     "date": "2026-05-29", "accessed": DATE, "type": "regulator"},
    {"id": "demagog-republika-2024",
     "title": "Prawdziwe polskie wiadomości, czyli jak Republika i wPolsce24 opowiadają "
              "o świecie. Raport Demagoga (próbka: październik 2024)",
     "publisher": "Stowarzyszenie Demagog",
     "url": "https://demagog.org.pl/analizy_i_raporty/prawdziwe-polskie-wiadomosci-czyli-jak-republika-i-wpolsce24-opowiadaja-o-swiecie-raport-demagoga/",
     "date": "2024-11-21", "accessed": DATE, "type": "factcheck"},
    {"id": "wprost-zero-schnepf-2026",
     "title": "Burza wokół Wysockiej-Schnepf i Stanowskiego. Sąd nie miał wątpliwości "
              "(Sąd Apelacyjny w Warszawie oddala zażalenie na zabezpieczenie)",
     "publisher": "Wprost", "url": "https://www.wprost.pl/12302442",
     "date": "2026-04-14", "accessed": DATE, "type": "press"},
]

# id -> (factualRecord, contested, rationale.pl, sourceIds to add, changelog note)
EXTERNAL = {
    "telewizja-republika": (1, True,
        "Rzetelność faktów: 1. Sprawozdanie KRRiT za 2025 r.: 10 decyzji o karze (157,5 tys. zł), "
        "w tym 2 za treści nawołujące do nienawiści (art. 18 ust. 1, decyzje 1/DPz/2025 i 4/DPz/2025, "
        "po 40 tys. zł); pozostałe dotyczyły reklam, udogodnień dla osób z niepełnosprawnościami "
        "i kwot europejskich. Ponadto 3 upomnienia dotyczące rzetelności i obiektywizmu audycji "
        "informacyjnych. Raport Demagoga (listopad 2024, próbka z października 2024) wskazał "
        "wprowadzające w błąd treści w programie „Dzisiaj” (m.in. nieprawdziwe twierdzenie o sędziach "
        "powołanych w okresie stalinowskim) i nie odnotował korekt. Ocena sporna: dowody mieszczą się "
        "między 0 a 1 pkt. " + CORR +
        "Przejrzystość: podany zarząd i redaktor naczelny, brak informacji o akcjonariacie na stronie.",
        [K, "demagog-republika-2024"], "przegląd zewnętrzny (KRRiT 2025, Demagog)"),
    "tvn24": (2, False,
        "Sprawozdanie KRRiT za 2025 r.: wobec TVN S.A. 1 decyzja o karze (20 tys. zł, niezgłoszenie "
        "kanału „Superwizjer” w YouTube do wykazu usług – naruszenie formalne, nie dotyczy treści) "
        "oraz 2 upomnienia dotyczące rzetelności i obiektywizmu (spółka TVN; sprawozdanie nie wskazuje "
        "kanału). Według zestawienia wyroków dołączonego do sprawozdania sądy w 2026 r. uchyliły kary "
        "KRRiT za reportaże TVN24 „Siła kłamstwa” (550 tys. zł) i „29 lat bezkarności” (142,8 tys. zł, "
        "wyrok nieprawomocny). " + NOFC + CORR +
        "Przejrzystość: nie znaleziono stopki redakcyjnej ani strony „o nas” TVN24 (strony zwracały "
        "błąd 404).",
        [K], "przegląd zewnętrzny (KRRiT 2025, wyroki sądów)"),
    "polskie-radio": (2, False,
        "Sprawozdanie KRRiT za 2025 r.: brak decyzji o karze wobec Polskiego Radia; 1 upomnienie "
        "dotyczące ochrony małoletnich (nie dotyczy rzetelności informacji). " + NOFC + CORR +
        "Przejrzystość: nie znaleziono stopki redakcyjnej serwisu informacyjnego.",
        [K], "przegląd zewnętrzny (KRRiT 2025)"),
    "radio-zet": (2, False,
        "Sprawozdanie KRRiT za 2025 r.: brak decyzji o karze i upomnień wobec Radia ZET. Według "
        "zestawienia wyroków dołączonego do sprawozdania Sąd Apelacyjny w Warszawie w marcu 2025 r. "
        "prawomocnie utrzymał uchylenie kary 476 tys. zł, nałożonej w 2023 r. za rzekomą dezinformację "
        "o przejeździe prezydenta Ukrainy; sąd I instancji uznał, że nadawca dochował rzetelności. "
        + NOFC + CORR +
        "Przejrzystość: podany wydawca; nie znaleziono stopki redakcyjnej z redaktorem naczelnym.",
        [K], "przegląd zewnętrzny (KRRiT 2025, wyrok sądu)"),
    "radio-maryja": (2, False,
        "Sprawozdanie KRRiT za 2025 r.: brak decyzji o karze i upomnień wobec Radia Maryja (jedno "
        "postępowanie skargowe). Ostatnia znaleziona kara KRRiT (2012, ukryta reklama) wykracza poza "
        "okres 24 miesięcy. " + NOFC + CORR +
        "Przejrzystość: strona kontaktowa podaje instytucje powiązane; nie znaleziono informacji "
        "o finansowaniu i stopki redakcyjnej.",
        [K], "przegląd zewnętrzny (KRRiT 2025); zdjęto status sporny wynikający z braku przeglądu"),
    "radio-wnet": (2, False,
        "Sprawozdanie KRRiT za 2025 r.: brak decyzji o karze i upomnień wobec Radia WNET. " + NOFC + CORR +
        "Przejrzystość: redaktor naczelny i zespół podani; brak informacji o udziałowcach i finansowaniu.",
        [K], "przegląd zewnętrzny (KRRiT 2025); zdjęto status sporny wynikający z braku źródła zewnętrznego"),
    "super-express": (1, True,
        "Rzetelność faktów: 1. Sprawozdanie KRRiT za 2025 r.: kara 109 tys. zł dla wydawcy (Time S.A., "
        "decyzja DMM-116/2025 z 29.04.2025) za treści dyskryminujące ze względu na religię lub "
        "przekonania w audycji „Nocna zmiana” w kanale Super Expressu w YouTube oraz upomnienie "
        "dotyczące rzetelności i obiektywizmu dla tego kanału. Metodologia wymienia kary KRRiT "
        "w przedziale 0 pkt, ale kara nie dotyczyła nieprawdziwych informacji, a decyzje nie dotyczą "
        "wydania drukowanego ani se.pl – stąd 1 pkt i status sporny. Fact-checkerzy (Demagog, AFP "
        "Sprawdzam, FakeNews.pl): nie znaleziono wykazanych fałszywych informacji z ostatnich "
        "24 miesięcy. " + CORR +
        "Przejrzystość: podany wydawca, redaktor naczelny i zespół; materiały sponsorowane oznaczone.",
        [K], "przegląd zewnętrzny (KRRiT 2025): rzetelność faktów 2 → 1, ocena łączna wysoka → mieszana (sporne)"),
    "kanal-zero": (2, False,
        "Sprawozdanie KRRiT za 2025 r.: 4 postępowania wobec Kanału Zero jako platformy wideo, bez kary "
        "i bez upomnienia. W listopadzie 2025 r. Sąd Okręgowy w Warszawie udzielił zabezpieczenia "
        "w procesie o ochronę dóbr osobistych wytoczonym przez Dorotę Wysocką-Schnepf przeciw Kanałowi "
        "Zero i jego dziennikarzom; Sąd Apelacyjny oddalił zażalenie w kwietniu 2026 r. To "
        "zabezpieczenie, nie wyrok co do istoty sprawy. " + NOFC + CORR +
        "Przejrzystość: redaktor naczelna Zero.pl podana; brak informacji o właścicielu i finansowaniu "
        "na stronie.",
        [K, "wprost-zero-schnepf-2026"], "przegląd zewnętrzny (KRRiT 2025, postępowanie sądowe)"),
    "do-rzeczy": (2, False,
        "Demagog (kwiecień 2026) wskazał nagłówki „Do Rzeczy”, które przedstawiały jego oceny w sposób "
        "publicystyczny i sugerowały inną wymowę fact-checków, ale nie wykazał fałszywych informacji "
        "faktograficznych. Nie znaleziono przegranych procesów ani stanowisk Rady Etyki Mediów "
        "z ostatnich 24 miesięcy. " + CORR + "Przejrzystość: podany wydawca i redaktor naczelny.",
        ["demagog-media-2026"], "przegląd zewnętrzny (Demagog 2026)"),
}


def label(total):
    return "high" if total >= 5 else "mixed" if total >= 3 else "low"


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


sp = ROOT / "sources.json"
sources = json.loads(sp.read_text(encoding="utf-8"))
have = {s["id"] for s in sources}
sources += [s for s in NEW_SOURCES if s["id"] not in have]
dump(sp, sources)

done, prov = [], []
for f in sorted((ROOT / "outlets").glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    r = d["reliability"]
    if not r["rationale"]["pl"].startswith("Ocena wstępna"):
        continue
    oid = d["id"]
    if oid in EXTERNAL:
        fr, contested, text, add, note = EXTERNAL[oid]
        r["factualRecord"] = fr
        r["total"] = fr + r["corrections"] + r["transparency"]
        r["label"] = label(r["total"])
        r["contested"] = contested
        r["rationale"]["pl"] = text
        r["sourceIds"] = list(dict.fromkeys(r["sourceIds"] + add))
        r.pop("provisional", None)
        pl = f"Wersja 0.5.0: wiarygodność – {note}; usunięto oznaczenie „wstępna”."
        en = "v0.5.0: reliability backed by external sources; provisional flag removed."
        done.append(oid)
    else:
        r["rationale"]["pl"] = r["rationale"]["pl"].replace(PREFIX, "", 1)
        r["provisional"] = True
        pl = ("Wersja 0.5.0: przegląd fact-checkerów, KRRiT, Rady Etyki Mediów i orzeczeń nie przyniósł "
              "źródła zewnętrznego dotyczącego tej redakcji; ocena pozostaje wstępna.")
        en = "v0.5.0: fact-check sweep found no outlet-specific external source; rating stays provisional."
        prov.append(oid)
    r["asOf"] = DATE
    d["lastReviewed"] = DATE
    d["changelog"].append({"date": DATE, "change": {"pl": pl, "en": en}})
    dump(f, d)

mp = ROOT / "meta.json"
m = json.loads(mp.read_text(encoding="utf-8"))
m["datasetVersion"] = "0.5.0"
m["updated"] = DATE
dump(mp, m)
print("external:", len(done), done)
print("provisional:", len(prov), prov)
