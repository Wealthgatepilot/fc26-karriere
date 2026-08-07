<#
  generate-fcdata.ps1
  Erzeugt fcdata.js aus dem oeffentlichen FC-26-Spielerdatensatz.

  Quelle:  https://github.com/ismailoksuz/EAFC26-DataHub  (data/players.csv)
           urspruenglich Kaggle "FC 26 (FIFA 26) Player Data"
  Stand:   fifa_version 26, update 4, 19.09.2025 = Spielstart

  Ausgabeformat (kompakt, damit die Datei auf dem Handy schnell laedt):
    FC_LEAGUES  = [ [Name, Level, Land], ... ]   (je league_id, nicht je Name!)
    FC_CLUBS    = [ Name, ... ]
    FC_NATIONS  = [ Name, ... ]
    FC_POS      = [ "GK", "CB", ... ]
    FC_PLAYERS  = [ [short, long, [posIdx], ovr, pot, age, clubIdx, ligaIdx, natIdx,
                     valueEur, wageEur, fuss(0=L/1=R), weakFoot, skillMoves, intRep], ... ]

  Caching:  players.csv wird nach %TEMP%\eafc26-cache geladen und dort wiederverwendet.
  Robust:   fehlt eine Pflichtspalte, bricht das Skript mit klarer Meldung ab.

  Beispiele:
    powershell -ExecutionPolicy Bypass -File tools/generate-fcdata.ps1
    powershell -ExecutionPolicy Bypass -File tools/generate-fcdata.ps1 -MaxRows 200 -OutFile ..\sample.js
#>
param(
  [string]$OutFile,
  [string]$CacheDir = (Join-Path $env:TEMP 'eafc26-cache'),
  [string]$Url = 'https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.csv',
  [int]$MaxRows = 0,
  [switch]$Refresh
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $OutFile) { $OutFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'fcdata.js' }

# --- CSV besorgen (Cache) ---
New-Item -ItemType Directory -Force $CacheDir | Out-Null
$csvPath = Join-Path $CacheDir 'players.csv'
if ($Refresh -and (Test-Path $csvPath)) { Remove-Item $csvPath -Force }
if (-not (Test-Path $csvPath)) {
  Write-Host "Lade Datensatz ($Url) ..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $Url -OutFile $csvPath -UseBasicParsing
}
Write-Host ("CSV: {0} ({1} MB)" -f $csvPath, [math]::Round((Get-Item $csvPath).Length / 1MB, 2))

# --- Einlesen + Pflichtspalten pruefen ---
Write-Host "Lese CSV ..." -ForegroundColor Cyan
$rows = Import-Csv $csvPath -Encoding UTF8   # ohne -Encoding liest PS 5.1 ANSI -> "MÃ¼nchen"
if (-not $rows -or $rows.Count -eq 0) { throw "CSV enthaelt keine Datenzeilen." }

$cols = $rows[0].PSObject.Properties.Name
$needed = 'short_name','long_name','player_positions','overall','potential','age',
          'club_name','league_name','league_level','nationality_name','value_eur','wage_eur',
          'preferred_foot','weak_foot','skill_moves','international_reputation'
$missing = $needed | Where-Object { $cols -notcontains $_ }
if ($missing) { throw ("Pflichtspalten fehlen in der CSV: {0}`nVorhandene Spalten: {1}" -f ($missing -join ', '), ($cols -join ', ')) }

# Datenstand aus der CSV selbst melden (der Datensatz kann spaeter aktualisiert werden)
$stand = 'unbekannt'
if ($cols -contains 'fifa_version' -and $cols -contains 'fifa_update_date') {
  $stand = ($rows | Group-Object { "FC $($_.fifa_version), Stand $($_.fifa_update_date)" } |
            Sort-Object Count -Descending | Select-Object -First 1).Name
}
Write-Host ("Zeilen: {0}  |  Datenstand: {1}" -f $rows.Count, $stand)

if ($MaxRows -gt 0 -and $rows.Count -gt $MaxRows) {
  $rows = $rows | Select-Object -First $MaxRows
  Write-Host ("Testlauf: auf {0} Zeilen begrenzt." -f $MaxRows) -ForegroundColor Yellow
}

