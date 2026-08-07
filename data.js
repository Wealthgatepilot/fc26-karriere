/* Handgepflegte Konstanten für den FC-26-Karriere-Helfer.
   fcdata.js ist dagegen auto-generiert (tools/generate-fcdata.ps1). */

/* ---------- Potenzial-Stufen ----------
   Die Texte, die im Kadermenü / Scout-Bericht unter dem Spieler stehen.
   Das Spiel des Nutzers läuft auf Englisch -> englischer Text ist führend.

   WICHTIG: Die Grenzen sind in den Quellen NICHT einheitlich (deutsche und englische
   Guides widersprechen sich um 1 Punkt). "unsicher" markiert genau diese Randwerte.
   Wer im Spiel einen Grenzfall sieht, korrigiert einfach die Zahl hier. */
const POTENTIAL_TIERS = [
  {
    key: 'special',
    en: 'Has the potential to be special',
    de: 'Hat Potenzial, etwas Besonderes zu werden',
    min: 90, max: 99,
    unsicher: 'Teils wird 91+ als Untergrenze genannt – 90 ist der Grenzfall.',
    farbe: 'tier-special'
  },
  {
    key: 'prospect',
    en: 'An exciting prospect',
    de: 'Ein aufregender Mann für die Zukunft',
    min: 85, max: 89,
    unsicher: 'Andere Quellen nennen 86–90. Unsicher sind also 85 und 90.',
    farbe: 'tier-prospect'
  },
  {
    key: 'great',
    en: 'Showing great potential',
    de: 'Zeigt großes Potenzial',
    min: 80, max: 84,
    unsicher: 'Andere Quellen nennen 80–85. Unsicher ist also 85.',
    farbe: 'tier-great'
  },
  {
    key: 'none',
    en: 'kein Potenzial-Satz (z. B. nur „At the club since …")',
    de: 'nur „Im Verein seit …"',
    min: 0, max: 79,
    unsicher: '',
    farbe: 'tier-none'
  }
];

/* Kein Potenzial-Hinweis, sondern eine Aussage über das JETZT. */
const POTENTIAL_ACHIEVED = {
  en: 'Is one of the best in the world',
  de: 'Einer der besten der Welt',
  hinweis: 'Das sagt nichts über das Potenzial – der Spieler hat bereits 90+ Overall erreicht.'
};

const POTENTIAL_HINWEISE = [
  'Die Potenzial-Texte erscheinen erst, wenn ein Spieler <b>60 Overall</b> erreicht hat. Ein 55er-Talent zeigt gar nichts an – das heißt nicht, dass es schlecht ist.',
  'Potenzial ist <b>dynamisch</b>: Es steigt oder fällt im Verlauf der Karriere, je nach Einsatzzeit, Training und erfüllten Vertragsforderungen. Der Text kann sich also ändern.',
  'Im Scout-Bericht der Jugendakademie steht statt eines Textes oft ein <b>Zahlenbereich</b> (z. B. 78–91). Je besser das Urteilsvermögen des Scouts, desto enger der Bereich.'
];

/* ---------- Aufstellungen ----------
   x = 0 (links) … 100 (rechts), y = 0 (eigenes Tor) … 100 (gegnerisches Tor).
   Die Positionskürzel entsprechen denen des Datensatzes (12 Stück). */
