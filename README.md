# bills

Offerten und Rechnungen (mit Swiss QR-Rechnung) im Browser erstellen. Statische Astro-Seite, keine Backend-Abhängigkeit, alle Daten bleiben im localStorage.

## Verwendung

```sh
cp .env.example .env   # dort echte Adresse/IBAN eintragen, .env ist gitignored
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # statischer Output in dist/
```

`.env` enthält die persönlichen Standardwerte (Name, Adresse, IBAN, E-Mail, siehe `.env.example`) und wird nie committet. Bei CI/Deployment die gleichen Variablen als Secrets setzen (z.B. GitHub Actions `secrets.PUBLIC_DEFAULT_IBAN` usw.), nicht im Repo hinterlegen.

Das Layout folgt der [usgc-invoice](https://github.com/usgraphics/usgc-invoice) Vorlage (BSD-3) von U.S. Graphics Company; als Schrift dient selbst gehostetes New Computer Modern Mono. "Neues Dokument" übernimmt alle Eingaben des aktuellen Dokuments (neue Nummer und Daten), Absenderfelder fallen bei leeren Werten auf die Standardwerte zurück.

Links Dokument bearbeiten (Kunde, Positionen, Texte), rechts die A4-Vorschau. Ein Dokument teilt sich alle Daten zwischen Offerte und Rechnung; die beiden Buttons oben rechts öffnen den Browser-Druckdialog im jeweiligen Modus, dort "Als PDF speichern" wählen. Die Rechnung enthält den QR-Zahlteil (Empfangsschein + Zahlteil, via [swissqrbill](https://github.com/schoero/swissqrbill)) am unteren Blattrand.

Absender, IBAN, MWST-Nr. usw. unter "Absender & IBAN" im Formular; ohne eigene `.env`-Werte übernimmt ein neuer Browser beim ersten Laden das Beispieldokument aus `src/lib/example-document.yaml` (inkl. Absender), sobald noch nichts im localStorage liegt. Eigene Standardwerte (z.B. für ein selbst gehostetes Deployment) weiterhin über `.env` (`defaultSettings` in `src/lib/types.ts`) setzen, die haben Vorrang vor dem Beispiel.

Hinweis: Die hinterlegte IBAN ist eine normale IBAN (keine QR-IBAN), daher wird keine QR-Referenz erzeugt; die Rechnungsnummer steht im Feld "Zusätzliche Informationen".