# --- Helfer ---
function ConvertTo-JsString([string]$s) {
  if ($null -eq $s) { return '""' }
  $e = $s -replace '\\', '\\' -replace '"', '\"' -replace "`r", '' -replace "`n", ' '
  return '"' + $e + '"'
}
function ConvertTo-IntOrZero($v) {
  $d = 0.0
  if ([double]::TryParse(($v -replace ',', '.'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$d)) {
    return [int][math]::Round($d)
  }
  return 0
}

# Feste Positionsreihenfolge (der Datensatz kennt genau diese 12; Reihenfolge = hinten nach vorne)
$posOrder = @('GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST')
$posIdx = @{}
for ($i = 0; $i -lt $posOrder.Count; $i++) { $posIdx[$posOrder[$i]] = $i }

$clubs    = New-Object System.Collections.Generic.List[string]
$clubMap  = @{}
$nations   = New-Object System.Collections.Generic.List[string]
$nationMap = @{}
$leagues      = New-Object System.Collections.Generic.List[object]
$leagueMap    = @{}
$ligaNationen = @{}   # je Liga: Nationalitaet -> Anzahl

function Get-Index($name, $list, $map) {
  if ([string]::IsNullOrWhiteSpace($name)) { return -1 }
  if ($map.ContainsKey($name)) { return $map[$name] }
  $list.Add($name) | Out-Null
  $map[$name] = $list.Count - 1
  return $map[$name]
}

# --- Zeilen umwandeln ---
Write-Host "Wandle um ..." -ForegroundColor Cyan
$entries    = New-Object System.Collections.Generic.List[string]
$unknownPos = @{}
$skipped    = 0
$done       = 0

foreach ($r in $rows) {
  $done++
  if ($done % 2000 -eq 0) { Write-Host ("  {0}/{1}" -f $done, $rows.Count) }

  $short = $r.short_name
  if ([string]::IsNullOrWhiteSpace($short)) { $skipped++; continue }

  $ovr = ConvertTo-IntOrZero $r.overall
  $pot = ConvertTo-IntOrZero $r.potential
  if ($ovr -le 0) { $skipped++; continue }
  if ($pot -lt $ovr) { $pot = $ovr }   # Potenzial kann nie unter dem aktuellen Wert liegen

  $ps = @()
  foreach ($p in ($r.player_positions -split ',')) {
    $p = $p.Trim().ToUpper()
    if (-not $p) { continue }
    if ($posIdx.ContainsKey($p)) { $ps += $posIdx[$p] }
    else { $unknownPos[$p] = $true }
  }
  if ($ps.Count -eq 0) { $ps = @($posIdx['CM']) }

  $ci = Get-Index $r.club_name        $clubs   $clubMap
  $ni = Get-Index $r.nationality_name $nations $nationMap

  # Nach league_id gruppieren, NICHT nach Namen: mehrere Ligen heissen gleich
  # (Bundesliga = Deutschland + Oesterreich, Serie A = Italien + Ecuador usw.)
  $li = -1
  $lid = ($r.league_id -replace '\.0$', '').Trim()
  if ($lid -and -not [string]::IsNullOrWhiteSpace($r.league_name)) {
    if ($leagueMap.ContainsKey($lid)) { $li = $leagueMap[$lid] }
    else {
      $leagues.Add([pscustomobject]@{ Id = $lid; Name = $r.league_name; Level = (ConvertTo-IntOrZero $r.league_level); Land = '' }) | Out-Null
      $li = $leagues.Count - 1
      $leagueMap[$lid] = $li
    }
    # Nationalitaeten mitzaehlen, um gleichnamige Ligen spaeter unterscheiden zu koennen
    if (-not $ligaNationen.ContainsKey($li)) { $ligaNationen[$li] = @{} }
    $nat = $r.nationality_name
    if ($nat) { $ligaNationen[$li][$nat] = [int]$ligaNationen[$li][$nat] + 1 }
  }

  # Langname nur speichern, wenn er zusaetzliche Information traegt (spart ~0,3 MB)
  $long = $r.long_name
  if ([string]::IsNullOrWhiteSpace($long) -or $long -eq $short) { $long = '' }

  $foot = 0
  if ($r.preferred_foot -and $r.preferred_foot.Trim().ToUpper().StartsWith('R')) { $foot = 1 }

  $line = '[{0},{1},[{2}],{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13},{14}]' -f `
    (ConvertTo-JsString $short), (ConvertTo-JsString $long), ($ps -join ','),
    $ovr, $pot, (ConvertTo-IntOrZero $r.age), $ci, $li, $ni,
    (ConvertTo-IntOrZero $r.value_eur), (ConvertTo-IntOrZero $r.wage_eur),
    $foot, (ConvertTo-IntOrZero $r.weak_foot), (ConvertTo-IntOrZero $r.skill_moves),
    (ConvertTo-IntOrZero $r.international_reputation)

  $entries.Add($line) | Out-Null
}

# --- Land je Liga bestimmen ---
# Gleichnamige Ligen (Bundesliga DE/AT, Serie A IT/EC, Pro League SA/BE/AE ...) lassen sich
# nur so auseinanderhalten. Die haeufigste Nationalitaet trifft das Land zuverlaessig.
for ($i = 0; $i -lt $leagues.Count; $i++) {
  if (-not $ligaNationen.ContainsKey($i)) { continue }
  $best = $null; $bestN = 0
  foreach ($k in $ligaNationen[$i].Keys) {
    if ($ligaNationen[$i][$k] -gt $bestN) { $bestN = $ligaNationen[$i][$k]; $best = $k }
  }
  $leagues[$i].Land = $best
}

# --- Datei schreiben ---
$out = New-Object System.Text.StringBuilder
[void]$out.Append("// AUTO-GENERIERT - nicht von Hand editieren.`n")
[void]$out.Append("// Erzeugt von tools/generate-fcdata.ps1 aus dem oeffentlichen Datensatz`n")
[void]$out.Append("// https://github.com/ismailoksuz/EAFC26-DataHub (Kaggle: FC 26 (FIFA 26) Player Data)`n")
[void]$out.Append(("// Datenstand: {0}  |  Spieler: {1}`n" -f $stand, $entries.Count))
[void]$out.Append("// Community-Extraktion, keine offizielle EA-Datei - einzelne Werte koennen abweichen.`n`n")

[void]$out.Append(("const FC_META = {{ stand: {0}, count: {1}, quelle: ""EAFC26-DataHub (Kaggle)"" }};`n`n" -f (ConvertTo-JsString $stand), $entries.Count))
[void]$out.Append("const FC_POS = [" + (($posOrder | ForEach-Object { ConvertTo-JsString $_ }) -join ',') + "];`n`n")
[void]$out.Append("// [Name, Level, Land] - je league_id, damit gleichnamige Ligen getrennt bleiben`n")
[void]$out.Append("const FC_LEAGUES = [`n" + (($leagues | ForEach-Object {
  '[' + (ConvertTo-JsString $_.Name) + ',' + $_.Level + ',' + (ConvertTo-JsString $_.Land) + ']'
}) -join ",`n") + "`n];`n`n")
[void]$out.Append("const FC_CLUBS = [`n" + (($clubs   | ForEach-Object { ConvertTo-JsString $_ }) -join ',') + "`n];`n`n")
[void]$out.Append("const FC_NATIONS = [`n" + (($nations | ForEach-Object { ConvertTo-JsString $_ }) -join ',') + "`n];`n`n")
[void]$out.Append("// [short, long, [pos], ovr, pot, age, club, liga, nation, wert, gehalt, fuss(0=L/1=R), weakFoot, skills, ruf]`n")
[void]$out.Append("const FC_PLAYERS = [`n")
[void]$out.Append(($entries -join ",`n"))
[void]$out.Append("`n];`n")

[System.IO.File]::WriteAllText($OutFile, $out.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("Fertig: {0} Spieler -> {1} ({2} MB)" -f $entries.Count, $OutFile, [math]::Round((Get-Item $OutFile).Length / 1MB, 2)) -ForegroundColor Green
Write-Host ("Ligen: {0}  |  Vereine: {1}  |  Nationen: {2}" -f $leagues.Count, $clubs.Count, $nations.Count)
if ($skipped)             { Write-Host ("Uebersprungen (kein Name/Overall): {0}" -f $skipped) -ForegroundColor Yellow }
if ($unknownPos.Count)    { Write-Host ("Unbekannte Positionen ignoriert: {0}" -f (($unknownPos.Keys | Sort-Object) -join ', ')) -ForegroundColor Yellow }
