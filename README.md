# FC 26 Karriere-Helfer

Mobile-first PWA für den Karrieremodus von EA SPORTS FC 26.
Reines HTML/CSS/JS, **kein Build-Schritt**, läuft über GitHub Pages und ist offline-/installierbar.

## Funktionen
- **Suche:** alle Spieler frei durchsuchbar, mit Namensvorschlägen. Akzentunempfindlich („mbappe“ findet Mbappé), Nachname allein genügt.
- **Datenbank:** Filter wie im Spiel – Position, Alter, Overall, Potenzial, Liga, Nation, Verein, Fuß, schwacher Fuß, Skill Moves, Wert- und Gehaltsobergrenze; sortierbar u. a. nach Wachstum (POT − OVR). Voreinstellung **Wonderkids** = bis 21 Jahre mit Potenzial 85+.
- **Team:** **Verein laden** holt einen kompletten Kader mit dem Datenbank-Stand zum Spielstart (ersetzen oder ergänzen). Einzelne Spieler kommen wahlweise **aus der Datenbank** (Suchdialog) oder werden **neu erstellt** – für Regens und Newgens, die es zum Karrierestart noch nicht gab. **Elf aufstellen** besetzt die Startelf automatisch: alle Platz-Spieler-Paare werden bewertet (Overall + Bonus für die erstgenannte Position − Abzug fürs Aushelfen) und global nach Punktzahl vergeben, statt Platz für Platz – sonst schnappt der frühe Außenverteidiger-Platz einen Mittelfeldspieler weg. Dazu acht Formationen, farbige Positions-Eignung und eine Auswertung (Ø Overall, Altersschnitt, Wachstumsreserve, Stärke je Mannschaftsteil, Warnung bei Unterbesetzung).
- **Jugend:** eigene Akademie-Spieler mit Werten und Potenzial pflegen – als genaue Zahl, als **Spanne aus dem Scout-Bericht** (z. B. 78–91) oder über den Text aus dem Kadermenü. Entwicklung über Saisons verfolgen und mit der Datenbank vergleichen. Mit „⬆️ Hochziehen“ **wandert** der Spieler in den Seniorenkader – wie im Spiel erst **ab 16 Jahren**, jüngere sind mit „⏳ ab 16“ markiert. Er verlässt dabei die Jugendliste, Potenzial-Spanne und Saison-Verlauf reisen mit.
- **Potenzial-Umrechnung:** Die Texte aus dem Kadermenü sind direkt dort eingebaut, wo sie gebraucht
  werden – als Auswahlfeld in den Formularen (Text → Zahlenbereich) und im Detail-Fenster eines
  Datenbank-Spielers (Zahl → Text). Die Stufen stehen editierbar in `data.js`.
- **Tabellen-Ansicht:** Kader und Jugend stehen als Tabelle **Pos · Name · OVR › POT · ⋮**.
  Die Rating-Zelle zeigt beides („74 › 84“, bei einer Spanne „63 › 80–92“); ist das Potenzial
  erreicht, steht nur die eine Zahl da. Ein Klick auf
  „Pos“ sortiert in der Reihenfolge, die EA selbst benutzt (GK, RB, CB, LB, CDM, RM, CM, LM, CAM,
  RW, LW, ST), ein zweiter Klick dreht sie um; „OVR“ sortiert erst den schwächsten nach oben, beim
  zweiten Klick den stärksten. Namen erscheinen als „T. Müller“ – außer bei ostasiatischer
  Namensreihenfolge, dort bleibt der Name ganz. Ein Tipp auf den Namen öffnet die Info-Ansicht
  (alle Werte, Sterne, Wachstumsbalken, Leih- und Saison-Verlauf, Notiz), das ⋮ das Aktionsmenü.
  Verliehene Spieler sind gelb hinterlegt.
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
18.405 Spieler, 662 Vereine, 51 Ligen; jeder Verein mit mindestens 16 Spielern.

> ⚠️ Das ist eine Community-Extraktion, **keine offizielle EA-Datei**. Einzelne Werte können abweichen.
> Weil es ein Foto vom Spielstart ist, fehlen Spieler, die EA erst per Squad-Update nachgereicht hat
> (z. B. Wisdom Mike bei Bayern). Solche Spieler legst du im Kader über „✏️ Neu erstellen“ selbst an.

Die Schritte zum Leih-Glitch stammen von [earlygame.com](https://earlygame.com/de/guides/fifa/ea-fc-26-karrieremodus-loan-glitch-erklaert-so-entwickelst-du-jeden-jugendspieler-zum-weltklasse-talent)
und soccergaming.com; beim idealen Kandidaten widersprechen sich die beiden, was in der App auch so dasteht.

Die Potenzial-Textstufen stammen aus Karrieremodus-Guides (fifa-karriere.com, bestetipps.de, Sportskeeda,
GamesRadar, FIFA Infinity). Deutsche und englische Quellen widersprechen sich an den Rändern um einen Punkt –
die betroffenen Grenzwerte sind in der App als unsicher markiert und lassen sich in `data.js` korrigieren.

## Lokale Vorschau

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8124
```