const FORMATIONS = {
  '4-3-3': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'LB', x: 14, y: 24 }, { p: 'CB', x: 37, y: 19 }, { p: 'CB', x: 63, y: 19 }, { p: 'RB', x: 86, y: 24 },
    { p: 'CDM', x: 50, y: 42 }, { p: 'CM', x: 26, y: 54 }, { p: 'CM', x: 74, y: 54 },
    { p: 'LW', x: 16, y: 80 }, { p: 'ST', x: 50, y: 88 }, { p: 'RW', x: 84, y: 80 }
  ],
  '4-2-3-1': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'LB', x: 14, y: 24 }, { p: 'CB', x: 37, y: 19 }, { p: 'CB', x: 63, y: 19 }, { p: 'RB', x: 86, y: 24 },
    { p: 'CDM', x: 34, y: 41 }, { p: 'CDM', x: 66, y: 41 },
    { p: 'LM', x: 16, y: 66 }, { p: 'CAM', x: 50, y: 64 }, { p: 'RM', x: 84, y: 66 },
    { p: 'ST', x: 50, y: 88 }
  ],
  '4-4-2': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'LB', x: 14, y: 24 }, { p: 'CB', x: 37, y: 19 }, { p: 'CB', x: 63, y: 19 }, { p: 'RB', x: 86, y: 24 },
    { p: 'LM', x: 15, y: 52 }, { p: 'CM', x: 38, y: 48 }, { p: 'CM', x: 62, y: 48 }, { p: 'RM', x: 85, y: 52 },
    { p: 'ST', x: 36, y: 85 }, { p: 'ST', x: 64, y: 85 }
  ],
  '4-4-2 Raute': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'LB', x: 14, y: 24 }, { p: 'CB', x: 37, y: 19 }, { p: 'CB', x: 63, y: 19 }, { p: 'RB', x: 86, y: 24 },
    { p: 'CDM', x: 50, y: 38 }, { p: 'LM', x: 18, y: 54 }, { p: 'RM', x: 82, y: 54 }, { p: 'CAM', x: 50, y: 68 },
    { p: 'ST', x: 36, y: 87 }, { p: 'ST', x: 64, y: 87 }
  ],
  '3-5-2': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'CB', x: 28, y: 20 }, { p: 'CB', x: 50, y: 17 }, { p: 'CB', x: 72, y: 20 },
    { p: 'LM', x: 12, y: 50 }, { p: 'CM', x: 34, y: 46 }, { p: 'CDM', x: 50, y: 38 }, { p: 'CM', x: 66, y: 46 }, { p: 'RM', x: 88, y: 50 },
    { p: 'ST', x: 36, y: 85 }, { p: 'ST', x: 64, y: 85 }
  ],
  '5-3-2': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'LB', x: 10, y: 30 }, { p: 'CB', x: 30, y: 19 }, { p: 'CB', x: 50, y: 16 }, { p: 'CB', x: 70, y: 19 }, { p: 'RB', x: 90, y: 30 },
    { p: 'CM', x: 28, y: 52 }, { p: 'CM', x: 50, y: 48 }, { p: 'CM', x: 72, y: 52 },
    { p: 'ST', x: 36, y: 85 }, { p: 'ST', x: 64, y: 85 }
  ],
  '3-4-3': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'CB', x: 28, y: 20 }, { p: 'CB', x: 50, y: 17 }, { p: 'CB', x: 72, y: 20 },
    { p: 'LM', x: 14, y: 50 }, { p: 'CM', x: 38, y: 46 }, { p: 'CM', x: 62, y: 46 }, { p: 'RM', x: 86, y: 50 },
    { p: 'LW', x: 18, y: 82 }, { p: 'ST', x: 50, y: 88 }, { p: 'RW', x: 82, y: 82 }
  ],
  '4-1-2-1-2': [
    { p: 'GK', x: 50, y: 5 },
    { p: 'LB', x: 14, y: 24 }, { p: 'CB', x: 37, y: 19 }, { p: 'CB', x: 63, y: 19 }, { p: 'RB', x: 86, y: 24 },
    { p: 'CDM', x: 50, y: 36 }, { p: 'CM', x: 26, y: 52 }, { p: 'CM', x: 74, y: 52 }, { p: 'CAM', x: 50, y: 68 },
    { p: 'ST', x: 36, y: 87 }, { p: 'ST', x: 64, y: 87 }
  ]
};

/* Welche Position passt zu welcher? Für die Farbmarkierung in der Aufstellung. */
const POS_VERWANDT = {
  GK:  [],
  CB:  ['LB', 'RB', 'CDM'],
  LB:  ['CB', 'LM', 'LW'],
  RB:  ['CB', 'RM', 'RW'],
  CDM: ['CM', 'CB'],
  CM:  ['CDM', 'CAM'],
  CAM: ['CM', 'LW', 'RW', 'ST'],
  LM:  ['LW', 'CM', 'LB'],
  RM:  ['RW', 'CM', 'RB'],
  LW:  ['LM', 'CAM', 'ST'],
  RW:  ['RM', 'CAM', 'ST'],
  ST:  ['CAM', 'LW', 'RW']
};

/* Mannschaftsteile für die Kader-Auswertung */
const POS_GRUPPEN = {
  Tor:        ['GK'],
  Abwehr:     ['CB', 'LB', 'RB'],
  Mittelfeld: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  Angriff:    ['LW', 'RW', 'ST']
};

const DEFAULT_DATA = {
  squad:    { formation: '4-3-3', club: '', players: [], lineup: {} },
  youth:    [],
  settings: { saison: 1 }
};
