# FC 26 Karriere-Helfer

Mobile-first PWA für den Karrieremodus von EA SPORTS FC 26.
Reines HTML/CSS/JS, **kein Build-Schritt**, läuft über GitHub Pages und ist offline-/installierbar.

## Funktionen
- **Suche:** alle Spieler frei durchsuchbar, mit Namensvorschlägen. Akzentunempfindlich („mbappe“ findet Mbappé), Nachname allein genügt.
- **Datenbank:** Filter wie im Spiel – Position, Alter, Overall, Potenzial, Liga, Nation, Verein, Fuß, schwacher Fuß, Skill Moves, Wert- und Gehaltsobergrenze; sortierbar u. a. nach Wachstum (POT − OVR). Voreinstellung **Wonderkids** = bis 21 Jahre mit Potenzial 85+.
- **Team:** **Verein laden** holt einen kompletten Kader mit dem Datenbank-Stand zum Spielstart (ersetzen oder ergänzen). Einzelne Spieler kommen wahlweise **aus der Datenbank** (Suchdialog) oder werden **neu erstellt** – für Regens und Newgens, die es zum Karrierestart noch nicht gab. **Elf aufstellen** besetzt die Startelf automatisch: alle Platz-Spieler-Paare werden bewertet (Overall + Bonus für die erstgenannte Position − Abzug fürs Aushelfen) und global nach Punktzahl vergeben, statt Platz für Platz – sonst schnappt der frühe Außenverteidiger-Platz einen Mittelfeldspieler weg. Dazu acht Formationen, farbige Positions-Eignung und eine Auswertung (Ø Overall, Altersschnitt, Wachstumsreserve, Stärke je Mannschaftsteil, Warnung bei Unterbesetzung).
- **Jugend:** eigene Akademie-Spieler mit Werten und Potenzial pflegen (auch als Bereich, wenn nur der Scout-Text bekannt ist), Entwicklung über Saisons verfolgen und mit der Datenbank vergleichen. Talente werden mit „⬆️ Hochziehen“ in den Seniorenkader übernommen – wie im Spiel erst **ab 16 Jahren**, jüngere sind mit „⏳ ab 16“ markiert. Spätere Änderungen und Saison-Einträge wandern automatisch in den Team-Tab mit.
- **Potenzial:** was die Texte im Kadermenü zahlenmäßig bedeuten, plus Rechner in beide Richtungen.
- **Leihe:** Eigener Unterreiter im Team-Tab. Markiert Spieler als verliehen, trägt nach Rückkehr oder Abbruch den Overall- und Potenzial-Zuwachs ein (auch negativ) und zählt die Leihen je Spieler mit. Dazu eine nach Luft nach oben und Alter sortierte Kandidatenliste und die Schritt-für-Schritt-Anleitung zum Leih-Glitch samt Warnung, dass es ein Bug ist.
- **Karriere-Stände:** Oben im Kopf lässt sich zwischen mehreren Karrieren umschalten – jede mit eigenem Kader, eigener Aufstellung und eigenen Talenten. Anlegen, umbenennen, kopieren, löschen. Gespeichert wird automatisch, kein JSON-Hin-und-Her nötig.
- **Potenzial als Zahl oder Text:** Überall, wo du ein Potenzial einträgst, kannst du entweder die genaue Zahl (Scout-Bericht) oder den Text aus dem Kadermenü angeben – der Text wird in seinen Zahlenbereich übersetzt und als solcher angezeigt (z. B. `85–89`).
- **Backup:** Export/Import als JSON. Der Export enthält die aktive Karriere; beim Import wählst du, ob sie als **neue** Karriere angelegt oder die aktuelle überschrieben wird. Daten liegen lokal im `localStorage`.

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

Die Schritte zum Leih-Glitch stammen von [earlygame.com](https://earlygame.com/de/guides/fifa/ea-fc-26-karrieremodus-loan-glitch-erklaert-so-entwickelst-du-jeden-jugendspieler-zum-weltklasse-talent)
und soccergaming.com; beim idealen Kandidaten widersprechen sich die beiden, was in der App auch so dasteht.

Die Potenzial-Textstufen stammen aus Karrieremodus-Guides (fifa-karriere.com, bestetipps.de, Sportskeeda,
GamesRadar, FIFA Infinity). Deutsche und englische Quellen widersprechen sich an den Rändern um einen Punkt –
die betroffenen Grenzwerte sind in der App als unsicher markiert und lassen sich in `data.js` korrigieren.

## Lokale Vorschau

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8124
```
