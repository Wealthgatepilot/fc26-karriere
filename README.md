# FC 26 Karriere-Helfer

Mobile-first PWA für den Karrieremodus von EA SPORTS FC 26.
Reines HTML/CSS/JS, **kein Build-Schritt**, läuft über GitHub Pages und ist offline-/installierbar.

## Funktionen
- **Suche:** alle Spieler frei durchsuchbar, mit Namensvorschlägen. Akzentunempfindlich („mbappe“ findet Mbappé), Nachname allein genügt.
- **Datenbank:** Filter wie im Spiel – Position, Alter, Overall, Potenzial, Liga, Nation, Verein, Fuß, schwacher Fuß, Skill Moves, Wert- und Gehaltsobergrenze; sortierbar u. a. nach Wachstum (POT − OVR). Voreinstellung **Wonderkids** = bis 21 Jahre mit Potenzial 85+.
- **Team:** **Verein laden** holt einen kompletten Kader mit dem Datenbank-Stand zum Spielstart (ersetzen oder ergänzen). **Elf aufstellen** besetzt die Startelf automatisch: alle Platz-Spieler-Paare werden bewertet (Overall + Bonus für die erstgenannte Position − Abzug fürs Aushelfen) und global nach Punktzahl vergeben, statt Platz für Platz – sonst schnappt der frühe Außenverteidiger-Platz einen Mittelfeldspieler weg. Dazu acht Formationen, farbige Positions-Eignung und eine Auswertung (Ø Overall, Altersschnitt, Wachstumsreserve, Stärke je Mannschaftsteil, Warnung bei Unterbesetzung).
- **Jugend:** eigene Akademie-Spieler mit Werten und Potenzial pflegen (auch als Bereich, wenn nur der Scout-Text bekannt ist), Entwicklung über Saisons verfolgen und mit der Datenbank vergleichen. **Eigene Spieler entstehen ausschließlich hier** und werden mit „⬆️ Hochziehen“ in den Seniorenkader übernommen – wie im Spiel erst **ab 16 Jahren**, jüngere sind mit „⏳ ab 16“ markiert. Spätere Änderungen und Saison-Einträge wandern automatisch in den Team-Tab mit.
- **Potenzial:** was die Texte im Kadermenü zahlenmäßig bedeuten, plus Rechner in beide Richtungen.
- **Backup:** Export/Import als JSON. Daten liegen lokal im `localStorage`.

## Dateien
| Datei | Zweck |
|-------|-------|
| `index.html`, `style.css`, `app.js` | App |
| `data.js` | Potenzial-Stufen, Formationen, Standardwerte (von Hand pflegbar) |
| `fcdata.js` | Auto-generierte Spielerdatenbank |
| `manifest.json`, `sw.js`, `icon.svg` | PWA / Offline |
| `tools/generate-fcdata.ps1` | Generator für `fcdata.js` |
| `tools/serve.ps1` | lokale Vorschau |

## `fcdata.js` neu erzeugen

```powershell
powershell -ExecutionPolicy Bypass -File tools/generate-fcdata.ps1
```

Die CSV wird nach `%TEMP%\eafc26-cache` geladen und dort wiederverwendet; `-Refresh` erzwingt einen Neu-Download,
`-MaxRows 200` erzeugt einen kleinen Testauszug.

## Datenquellen
Spielerwerte aus dem öffentlichen Datensatz [EAFC26-DataHub](https://github.com/ismailoksuz/EAFC26-DataHub)
(Ursprung: Kaggle *FC 26 (FIFA 26) Player Data*), Stand **FC 26, 19.09.2025** – also der Zustand zum Spielstart.

> ⚠️ Das ist eine Community-Extraktion, **keine offizielle EA-Datei**. Einzelne Werte können abweichen.

Die Potenzial-Textstufen stammen aus Karrieremodus-Guides (fifa-karriere.com, bestetipps.de, Sportskeeda,
GamesRadar, FIFA Infinity). Deutsche und englische Quellen widersprechen sich an den Rändern um einen Punkt –
die betroffenen Grenzwerte sind in der App als unsicher markiert und lassen sich in `data.js` korrigieren.

## Lokale Vorschau

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8124
```
