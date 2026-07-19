# bills

Offerten und Rechnungen (mit Swiss QR-Rechnung) im Browser erstellen. Statische Astro-Seite, keine Backend-Abhängigkeit, alle Daten bleiben im localStorage.

## Verwendung

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # statischer Output in dist/
```

Links Dokument bearbeiten (Kunde, Positionen, Texte), rechts die A4-Vorschau. Ein Dokument teilt sich alle Daten zwischen Offerte und Rechnung; die beiden Buttons oben rechts öffnen den Browser-Druckdialog im jeweiligen Modus, dort "Als PDF speichern" wählen. Die Rechnung enthält den QR-Zahlteil (Empfangsschein + Zahlteil, via [swissqrbill](https://github.com/schoero/swissqrbill)) am unteren Blattrand.

Absender, IBAN, MWST-Nr. usw. unter "Absender & IBAN" im Formular; Standardwerte sind in `src/lib/types.ts` (`defaultSettings`) hinterlegt.

Hinweis: Die hinterlegte IBAN ist eine normale IBAN (keine QR-IBAN), daher wird keine QR-Referenz erzeugt; die Rechnungsnummer steht im Feld "Zusätzliche Informationen".
