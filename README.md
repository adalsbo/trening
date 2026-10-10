# Trening – Atle og Audny

Ein enkel treningsapp (PWA) for styrketrening heime: dagens økt, logg, kviletimar, framgang og øvingsguide med video.
Appen ligg på **https://adalsbo.github.io/trening/**.

## Installere på iPhone/iPad
Opne adressa i Safari → trykk Del-knappen → «Legg til på Heim-skjerm».

## Om dataa dykkar
Loggen blir berre lagra på eininga (iPhone/iPad), aldri på GitHub. Ta jamleg reservekopi under **Meir → Reservekopi**,
og bruk den same fila for å flytte loggen mellom iPhone og iPad. Eksport til CSV og Excel finst òg under **Meir**.

## Oppdatere programmet
Programdataa (`data/program.json`) blir laga frå arbeidsboka i Excel – ikkje rett dei for hand.

1. Endre arbeidsboka (`treningsprogram_v2.xlsx`) og eventuelt videolista (`ovingar_video.json`).
2. Lag nye data for den offentlege versjonen:
   ```
   python3 scripts/build_data.py --offentleg /sti/til/treningsprogram_v2.xlsx /sti/til/ovingar_video.json
   ```
   (Krev Python 3 med `openpyxl`. `--offentleg` tek bort startvekt og brukar ei privat regelfil,
   `/workspace/build/offentleg_erstatt.json` på boksen, som skriv om helseopplysningar. Den fila skal ikkje inn i repoet.)
3. Ved endringar i andre filer enn `data/program.json`: auk `VERSJON` i `sw.js` (t.d. `treningsapp-v6`), elles kan appen halde fram med gamle filer.
4. Last opp:
   ```
   git add -A && git commit -m "Oppdatert program" && git push
   ```
5. GitHub Pages byggjer på nytt på 1–2 minutt. Lukk og opne appen att for å få den nye versjonen.

## Innhald
- `index.html`, `css/`, `js/app.js` – sjølve appen (rein HTML/CSS/JS, ingen byggjesteg)
- `data/program.json` – program, kalender, progresjonsreglar og øvingsguide
- `sw.js` – service worker, gjer at appen verkar utan nett
- `vendor/xlsx.mini.min.js` – SheetJS for Excel-eksport (lisens i `vendor/SHEETJS-LICENSE.txt`)
- `scripts/build_data.py` – lagar `data/program.json` frå arbeidsboka

Dette er eit generelt treningsopplegg, ikkje medisinsk behandling.
