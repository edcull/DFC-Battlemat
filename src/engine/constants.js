// Extracted from web/index.html. Pure data constants — no DOM, no state references.
// All exports are safe to import in Node.js (server) or browser (client).

export const FACTIONS = {
  ucm:        { name: 'UCM' },
  shaltari:   { name: 'Shaltari' },
  phr:        { name: 'PHR' },
  resistance: { name: 'Resistance' },
  scourge:    { name: 'Scourge' },
  bioficer:   { name: 'Bioficer' }
};

export const ORDERS = {
  GQ: { label:'General Quarters', short:'GQ',
        canDo:['Turn up to 45°','Move ½ to full Thrust','Fire up to half weapons (rounded up)','Launch Assets'],
        cantDo:[],
        spike:'−2 at start', turnLimit:45, moveMin:0.5, moveMax:1, fireRule:'half' },
  SR: { label:'Silent Running', short:'SR',
        canDo:['Move ½ to full Thrust','Launch Assets','Signature → 0" at end of activation'],
        cantDo:['Cannot turn','Cannot attack'],
        spike:'Remove ALL at start', turnLimit:0, moveMin:0.5, moveMax:1, fireRule:'none' },
  WF: { label:'Weapons Free', short:'WF',
        canDo:['Move ½ to full Thrust','Fire ALL weapons','Launch Assets'],
        cantDo:['Cannot turn'],
        spike:'+2 at end', turnLimit:0, moveMin:0.5, moveMax:1, fireRule:'all' },
  CC: { label:'Course Change', short:'CC',
        canDo:['Turn up to 45°','Move up to ½ Thrust','Turn up to 45° AGAIN','Fire ONE weapon','Launch Assets (forgo a turn)'],
        cantDo:[],
        spike:'+1 at end', turnLimit:45, turnLimit2:45, moveMin:0, moveMax:0.5, fireRule:'one' },
  MT: { label:'Max Thrust', short:'MT',
        canDo:['Move full to 2× Thrust'],
        cantDo:['Cannot turn','Cannot attack','Cannot launch Assets'],
        spike:'+2 at end', turnLimit:0, moveMin:1, moveMax:2, fireRule:'none' },
  DC: { label:'Damage Control', short:'DC',
        canDo:['Recover 1 Hull (D3 for H/C)','Turn up to 45°','Move up to ½ Thrust','Fire ONE Close Action weapon'],
        cantDo:['Cannot launch Assets'],
        spike:'None', turnLimit:45, moveMin:0, moveMax:0.5, fireRule:'one-CA' }
};

export const INCH = 12; // 12 pixels per inch → 576px board = 48"
export const BOARD_IN = 48;
export const BOARD_PX = BOARD_IN * INCH;

export const DROPSITE_BASE = {
  small_station:  { name:'Small Space Station',  category:'station', size:'small',  scan:6, sig:4, hull:10, es:'4+', ks:'4+', layer:'Orbit' },
  medium_station: { name:'Medium Space Station', category:'station', size:'medium', scan:6, sig:6, hull:15, es:'4+', ks:'4+', layer:'Orbit' },
  large_station:  { name:'Large Space Station',  category:'station', size:'large',  scan:6, sig:8, hull:25, es:'4+', ks:'4+', layer:'Orbit' },
  small_city:     { name:'Small City',           category:'city',    size:'small',  scan:6, sig:0, hull:10, es:'5+', ks:'5+', layer:'Atmosphere' },
  medium_city:    { name:'Medium City',          category:'city',    size:'medium', scan:6, sig:0, hull:15, es:'5+', ks:'5+', layer:'Atmosphere' },
  large_city:     { name:'Large City',           category:'city',    size:'large',  scan:6, sig:0, hull:25, es:'5+', ks:'5+', layer:'Atmosphere' }
};

export const FEATURES = {
  military_outpost: { name:'Military Outpost', short:'MIL OUTPOST', es:'3+', ks:'5+', glyph:'◆', color:'#e08544',
    weapon:{ name:'Missile Halo', scan:'6"', att:1, lock:'2+', dmg:2, type:'K', special:'Close Action, Escape Velocity' } },
  orbital_defence_gun: { name:'Orbital Defence Gun', short:'ODG', es:'5+', ks:'3+', glyph:'■', color:'#6ec97a',
    weapon:{ name:'Orbital Gun', scan:'6"', att:3, lock:'3+', dmg:1, type:'E', special:'Burnthrough-1, Escape Velocity' } },
  comms_station: { name:'Comms Station', short:'COMMS', es:'5+', ks:'4+', glyph:'◯', color:'#d65454',
    note:'Comms Uplink — if you Control this Dropsite, +1 AP generated (once per round).' },
  power_plant: { name:'Power Plant', short:'POWER', es:'4+', ks:'5+', glyph:'⚡', color:'#e8b84f',
    note:'Volatile — when destroyed, all Groups within 3" gain a Spike and the Dropsite takes additional 2D3 damage.' },
  hangar: { name:'Hangar', short:'HANGAR', es:'4+', ks:'4+', glyph:'▲', color:'#a8b4bc',
    launch:[{name:'Fighters & Bombers', n:2, type:'fighter_bomber'}],
    note:'Launches 2 Fighters & Bombers (uses Controlling player\'s F/B).' },
  aegis_platform: { name:'Aegis Platform', short:'AEGIS', es:'6+', ks:'4+', glyph:'⬡', color:'#4ad6ff',
    note:'Aegis-4 vs enemy close action & bomber attacks (friendly Groups treat the Dropsite as a friendly Ship with Aegis-4).' },
  comms_platform: { name:'Comms Platform', short:'COMMS PLT', es:'5+', ks:'5+', glyph:'◎', color:'#4ad6ff',
    note:'Command Ship-X +1 within 8"; friendly Ships within 8" ignore Scanners Offline.' },
  torpedo_platform: { name:'Torpedo Platform', short:'TORP PLT', es:'5+', ks:'5+', glyph:'➤', color:'#4ad6ff',
    launch:[{name:'Medium Torpedo', n:1, type:'torpedo'}],
    note:'Launches 1 Medium Torpedo (Limited-4).' },
  genitor_tower: { name:'Genitor Tower', short:'GENITOR', es:'4+', ks:'4+', glyph:'⌘', color:'#d65454',
    note:'When enemy Battalions here are removed, place 2 friendly Battalions on this Dropsite.' }
};

// Helper to compose a dropsite descriptor.
// features: optional initial feature array e.g. ['power_plant','military_outpost']
// siteRules: optional zone-specific scoring rules, any combination of:
//   'assess'                            — both players may Assess (1 VP each, Assess objective)
//   'assess_south' / 'assess_north'     — only that zone's player may Assess
//   'double_assess_south' / '_north'    — that zone's player scores 2 VP for Assessing instead of 1
//   'demolish_south' / 'demolish_north' — only that zone's player scores Demolish VP (Ruin/Level)
export const ds = (id, type, x, y, features, siteRules) => ({
  id, type, x, y,
  ...(features   ? { layoutFeatures: features } : {}),
  ...(siteRules  ? { siteRules }                : {})
});

export const LAYOUTS = {
  diagonal: {
    d6:1, name:'Diagonal',
    scenery:{ micrometeor:'4-6', dense:4, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','small_station', 24, 12),
      ds('ds2','medium_city',   36, 12),
      ds('ds3','large_city',    24, 24),
      ds('ds4','medium_city',   12, 36),
      ds('ds5','small_station', 24, 36)
    ],
    rings:[], largeObjects:[]
  },
  edge_case: {
    d6:2, name:'Edge Case',
    scenery:{ micrometeor:4, dense:6, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','small_station', 12, 24),
      ds('ds2','small_station', 36, 24),
      ds('ds3','large_city',    39,  9),
      ds('ds4','medium_city',   24, 18),
      ds('ds5','medium_city',   24, 30),
      ds('ds6','large_city',     9, 39)
    ],
    rings:[], largeObjects:[]
  },
  eruption: {
    d6:3, name:'Eruption',
    scenery:{ micrometeor:4, dense:2, rings:1, largeObjects:0 },
    dropsites:[
      ds('ds1','large_city',    12, 12),
      ds('ds2','medium_city',   36, 12),
      ds('ds3','small_city',    24, 24),
      ds('ds4','medium_city',   12, 36),
      ds('ds5','large_city',    36, 36)
    ],
    rings:[{ axis:'horizontal', y:24 }],
    largeObjects:[]
  },
  gatecrash: {
    d6:4, name:'Gatecrash',
    scenery:{ micrometeor:'4-6', dense:4, rings:2, largeObjects:0 },
    dropsites:[
      ds('ds1','large_station', 36, 12),
      ds('ds2','medium_city',    9, 24),
      ds('ds3','small_city',    24, 24),
      ds('ds4','medium_city',   39, 24),
      ds('ds5','large_station', 12, 36)
    ],
    rings:[{ axis:'horizontal', y:16 },{ axis:'horizontal', y:32 }],
    largeObjects:[]
  },
  moonlight: {
    d6:5, name:'Moonlight',
    scenery:{ micrometeor:2, dense:2, rings:0, largeObjects:2 },
    dropsites:[
      ds('ds1','medium_station',  8, 18),
      ds('ds2','medium_station', 40, 30),
      ds('ds3','small_city',     24, 12),
      ds('ds4','small_city',     24, 36),
      ds('ds5','medium_city',    40,  8),
      ds('ds6','medium_city',     8, 40)
    ],
    rings:[],
    largeObjects:[
      { x:32, y:20, diameter:8 },
      { x:16, y:28, diameter:8 }
    ]
  },
  moonstruck: {
    d6:6, name:'Moonstruck',
    scenery:{ micrometeor:6, dense:0, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','large_station', 24, 12),
      ds('ds2','medium_city',   12, 18),
      ds('ds3','small_city',    39, 18),
      ds('ds4','small_city',     9, 30),
      ds('ds5','medium_city',   36, 30),
      ds('ds6','large_station', 24, 36)
    ],
    rings:[],
    largeObjects:[{ x:24, y:24, diameter:12 }]
  },
  take_and_hold: {
    d6:0, bespoke:true, name:'Take and Hold',
    scenery:{ micrometeor:4, dense:4, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_city',    24, 24),
      ds('ds2','large_city',      6, 24),
      ds('ds3','large_city',     42, 24),
      ds('ds4','medium_station', 12, 30),
      ds('ds5','medium_station', 36, 18)
    ],
    rings:[], largeObjects:[]
  },
  erupting_battlefront: {
    d6:0, bespoke:true, name:'Erupting Battlefront',
    scenery:{ micrometeor:4, dense:0, rings:1, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_city', 12, 12),
      ds('ds2','medium_city', 36, 12),
      ds('ds3','large_city',  24, 24),
      ds('ds4','medium_city', 12, 36),
      ds('ds5','medium_city', 36, 36)
    ],
    rings:[{ axis:'horizontal', y:24 }],
    largeObjects:[]
  },
  power_grab: {
    d6:0, bespoke:true, name:'Power Grab',
    scenery:{ micrometeor:6, dense:4, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','large_city',    42,  6),
      ds('ds2','medium_city',   24, 18),
      ds('ds3','small_station', 12, 24),
      ds('ds4','small_station', 36, 24),
      ds('ds5','medium_city',   24, 30),
      ds('ds6','large_city',     6, 42)
    ],
    rings:[], largeObjects:[]
  },
  shock_and_yaw: {
    d6:0, bespoke:true, name:'Shock and Yaw',
    scenery:{ micrometeor:'2-5', dense:'4-6', rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_station', 24, 24),
      ds('ds2','large_station',  40,  6),
      ds('ds3','large_station',   8, 42),
      ds('ds4','medium_city',    42, 18),
      ds('ds5','medium_city',     6, 30),
      ds('ds6','small_city',     16, 16),
      ds('ds7','small_city',     32, 32)
    ],
    rings:[], largeObjects:[]
  },
  orbital_support: {
    d6:0, bespoke:true, name:'Orbital Support',
    scenery:{ micrometeor:'2-5', dense:'4-6', rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_station', 24, 24),
      ds('ds2','large_city',   6, 12),
      ds('ds3','large_city',  42, 12),
      ds('ds4','large_city',   6, 36),
      ds('ds5','large_city',  42, 36),
      ds('ds6','small_city',  24, 12),
      ds('ds7','small_city',  24, 36)
    ],
    rings:[], largeObjects:[]
  },
  entrapmoont: {
    d6:0, bespoke:true, name:'Entrapmoont',
    scenery:{ micrometeor:6, dense:0, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','large_station', 24, 12),
      ds('ds2','large_station', 24, 36),
      ds('ds3','small_city',    12, 18),
      ds('ds4','small_city',    42, 18),
      ds('ds5','small_city',     6, 30),
      ds('ds6','small_city',    36, 30)
    ],
    rings:[],
    largeObjects:[{ x:24, y:24, diameter:12 }]
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario Expansion 1 layouts (bespoke — hidden from the random generator).
  // Dropsite positions transcribed from the official scenario maps; dense = Debris
  // Fields, micrometeor = Micrometeor Clouds, largeObjects = moons / large objects.
  // ──────────────────────────────────────────────────────────────────────────
  se1_ready_salted_earth: {
    d6:0, bespoke:true, name:'Ready Salted Earth',
    scenery:{ micrometeor:4, dense:2, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_station', 12, 24, ['comms_station','military_outpost']),
      ds('ds2','medium_station', 36, 24, ['comms_station','military_outpost']),
      ds('ds3','large_city',      9, 39),
      ds('ds4','large_city',     39,  9),
      ds('ds5','small_city',     24, 18, ['power_plant','power_plant']),
      ds('ds6','small_city',     24, 30, ['power_plant','power_plant'])
    ],
    rings:[], largeObjects:[],
    focalPoints:[
      { x:12, y:24, diameter:8 , special:['low_crippled'], label:'Station Focal Point'},
      { x:36, y:24, diameter:8 , special:['low_crippled'], label:'Station Focal Point'}
    ],
    stationCityLinks: { ds1: 'ds5', ds2: 'ds6' }
  },
  se1_erupting_quarters: {
    d6:0, bespoke:true, name:'Erupting Quarters',
    scenery:{ micrometeor:4, dense:4, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_station', 24, 24, ['hangar','military_outpost','orbital_defence_gun']),
      ds('ds2','medium_city',    12, 12, ['power_plant','comms_station']),
      ds('ds3','medium_city',    36, 12, ['power_plant','military_outpost','orbital_defence_gun']),
      ds('ds4','medium_city',    12, 36, ['power_plant','military_outpost','orbital_defence_gun']),
      ds('ds5','medium_city',    36, 36, ['power_plant','comms_station'])
    ],
    rings:[], largeObjects:[],
    focalPoints:[
      { x:0, y:0, width:24, height:24, special:['low_crippled','low_north']},
      { x:24, y:0, width:24, height:24,special:['low_crippled','low_north']}, 
      { x:0, y:24, width:24, height:24, special:['low_crippled','low_south']}, 
      { x:24, y:24, width:24, height:24, special:['low_crippled','low_south']},
    ]
  },
  se1_latitudinal_lanes: {
    d6:0, bespoke:true, name:'Latitudinal Lanes',
    scenery:{ micrometeor:6, dense:2, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_city',     9, 12, ['military_outpost','orbital_defence_gun'], ['assess_south']),
      ds('ds2','medium_station', 24, 12, ['power_plant','comms_station'], ['assess_south']),
      ds('ds3','medium_city',    39, 12, ['military_outpost','orbital_defence_gun'], ['assess_south']),
      ds('ds4','medium_city',     9, 36, ['military_outpost','orbital_defence_gun'], ['assess_north']),
      ds('ds5','medium_station', 24, 36, ['power_plant','comms_station'], ['assess_north']),
      ds('ds6','medium_city',    39, 36, ['military_outpost','orbital_defence_gun'], ['assess_north'])
    ],
    rings:[], largeObjects:[],
    focalPoints:[
      { x:9, y:12, diameter:6, special:['low_north']},
      { x:24, y:12, diameter:6, special:['low_north']},
      { x:39, y:12, diameter:6, special:['low_north']},
      { x:9, y:36, diameter:6, special:['low_south']},
      { x:24, y:36, diameter:6, special:['low_south']},
      { x:39, y:36, diameter:6, special:['low_south']},
    ]
  },
  se1_lagrange_points: {
    d6:0, bespoke:true, name:'Lagrange Points',
    scenery:{ micrometeor:6, dense:2, rings:0, largeObjects:0 },
    dropsites:[      
      ds('ds1','large_station', 12, 24, ['military_outpost','orbital_defence_gun']),
      ds('ds2','large_station', 36, 24, ['military_outpost','orbital_defence_gun']),
      ds('ds3','medium_city',   24, 18),
      ds('ds4','medium_city',   24, 30),
      ds('ds5','small_city',     9, 39, ['comms_station','comms_station']),
      ds('ds6','small_city',    39,  9, ['comms_station','comms_station'])
    ],
    rings:[], largeObjects:[],
    focalPoints:[
      { x:12, y:24, diameter:8, special:['low_crippled'] },
      { x:36, y:24, diameter:8, special:['low_crippled'] }
    ]
  },
  se1_when_backfields_meet: {
    d6:0, bespoke:true, name:'When Backfields Meet',
    scenery:{ micrometeor:2, dense:6, rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','small_station', 12, 12, ['power_plant','comms_station'], ['assess','double_assess_south','demolish_south','score_north']),
      ds('ds2','small_station', 36, 36, ['power_plant','comms_station'], ['assess','double_assess_north','demolish_north','score_south']),
      ds('ds3','medium_city',   24, 9,  ['hangar'], ['assess','double_assess_south','demolish_south','score_north']),
      ds('ds4','medium_city',   24, 39, ['hangar'], ['assess','double_assess_north','demolish_north','score_south']),
      ds('ds5','medium_city',    9, 24, ['hangar'], ['assess','double_assess_south','demolish_south','score_north']),
      ds('ds6','medium_city',   39, 24, ['hangar'], ['assess','double_assess_north','demolish_north','score_south']),
      ds('ds7','small_city',     9, 39),
      ds('ds8','small_city',    39, 9)
    ],
    rings:[], largeObjects:[]
  },
  se1_very_important_moon: {
    d6:0, bespoke:true, name:'Very Important Moon',
    scenery:{ micrometeor:2, dense:2, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','large_station', 24, 12, ['hangar','comms_station']),
      ds('ds2','large_station', 24, 36, ['hangar','comms_station']),
      ds('ds3','small_city',   12, 18, ['military_outpost','orbital_defence_gun']),
      ds('ds4','small_city',   36, 30, ['military_outpost','orbital_defence_gun']),
      ds('ds5','medium_city',    9, 30, ['military_outpost','orbital_defence_gun']),
      ds('ds6','medium_city',   39, 18, ['military_outpost','orbital_defence_gun'])
    ],
    rings:[], largeObjects:[{ x:24, y:24, diameter:12 }],
    focalPoints:[
      { x:24, y:24, diameter:24 }
    ]
  },
  se1_moonshot: {
    d6:0, bespoke:true, name:'Moonshot',
    scenery:{ micrometeor:2, dense:3, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','medium_city',    12, 12, ['military_outpost','orbital_defence_gun']),
      ds('ds2','medium_station', 36, 12, ['military_outpost','orbital_defence_gun']),
      ds('ds3','medium_station', 12, 36, ['military_outpost','orbital_defence_gun']),
      ds('ds4','medium_city',    36, 36, ['military_outpost','orbital_defence_gun'])
    ],
    rings:[], largeObjects:[{ x:24, y:24, diameter:12 }],
    focalPoints:[
      { x:12, y:12, diameter:6 },
      { x:36, y:12, diameter:6 },
      { x:12, y:36, diameter:6 },
      { x:36, y:36, diameter:6 }
    ]
  },
  se1_moonwreck: {
    d6:0, bespoke:true, name:'Moonwreck',
    scenery:{ micrometeor:6, dense:8, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','large_station', 24, 12, ['military_outpost','orbital_defence_gun'], ['demolish_south']),
      ds('ds2','large_station', 44, 12, ['military_outpost','orbital_defence_gun']),
      ds('ds3','large_station',  4, 36, ['military_outpost','orbital_defence_gun']),
      ds('ds4','large_station', 24, 36, ['military_outpost','orbital_defence_gun'], ['demolish_north'])
    ],
    rings:[], largeObjects:[{ x:24, y:24, diameter:12 }],
    focalPoints:[
      { x:24, y:12, diameter:6 },
      { x:44, y:12, diameter:6 },
      { x:4, y:36, diameter:6 },
      { x:24, y:36, diameter:6 }
    ]
  },
  se1_moonbreaker: {
    d6:0, bespoke:true, name:'Moonbreaker',
    scenery:{ micrometeor:1, dense:3, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','large_station', 12,  12, ['military_outpost','orbital_defence_gun']),
      ds('ds2','large_station', 36,  12, ['military_outpost','orbital_defence_gun']),
      ds('ds3','large_station', 24, 36, ['military_outpost','orbital_defence_gun']),
      // The four "yellow locations" — Small Cities on the Large Object.
      ds('ds4','small_city',    24, 17.7, [], ['demolish_south']),
      ds('ds5','small_city',    29.7, 24, [], ['demolish_south']),
      ds('ds6','small_city',    24, 30.3, [], ['demolish_south']),
      ds('ds7','small_city',    18.3, 24, [], ['demolish_south']),
    ],
    rings:[], largeObjects:[{ x:24, y:24, diameter:12 }],
    moonDropsites: ['ds4','ds5','ds6','ds7']
  },
  se1_moonguard: {
    d6:0, bespoke:true, name:'Moonguard',
    scenery:{ micrometeor:1, dense:3, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','medium_city',     8, 8, ['power_plant','military_outpost','orbital_defence_gun']),
      ds('ds2','medium_station', 24, 8, ['military_outpost','orbital_defence_gun']),
      ds('ds3','medium_city',    40, 8, ['power_plant','military_outpost','orbital_defence_gun']),
      ds('ds4','medium_station', 24, 24, ['military_outpost','orbital_defence_gun'])
    ],
    rings:[], largeObjects:[{ x:24, y:36, diameter:12 }]
  },
  se1_moonswipe: {
    d6:0, bespoke:true, name:'Moonswipe',
    scenery:{ micrometeor:1, dense:3, rings:0, largeObjects:4 },
    dropsites:[
      ds('ds1','medium_station', 24, 12),
      ds('ds2','medium_station', 24, 36),
      ds('ds3','medium_city',    12, 24, ['military_outpost','orbital_defence_gun']),
      ds('ds4','medium_city',    36, 24, ['military_outpost','orbital_defence_gun'])
    ],
    rings:[],
    largeObjects:[
      { x:12, y:12, diameter:6 },
      { x:36, y:12, diameter:6 },
      { x:12, y:36, diameter:6 },
      { x:36, y:36, diameter:6 }
    ],
    focalPoints:[
      { x:24, y:12, diameter:6 },
      { x:24, y:36, diameter:6 },
      { x:12, y:24, diameter:6 },
      { x:36, y:24, diameter:6 }
    ]
  },
  se1_moonskipper: {
    d6:0, bespoke:true, name:'Moonskipper',
    scenery:{ micrometeor:3, dense:3, rings:0, largeObjects:1 },
    dropsites:[
      ds('ds1','small_station', 12, 12),
      ds('ds2','small_station', 24, 12),
      ds('ds3','small_station', 24, 36),
      ds('ds4','small_station', 36, 36),
      ds('ds5','medium_city',   12, 24, ['military_outpost','orbital_defence_gun']),
      ds('ds6','medium_city',   36, 24, ['military_outpost','orbital_defence_gun'])
    ],
    rings:[],
    // The moon begins in the bottom-left corner and tracks across the board (manual).
    largeObjects:[{ x:0, y:48, diameter:12 }],
    focalPoints:[
      { x:12, y:12, diameter:6, special:['south']},
      { x:36, y:36, diameter:6, special:['north']}
    ]
  },
  se1_one_with_almost_nothing: {
    d6:0, bespoke:true, name:'One With (Almost) Nothing',
    scenery:{ micrometeor:4, dense:4, rings:0, largeObjects:0 },
    dropsites:[],
    rings:[], largeObjects:[]
  },
  se1_almost_nothing_at_all: {
    d6:0, bespoke:true, name:'(Almost) Nothing At All',
    scenery:{ micrometeor:4, dense:4, rings:0, largeObjects:2 },
    dropsites:[],
    rings:[],
    largeObjects:[],
    focalPoints:[
      { x:0, y:0, width:24, height:24, special:['south','low_south_crippled']},
      { x:24, y:0, width:24, height:24, special:['south','low_south_crippled']},
      { x:0, y:24, width:24, height:24, special:['north','low_north_crippled']},
      { x:24, y:24, width:24, height:24, special:['north','low_north_crippled']},
    ]
  }
};

export const DEPLOYMENTS = {
  line: {
    d6:1, name:'Line', short:'Base contact with table edge',
    desc:'All Ships in base contact with opposite table edges.',
    zones:{
      north:{ edgeLines:[{x1:0, y1:0, x2:48, y2:0}] },
      south: { edgeLines:[{x1:0, y1:48, x2:48, y2:48}] }
    }
  },
  table_corners: {
    d6:2, name:'Table Corners', short:'Edge ≤12" from corners',
    desc:'Base contact with a table edge up to 12" from opposite corners.',
    zones:{
      north:{ edgeLines:[
        { x1:0, y1:0, x2:12, y2:0 },
        { x1:0, y1:0, x2:0,  y2:12 }
      ]},
      south: { edgeLines:[
        { x1:48, y1:48, x2:36, y2:48 },
        { x1:48, y1:48, x2:48, y2:36 }
      ]}
    }
  },
  midboard: {
    d6:3, name:'Midboard', short:'8" from centre of edge',
    desc:'8" from the centre of opposite table edges.',
    zones:{
      north:{ edgeSemicircle:{ cx:24, cy:0,  r:8, edge:'top'    } },
      south: { edgeSemicircle:{ cx:24, cy:48, r:8, edge:'bottom' } }
    }
  },
  from_corners: {
    d6:4, name:'From Corners', short:'12" from corners',
    desc:'12" from opposite corners.',
    zones:{
      north:{ circleQuad:{ cx:0,  cy:0,  r:12, quad:'br' } },
      south: { circleQuad:{ cx:48, cy:48, r:12, quad:'tl' } }
    }
  },
  attacker_defender: {
    d6:5, name:'Attacker / Defender', short:'South edge, North 12" off',
    desc:'Attackers (South) in base contact with a table edge. Defenders (North) 12" from opposite edge.',
    zones:{
      north:{ polygon:[{x:0,y:0},{x:48,y:0},{x:48,y:12},{x:0,y:12}] },
      south: { edgeLines:[{x1:0, y1:48, x2:48, y2:48}] }
    }
  },
  defender_edge: {
    d6:0, bespoke:true, name:'Defender Edge', short:'South 12" zone, North edge',
    desc:'Attackers (South) up to 12" from bottom edge. Defenders (North) in base contact with opposite edge.',
    zones:{
      north:{ edgeLines:[{x1:0, y1:0, x2:48, y2:0}] },
      south: { polygon:[{x:0,y:36},{x:48,y:36},{x:48,y:48},{x:0,y:48}] }
    }
  },
  diagonal_corners: {
    d6:0, bespoke:true, name:'Diagonal Corners', short:'12" from diagonal corners',
    desc:'Each side deploys in two diagonally-opposite corners (12" from corner along each edge).',
    zones:{
      north:{ edgeLines:[
        { x1:0,  y1:0,  x2:12, y2:0  }, { x1:0,  y1:0,  x2:0,  y2:12 },
        { x1:48, y1:48, x2:36, y2:48 }, { x1:48, y1:48, x2:48, y2:36 }
      ]},
      south: { edgeLines:[
        { x1:48, y1:0,  x2:36, y2:0  }, { x1:48, y1:0,  x2:48, y2:12 },
        { x1:0,  y1:48, x2:12, y2:48 }, { x1:0,  y1:48, x2:0,  y2:36 }
      ]}
    }
  },
  encirclement: {
    d6:6, name:'Encirclement', short:'South corners, North centre',
    desc:'Attackers (South) 6" from all board corners. Defenders (North) 9" from board centre.',
    zones:{
      north:{ circle:{ cx:24, cy:24, r:9 } },
      south: { corners:[
        { cx:0,  cy:0,  r:6, quad:'br' },
        { cx:48, cy:0,  r:6, quad:'bl' },
        { cx:0,  cy:48, r:6, quad:'tr' },
        { cx:48, cy:48, r:6, quad:'tl' }
      ]}
    }
  }
};

export const APPROACH_BEHAVIOURS = {
  directly_deploy:{ name:'Directly Deploy', short:'Direct',
    desc:'Place ≥50% of Groups in Zone before Round 1. Off-table Groups cannot activate Round 1; may from Round 2+.' },
  close:          { name:'Close',           short:'Close',
    desc:'May activate and deploy any off-table Group from Round 1.' },
  distant:        { name:'Distant',         short:'Distant',
    desc:'R1 — L tonnage only · R2 — also M · R3+ — any Group.' },
  // ── Scenario Expansion 1 approach types ──
  imminent:       { name:'Imminent',        short:'Imminent',
    desc:'R1 — L & M tonnage only · R2 — also H · R3+ — any Group.' },
  backline:       { name:'Backline',        short:'Backline',
    desc:'R1 — H & C tonnage only · R2+ — any Group. Vanguard-X used as normal.' },
  staggered:      { name:'Staggered',       short:'Staggered',
    desc:'R1 — activate/deploy X Groups · R2 — X more · R3 — the rest. X = 1 (≤1000 pts) / 2 (≤2000) / 3 (≤3000) / 4+ (3001+). Engine-enforced.' }
};

export const APPROACHES = {
  standoff:                { d6:1, name:'Standoff',                south:'directly_deploy', north:'directly_deploy' },
  close_enough:            { d6:2, name:'Close Enough',            south:'close',           north:'close' },
  column:                  { d6:3, name:'Column',                  south:'distant',         north:'distant' },
  counterattack:           { d6:4, name:'Counterattack',           south:'directly_deploy', north:'close' },
  delayed_response:        { d6:5, name:'Delayed Response',        south:'close',           north:'distant' },
  home_fleet_disadvantage: { d6:6, name:'Home Fleet Disadvantage', south:'close',           north:'directly_deploy' },
  // ── Scenario Expansion 1 approaches (bespoke — hidden from the random generator) ──
  all_imminent:   { d6:0, bespoke:true, name:'All Imminent',  south:'imminent',  north:'imminent'  },
  all_backline:   { d6:0, bespoke:true, name:'All Backline',  south:'backline',  north:'backline'  },
  all_staggered:  { d6:0, bespoke:true, name:'All Staggered', south:'staggered', north:'staggered' },
  // Moonbreaker: attacker (south/Red) Staggered, defender (north/Blue) Directly Deployed.
  exp_attacker_staggered: { d6:0, bespoke:true, name:'Attacker Staggered', south:'staggered', north:'directly_deploy' },
  // Moonguard: attacker (south/Red) Directly Deployed, defender (north/Blue) Imminent.
  exp_defender_imminent:  { d6:0, bespoke:true, name:'Defender Imminent',  south:'directly_deploy', north:'imminent' }
};

// Internal helpers used only by VARIANTS.apply() functions.
const sizeOf = (type) => DROPSITE_BASE[type].size;
const hasDefender = (depKey) => depKey === 'attacker_defender';

export const VARIANTS = {
  none: {
    d6:0, name:'No Variant', short:'None — base layout only',
    desc:'No variant applied.',
    apply:(base)=>({ dropsites: base.map(d=>({...d})), features:{}, scenery:{} })
  },
  guarded_sectors: {
    d6:1, name:'Guarded Sectors',
    short:'All Dropsites +Mil Outpost. Large +ODG.',
    desc:'Each Dropsite gains a Military Outpost; each Large Dropsite also an Orbital Defence Gun. If the deployment uses a Defender, the Defender may place an additional Military Outpost on any Dropsite.',
    apply:(base, depKey)=>{
      const features = {};
      base.forEach(d=>{
        features[d.id] = ['military_outpost'];
        if (sizeOf(d.type) === 'large') features[d.id].push('orbital_defence_gun');
      });
      return {
        dropsites: base.map(d=>({...d})),
        features,
        scenery:{},
        note: hasDefender(depKey) ? 'Defender may place an additional Military Outpost on any Dropsite (add manually).' : null
      };
    }
  },
  secure_comms_array: {
    d6:2, name:'Secure Comms Array',
    short:'Medium Cities +Comms. Large Cities → Large Stations + ODG + Power Plant.',
    desc:'Each Medium City (or Small if no Medium present) gains a Comms Station. Replace each Large City with a Large Space Station containing an Orbital Defence Gun and Power Plant.',
    apply:(base)=>{
      const features = {};
      const hasMediumCity = base.some(d=>d.type==='medium_city');
      const commsTier = hasMediumCity ? 'medium_city' : 'small_city';
      const dropsites = base.map(d=>{
        if (d.type === 'large_city') {
          features[d.id] = ['orbital_defence_gun','power_plant'];
          return { ...d, type:'large_station' };
        }
        if (d.type === commsTier) features[d.id] = ['comms_station'];
        return { ...d };
      });
      return { dropsites, features, scenery:{} };
    }
  },
  battlescarred: {
    d6:3, name:'Battlescarred',
    short:'+1 Micro/Dense. Medium dropsites +2 Power Plants.',
    desc:'Each player places an additional Micrometeor Cloud and Dense Field (overlapping for larger areas). Each Medium City and Medium Space Station gain two Power Plants.',
    apply:(base)=>{
      const features = {};
      base.forEach(d=>{
        if (d.type === 'medium_city' || d.type === 'medium_station') features[d.id] = ['power_plant','power_plant'];
      });
      return {
        dropsites: base.map(d=>({...d})),
        features,
        scenery:{ micrometeorBonus:2, denseBonus:2 }
      };
    }
  },
  gridlocked: {
    d6:4, name:'Gridlocked',
    short:'All Dropsites +Power Plant. Medium Cities → Med Stations + Mil + ODG + Hangar.',
    desc:'Each Dropsite gains a Power Plant. Replace each Medium City with a Medium Space Station gaining a Military Outpost, Orbital Defence Gun, and Hangar.',
    apply:(base)=>{
      const features = {};
      const dropsites = base.map(d=>{
        features[d.id] = ['power_plant'];
        if (d.type === 'medium_city') {
          features[d.id] = ['military_outpost','orbital_defence_gun','hangar','power_plant'];
          return { ...d, type:'medium_station' };
        }
        return { ...d };
      });
      return { dropsites, features, scenery:{} };
    }
  },
  expansive_atmosphere: {
    d6:5, name:'Expansive Atmosphere',
    short:'Players each place 2 Features. CC/MT take 1 hit at end of activation.',
    desc:'Groups on Course Change and Max Thrust suffer 1 hit at the end of their activation (Energy or Kinetic save). Ships may launch Ground Assets at Dropsites in any Orbital Layer. Each Red player places 2 Features of their choice on a Dropsite; each Blue player places 2 on any other Dropsite.',
    apply:(base)=>({
      dropsites: base.map(d=>({...d})),
      features:{},
      scenery:{},
      note:'Players manually choose & place their 2 Features each.'
    })
  },
  orbital_complex: {
    d6:6, name:'Orbital Complex',
    short:'All Cities → Space Stations + Mil Outpost. Orbit only.',
    desc:'Replace each City with a Space Station of equal size; each Space Station gains a Military Outpost. Only Orbit is used. Orbital Decay tokens cause D3 damage at end of activation (Colossal: 2D3).',
    apply:(base)=>{
      const features = {};
      const dropsites = base.map(d=>{
        let newType = d.type;
        if (d.type === 'small_city')  newType = 'small_station';
        if (d.type === 'medium_city') newType = 'medium_station';
        if (d.type === 'large_city')  newType = 'large_station';
        features[d.id] = ['military_outpost'];
        return { ...d, type:newType };
      });
      return { dropsites, features, scenery:{} };
    }
  },
  civic_infrastructure: {
    d6:0, bespoke:true, name:'Civic Infrastructure',
    short:'Each Medium City +Power Plant, Hangar & Comms.',
    desc:'Each Medium City gains a Power Plant, a Hangar and a Comms Station.',
    apply:(base)=>{
      const features = {};
      base.forEach(d=>{
        if (d.type === 'medium_city') features[d.id] = ['power_plant','hangar','comms_station'];
      });
      return { dropsites: base.map(d=>({...d})), features, scenery:{} };
    }
  },
  shock_and_yaw: {
    d6:0, bespoke:true, name:'Shock and Yaw',
    short:'Sm City +Hangar · Med City +Mil Outpost · Med Station +2 Power Plants · Lg Station +Comms & ODG.',
    desc:'Each Small City gains a Hangar; each Medium City a Military Outpost; the central Medium Space Station two Power Plants; each Large Space Station a Comms Station and an Orbital Defence Gun. Special: destroying a Power Plant deals no extra damage to the Medium Space Station, but instead all Groups within 6" gain two Spikes and all Ships within 6" gain a Scanners Offline token.',
    apply:(base)=>{
      const features = {};
      base.forEach(d=>{
        if (d.type === 'small_city')     features[d.id] = ['hangar'];
        if (d.type === 'medium_city')    features[d.id] = ['military_outpost'];
        if (d.type === 'medium_station') features[d.id] = ['power_plant','power_plant'];
        if (d.type === 'large_station')  features[d.id] = ['comms_station','orbital_defence_gun'];
      });
      return {
        dropsites: base.map(d=>({...d})),
        features,
        scenery:{},
        note:'Power Plant destruction: no extra damage to the Medium Station; all Groups within 6" gain 2 Spikes and all Ships within 6" gain Scanners Offline (adjudicate manually).'
      };
    }
  },
  orbital_support: {
    d6:0, bespoke:true, name:'Orbital Support',
    short:'Med Station/Large Cities +2 Mil Outposts. Small Cities +ODG & Mil Outpost.',
    desc:'The central Medium Space Station and each Large City gain two Military Outposts; each Small City gains an Orbital Defence Gun and a Military Outpost.',
    apply:(base)=>{
      const features = {};
      base.forEach(d=>{
        if (d.type === 'medium_station' || d.type === 'large_city') features[d.id] = ['military_outpost','military_outpost'];
        if (d.type === 'small_city') features[d.id] = ['orbital_defence_gun','military_outpost'];
      });
      return { dropsites: base.map(d=>({...d})), features, scenery:{} };
    }
  },
  entrapmoont: {
    d6:0, bespoke:true, name:'Entrapmoont',
    short:'Large Stations +Military Outpost & ODG. Small Cities +Military Outpost. Blue may add 1 Military Outpost.',
    desc:'Each Large Space Station gains a Military Outpost and an Orbital Defence Gun; each Small City gains a Military Outpost. Special: at the start of the first Planning Phase, the Blue (defending) team may place one additional Military Outpost on any Dropsite.',
    apply:(base)=>{
      const features = {};
      base.forEach(d=>{
        if (d.type === 'large_station') features[d.id] = ['military_outpost','orbital_defence_gun'];
        if (d.type === 'small_city')    features[d.id] = ['military_outpost'];
      });
      return {
        dropsites: base.map(d=>({...d})),
        features,
        scenery:{},
        note:'Blue (defending) team may place 1 additional Military Outpost on any Dropsite at the start of the first Planning Phase (add manually).'
      };
    }
  }
};

// Focal Points ship values by tonnage.
// special tags on a focal point: 'low_crippled', 'low_north', 'low_south'
export const FOCAL_HIGH = { L: 1, M:  4, H:  7, C: 11 };
export const FOCAL_LOW  = { L: 0, M:  1, H:  3, C:  5 };

export const SECONDARY_OBJECTIVES = {
  annihilate:   { name:'Annihilate',   desc:'1 VP per 500 pts of Ships/Admirals you destroyed (max 3).' },
  take_prizes:  { name:'Take Prizes',  desc:'1 VP per 100 pts of captured Ships (max 3).' },
  gather_intel: { name:'Gather Intel', desc:'1 VP per Dropsite you Surveyed (max 2).' },
  decapitate:   { name:'Decapitate',   desc:'2 VP if you kill the opponent\'s highest-Level Admiral.' },
  key_site:     { name:'Key Site',     desc:'Nominate a Dropsite 24"+ from your Zone. Control at game end: 2 VP (3 near opponent Zone).', nominate:'dropsite' },
  priority_target:{ name:'Priority Target', desc:'Nominate a M/L Dropsite 24"+ from your Zone. Levelled at game end: 2 VP (3 near opponent Zone).', nominate:'dropsite' },
  long_shot:    { name:'Long Shot',    desc:'Nominate a Feature within 12" of opponent Zone. Destroyed by game end: 2 VP.', nominate:'feature' },
  objectives_beyond:{ name:'Objectives Beyond', desc:'Nominate an M+ Ship. Fly it off in an opponent Zone uncrippled: 1 VP (2 if H/C).', nominate:'ship' }
};

export const OBJECTIVES = {
  standard:     { d6:0, name:'Standard',     short:'Standard Scoring only',
    desc:'Standard Scoring on Rounds 4 and 6. No additional VP rules.',
    bonus:null, scoring:'control_contest' },
  attrition:    { d6:1, name:'Attrition',    short:'+2 VP per 500 pts destroyed',
    desc:'Standard Scoring. +2 VP per 500 pts of Ships/Admirals destroyed at game end.',
    bonus:'+2 VP at game end per 500 pts of Ships & Admirals destroyed', scoring:'control_contest' },
  survey:       { d6:2, name:'Survey',       short:'+1 VP per Dropsite Surveyed',
    desc:'Standard Scoring. +1 VP per Dropsite Surveyed. Capital Ship within 6" of a Dropsite that could fire may instead Survey it.',
    bonus:'+1 VP per Dropsite Surveyed (once per player per game)', scoring:'control_contest' },
  extract:      { d6:3, name:'Extract',      short:'Recon Operatives tokens',
    desc:'Place Recon Operatives: 1 (Small) / 2 (Medium) / 3 (Large). Ships launching Battalions may Extract instead. 2 VP per Operative aboard at end. 1 VP per enemy Ship killed with Operatives aboard.',
    bonus:'+2 VP per Recon Operative aboard at game end · +1 VP per enemy Ship destroyed while carrying any', scoring:'none' },
  protect:      { d6:4, name:'Protect',      short:'Nominate a Dropsite',
    desc:'Standard Scoring. After Initiative, each player nominates a unique Dropsite. Bonus Standard Scoring if it survives. Penalty if it is Levelled.',
    bonus:'Bonus Standard Scoring for your Dropsite while intact · penalty if Levelled', scoring:'control_contest' },
  breakthrough: { d6:5, name:'Breakthrough', short:'Red flies off, others score kills',
    desc:'Red may fly Ships off in opponent\'s DZ: 1 VP per 200 pts. Others: 2 VP per 500 pts destroyed.',
    bonus:'Red: +1 VP per 200 pts flown off · Others: +2 VP per 500 pts destroyed', scoring:'none' },
  raze:         { d6:6, name:'Raze',         short:'Double VP for distant Levelled/Ruined',
    desc:'Double Standard Scoring for each Dropsite Levelled/Ruined 24"+ from your DZ. +2 VP per 500 pts destroyed.',
    bonus:'Double VP for Levelled/Ruined ≥24" from your zone · +2 VP per 500 pts destroyed', scoring:'levelled_ruined' },
  // ── Scenario Expansion 1 scoring methods (bespoke — hidden from the random generator) ──
  // Normal Scoring — Control/Contest a Dropsite (2/0, 3/1, 4/2) on Rounds 4 & 6.
  // Functionally identical to Standard Scoring, so it reuses the same engine path.
  normal:       { d6:0, bespoke:true, name:'Normal', short:'Control/Contest Dropsites (R4 & R6)',
    desc:'Normal Scoring: High Scoring when you Control a Dropsite, Low Scoring when you Contest it (Small 2/0, Medium 3/1, Large 4/2). Scored on Rounds 4 and 6.',
    bonus:null, scoring:'control_contest' },
  // Demolish — High when Levelled, Low when Ruined. Engine-scored immediately on breach.
  // No R4/R6 dropsite scoring for Demolish games.
  demolish:     { d6:0, bespoke:true, name:'Demolish', short:'Score for Levelling / Ruining Dropsites',
    desc:'Demolish Scoring: immediately gain High Scoring when you Level a Dropsite (Small 2/Medium 3/Large 4), Low Scoring when you Ruin it (Small 0/Medium 1/Large 2). No R4/R6 dropsite scoring.',
    bonus:'High when Levelled (2/3/4) · Low when Ruined (0/1/2)', scoring:'none' },
  // Focal Points — sum of ship value within range; no engine machinery, adjudicated manually.
  focal_points: { d6:0, bespoke:true, name:'Focal Points', short:'Ship value within range (manual)',
    desc:'Focal Points Scoring: total your Ships’ value within range of each Focal Point. Highest combined value scores 3 VP; any other player with ≥ half scores 1 VP. Scored on R4 & R6. Adjudicated manually — the scenario summary lists each Focal Point.',
    bonus:'Highest value in range: 3 VP · ≥ half: 1 VP (manual)', scoring:'none' },
  // Kill Points — 2 VP per 500 pts of Ships/Admirals destroyed at game end. Engine-scored.
  kill_points:  { d6:0, bespoke:true, name:'Kill Points', short:'+2 VP per 500 pts destroyed (game end)',
    desc:'Kill Points Scoring: 2 VP at the end of the game for every 500 points of Ships and Admirals you have destroyed.',
    bonus:'+2 VP per 500 pts of Ships & Admirals destroyed at game end', scoring:'none' },
  // Assess — Capital Ship on GQ within 6" of an eligible Dropsite may Assess it instead of attacking/launching.
  assess:       { d6:0, bespoke:true, name:'Assess', short:'1–2 VP per Dropsite Assessed',
    desc:'Assess Scoring: while on General Quarters, a Capital Ship within 6" of an eligible Dropsite (marked assess/assess_south/assess_north) may Assess it instead of attacking/launching. Each Dropsite assessed once per player. 1 VP, or 2 VP if the dropsite has double_assess for that zone.',
    bonus:'+1 VP per Dropsite Assessed (2 VP on double_assess dropsites)', scoring:'none' }
};

export const ASSET_PROFILES = {
  ucm: {
    fighter:  { thrust: 13, rerolls: 1 },
    bomber:   { thrust: 10, att: 2, lock: '3+', dmg: 1, type: 'K' },
    fireship: { thrust: 8,  att: 3, lock: '4+', dmg: 1, type: 'K' },
    torpedo:  { thrust: 6,  att: 4, lock: '2+', dmg: 2, type: 'K', special: 'Penetrator' },
    mine:     { thrust: 4,  att: 2, lock: '2+', dmg: 2, type: 'K' }
  },
  shaltari: {
    fighter:  { thrust: 16, rerolls: 1 },
    bomber:   { thrust: 13, att: 2, lock: '3+', dmg: 1, type: 'E' },
    fireship: { thrust: 7,  att: 4, lock: '5+', dmg: 1, type: 'K' },
    torpedo:  { thrust: 6,  att: 3, lock: '4+', dmg: 3, type: 'C', special: 'Flash-2' },
    mine:     { thrust: 6,  att: 4, lock: '3+', dmg: 1, type: 'E' }
  },
  phr: {
    fighter:  { thrust: 12, rerolls: 2 },
    bomber:   { thrust: 9,  att: 2, lock: '2+', dmg: 1, type: 'K' },
    fireship: { thrust: 8,  att: 3, lock: '4+', dmg: 1, type: 'K' },
    torpedo:  { thrust: 6,  att: 4, lock: '2+', dmg: 2, type: 'K', special: 'Penetrator' },
    mine:     { thrust: 4,  att: 2, lock: '2+', dmg: 2, type: 'K' }
  },
  scourge: {
    fighter:  { thrust: 14, rerolls: 2 },
    bomber:   { thrust: 12, att: 2, lock: '3+', dmg: 1, type: 'K', special: 'Crippling-Fire' },
    fireship: { thrust: 7,  att: 3, lock: '4+', dmg: 1, type: 'K' },
    torpedo:  { thrust: 8,  att: 6, lock: '4+', dmg: 1, type: 'K', special: 'Corruptor-2, Crippling-Fire' },
    mine:     { thrust: 6,  att: 3, lock: '4+', dmg: 1, type: 'K', special: 'Corruptor-1' }
  },
  resistance: {
    fighter:  { thrust: 16, rerolls: 3 },
    bomber:   { thrust: 10, att: 3, lock: '4+', dmg: 1, type: 'K' },
    fireship: { thrust: 3,  att: 3, lock: '2+', dmg: 1, type: 'E' },
    torpedo:  { thrust: 6,  att: 6, lock: '2+', dmg: 1, type: 'K', special: 'Penetrator' },
    mine:     { thrust: 3,  att: 5, lock: '4+', dmg: 1, type: 'K' }
  },
  bioficer: {
    fighter:  { thrust: 16, rerolls: 1 },
    bomber:   { thrust: 13, att: 3, lock: '4+', dmg: 1, type: 'K' },
    fireship: { thrust: 8,  att: 3, lock: '4+', dmg: 1, type: 'E' },
    torpedo:  { thrust: 12, att: 3, lock: '2+', dmg: 1, type: 'K', special: 'Corruptor-2' },
    mine:     { thrust: 5,  att: 4, lock: '3+', dmg: 1, type: 'K' }
  }
};
