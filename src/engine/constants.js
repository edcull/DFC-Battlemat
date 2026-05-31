// Extracted from web/index.html. Pure data constants — no DOM, no state references.
// All exports are safe to import in Node.js (server) or browser (client).

export const UCM_FLEET = [
  {
    id:'u1', name:'Bruges', role:'Cruiser', pts:84, tonnage:'M', side:'ucm',
    thrust:8, scan:6, sig:6, hull:10, es:'4+', ks:'3+', bs:'—',
    weapons:[
      {name:'Cobra Heavy Laser', arc:'FN', att:4, lock:'3+', dmg:1, type:'E', special:'Burnthrough-1, Flash-1, Focused'},
      {name:'Taipan Laser Turrets', arc:'F/S', att:2, lock:'2+', dmg:1, type:'E', special:'Scald-2'}
    ],
    special:'—'
  },
  {
    id:'u2', name:'Edmonton', role:'Heavy Carrier', pts:135, tonnage:'M', side:'ucm',
    thrust:7, scan:6, sig:6, hull:12, es:'4+', ks:'3+', bs:'6+',
    weapons:[
      {name:'Cobra Heavy Laser', arc:'FN', att:4, lock:'3+', dmg:1, type:'E', special:'Burnthrough-1, Flash-1, Focused'},
      {name:'UF-6400 Mass Driver Turrets', arc:'F/S', att:4, lock:'3+', dmg:1, type:'K', special:'Critical-1'}
    ],
    launch:[{name:'Fighters & Bombers', n:2, type:'fighter_bomber'}],
    special:'—'
  },
  {
    id:'u3', name:'San Francisco', role:'Troopship', pts:100, tonnage:'M', side:'ucm',
    thrust:8, scan:6, sig:6, hull:10, es:'4+', ks:'3+', bs:'—',
    weapons:[
      {name:'UF-4200 Mass Driver Turrets', arc:'F/S', att:4, lock:'4+', dmg:1, type:'K', special:'Fusillade-2'}
    ],
    launch:[{name:'Bulk Landers', n:4, type:'bulk_lander'}],
    special:'—'
  },
  {
    id:'u4', name:'Toulon', role:'Frigate', pts:60, tonnage:'L', side:'ucm', groupSize:2,
    thrust:10, scan:6, sig:3, hull:4, es:'4+', ks:'3+', bs:'—',
    weapons:[
      {name:'UF-2200 Mass Driver Turret Triad', arc:'F/S', att:3, lock:'4+', dmg:1, type:'K', special:'Fusillade-2'}
    ],
    special:'—'
  },
  {
    id:'u5', name:'New Orleans', role:'Strike Carrier', pts:90, tonnage:'L', side:'ucm', groupSize:2,
    thrust:10, scan:6, sig:3, hull:4, es:'4+', ks:'3+', bs:'—',
    weapons:[
      {name:'UF-2200 Mass Driver Turret', arc:'F/S', att:1, lock:'4+', dmg:1, type:'K', special:'—'}
    ],
    launch:[{name:'Dropships', n:1, type:'dropship'}],
    special:'Descent'
  },
  {
    id:'u6', name:'Lima', role:'Detector Frigate', pts:80, tonnage:'L', side:'ucm', groupSize:2,
    thrust:10, scan:6, sig:3, hull:4, es:'4+', ks:'3+', bs:'—',
    weapons:[
      {name:'UF-2200 Mass Driver Turret', arc:'F/S', att:1, lock:'4+', dmg:1, type:'K', special:'—'},
      {name:'Detector', arc:'LoS', att:'—', lock:'—', dmg:'—', type:'—', special:'Forgo weapon → 2 Spikes on enemy in LoS'}
    ],
    special:'Detector, Rare'
  }
];

export const SHAL_FLEET = [
  {
    id:'s1', name:'Obsidian', role:'Heavy Cruiser', pts:135, tonnage:'M', side:'shal',
    thrust:8, scan:12, sig:6, hull:11, es:'5+', ks:'4+', bs:'—',
    weapons:[
      {name:'Particle Lance', arc:'FN', att:1, lock:'3+', dmg:2, type:'C', special:'Critical-1'},
      {name:'Particle Lance', arc:'FN', att:1, lock:'3+', dmg:2, type:'C', special:'Critical-1'},
      {name:'Particle Lance', arc:'FN', att:1, lock:'3+', dmg:2, type:'C', special:'Critical-1'}
    ],
    special:'Shield-4+'
  },
  {
    id:'s2', name:'Basalt', role:'Fleet Carrier', pts:108, tonnage:'M', side:'shal',
    thrust:10, scan:12, sig:6, hull:9, es:'5+', ks:'4+', bs:'—',
    weapons:[
      {name:'Disruptor Pair', arc:'FN', att:8, lock:'4+', dmg:1, type:'E', special:'—'}
    ],
    launch:[{name:'Fighters & Bombers', n:2, type:'fighter_bomber'}],
    special:'Shield-5+'
  },
  {
    id:'s3', name:'Emerald', role:'Mothership', pts:115, tonnage:'M', side:'shal',
    thrust:10, scan:12, sig:6, hull:9, es:'5+', ks:'4+', bs:'—',
    weapons:[
      {name:'Disruptor Pair', arc:'FN', att:8, lock:'4+', dmg:1, type:'E', special:'—'}
    ],
    launch:[{name:'Dropships (Voidgate)', n:4, type:'gate_dropship'}],
    special:'Mothership, Shield-5+'
  },
  {
    id:'s4', name:'Topaz', role:'Frigate', pts:86, tonnage:'L', side:'shal', groupSize:2,
    thrust:12, scan:10, sig:4, hull:4, es:'5+', ks:'4+', bs:'—',
    weapons:[
      {name:'Disintegrator Bank', arc:'F', att:3, lock:'3+', dmg:1, type:'E', special:'Reave-1'}
    ],
    special:'Shield-5+, Vanguard-4"'
  },
  {
    id:'s5', name:'Opal', role:'Shielding Frigate', pts:90, tonnage:'L', side:'shal', groupSize:2,
    thrust:12, scan:10, sig:4, hull:4, es:'5+', ks:'4+', bs:'—',
    weapons:[
      {name:'Harpoon Strike', arc:'F/S/R', att:2, lock:'4+', dmg:1, type:'K', special:'Close Action'}
    ],
    special:'Shield-5+, Vanguard-4", Shield Booster'
  },
  {
    id:'s6', name:'Voidgates', role:'Voidgates ×3', pts:45, tonnage:'L', side:'shal', groupSize:3,
    thrust:12, scan:2, sig:2, hull:3, es:'5+', ks:'5+', bs:'—', openNetwork:true, gateship:2,
    weapons:[],
    special:'Descent, Gateship-2, Shield-5+, Open Network'
  }
];

/* PHR fleet: Theseus, Ikarus, Orpheus, 2×Pandora, 2×Medea.
   side is assigned at init based on the chosen slot. */
export const PHR_FLEET = [
  {
    id:'p1', name:'Theseus', role:'Light Cruiser', pts:88, tonnage:'M',
    thrust:10, scan:8, sig:6, hull:9, es:'3+', ks:'4+', bs:'—',
    weapons:[
      {name:'Light Calibre Broadside', arc:'B', att:6, lock:'5+', dmg:1, type:'K', special:'Calibre-L, Re-Entry, Volley-2'},
      {name:'Medium Calibre Broadside', arc:'B', att:3, lock:'4+', dmg:2, type:'K', special:'Fusillade-1, Volley-2'}
    ],
    special:'—'
  },
  {
    id:'p2', name:'Ikarus', role:'Vanguard Carrier', pts:125, tonnage:'M', vanguard:4,
    thrust:8, scan:8, sig:6, hull:11, es:'3+', ks:'4+', bs:'—',
    weapons:[
      {name:'Medium Calibre Broadside', arc:'B', att:3, lock:'4+', dmg:2, type:'K', special:'Fusillade-1, Volley-2'},
      {name:'Medium Calibre Turret', arc:'F', att:1, lock:'4+', dmg:2, type:'K', special:'—'}
    ],
    launch:[{name:'Fighters & Bombers', n:2, type:'fighter_bomber'}],
    special:'Vanguard-4"'
  },
  {
    id:'p3', name:'Orpheus', role:'Assault Troopship', pts:170, tonnage:'M',
    thrust:7, scan:8, sig:6, hull:13, es:'3+', ks:'4+', bs:'6+',
    weapons:[
      {name:'Light Calibre Broadside', arc:'B', att:6, lock:'5+', dmg:1, type:'K', special:'Calibre-L, Re-Entry, Volley-2'},
      {name:'Supernova Laser', arc:'FN', att:3, lock:'3+', dmg:1, type:'E', special:'Burnthrough-1, Flash-1, Focused'}
    ],
    launch:[{name:'Bulk Landers', n:4, type:'bulk_lander'}],
    special:'—'
  },
  {
    id:'p4', name:'Pandora', role:'Frigate', pts:42, tonnage:'L', groupSize:2,
    thrust:10, scan:8, sig:3, hull:5, es:'3+', ks:'4+', bs:'—',
    weapons:[
      {name:'Supernova Laser', arc:'FN', att:3, lock:'3+', dmg:1, type:'E', special:'Burnthrough-1, Flash-1, Focused'}
    ],
    special:'—'
  },
  {
    id:'p5', name:'Medea', role:'Strike Carrier', pts:50, tonnage:'L', groupSize:2,
    thrust:10, scan:8, sig:3, hull:5, es:'3+', ks:'4+', bs:'—',
    weapons:[
      {name:'Bombardment Turret', arc:'F/S', att:3, lock:'5+', dmg:1, type:'K', special:'Bombardment'}
    ],
    launch:[{name:'Dropships', n:1, type:'dropship'}],
    special:'Descent'
  }
];

/* Resistance fleet: 3 configured Cruisers + 2×Strike Carriers + 2×Heavy Frigates.
   Resistance ships use modular hardpoints; loadouts are baked here. */
export const RESISTANCE_FLEET = [
  {
    id:'r1', name:'Cruiser (Vent/Hybrid)', role:'Cruiser', pts:90, tonnage:'M',
    thrust:5, scan:6, sig:6, hull:13, es:'3+', ks:'4+', bs:'6+',  // hull10 +1/+1 saves via Ablative; Reinforced
    weapons:[
      {name:'Vent Cannon Turret', arc:'F/S', att:3, lock:'3+', dmg:1, type:'E', special:'Overcharge, Reave-1'},
      {name:'N-31 Hybrid Gun Bank', arc:'B', att:3, lock:'4+', dmg:1, type:'K', special:'Volley-2'},
      {name:'N-31 Hybrid Gun Bank', arc:'B', att:3, lock:'4+', dmg:1, type:'K', special:'Volley-2'}
    ],
    special:'Ablative Armour (Reinforced Armour, +1 ES/KS)'
  },
  {
    id:'r2', name:'Cruiser (Carrier)', role:'Cruiser', pts:97, tonnage:'M',
    thrust:5, scan:10, sig:6, hull:10, es:'4+', ks:'5+', bs:'6+',  // Scanner Array +4 Scan
    weapons:[
      {name:'NC-16 Missile Bank', arc:'B', att:6, lock:'3+', dmg:1, type:'K', special:'Close Action, Volley-2'},
      {name:'XN-31 Mass Driver Turret', arc:'F/S', att:2, lock:'2+', dmg:1, type:'K', special:'Critical-1'}
    ],
    launch:[{name:'Fighters & Bombers', n:2, type:'fighter_bomber'}],
    special:'Scanner Array (+4" Scan)'
  },
  {
    id:'r3', name:'Cruiser (Lander)', role:'Cruiser', pts:106, tonnage:'M',
    thrust:8, scan:6, sig:6, hull:10, es:'4+', ks:'5+', bs:'6+',  // Drive Refit +3 Thrust
    weapons:[
      {name:'N-109 Bombardment Mortar Turret', arc:'F/S/R', att:3, lock:'4+', dmg:1, type:'K', special:'Bombardment, Scald-1'}
    ],
    launch:[
      {name:'Bulk Landers', n:4, type:'bulk_lander', link:'bl_fs'},
      {name:'Fire Ships', n:2, type:'fireship', link:'bl_fs'}  // half of 4
    ],
    special:'Drive Refit (+3" Thrust)'
  },
  {
    id:'r4', name:'Strike Carriers', role:'Strike Carrier', pts:40, tonnage:'L', groupSize:2,
    thrust:11, scan:4, sig:2, hull:4, es:'5+', ks:'5+', bs:'—',
    weapons:[
      {name:'N-31 Hybrid Gun Turret', arc:'F/S', att:2, lock:'3+', dmg:1, type:'K', special:'Fusillade-1'}
    ],
    launch:[{name:'Dropships', n:1, type:'dropship'}],
    special:'Descent'
  },
  {
    id:'r5', name:'Heavy Frigates', role:'Heavy Frigate', pts:42, tonnage:'L', groupSize:2,
    thrust:9, scan:4, sig:2, hull:5, es:'4+', ks:'5+', bs:'—',
    weapons:[
      {name:'NC-16 Missile Turret', arc:'F/S/R', att:6, lock:'3+', dmg:1, type:'K', special:'Close Action'},
      {name:'Light Vent Cannon Turret', arc:'F/S', att:2, lock:'4+', dmg:1, type:'E', special:'Overcharge, Reave-1'}
    ],
    special:'Reinforced Armour'
  }
];

/* Faction registry — maps a faction key to its display name and ship list.
   Ships' `side` (colour/orientation slot) is assigned at init time. */
export const SCOURGE_FLEET = [
  {
    id:'sc1', name:'Sphinx', role:'Cruiser', pts:90, tonnage:'M',
    thrust:10, scan:6, sig:8, hull:10, es:'4+', ks:'4+', bs:'—', groupSize:1,
    weapons:[
      {name:'Oculus Beams', arc:'F', att:1, lock:'3+', dmg:2, type:'E', special:'Scald-1'},
      {name:'Oculus Beam Array', arc:'F/S', att:4, lock:'3+', dmg:2, type:'E', special:'Scald-1'},
      {name:'Plasma Gale', arc:'F/S', att:3, lock:'3+', dmg:1, type:'K', special:'Close Action, Scald-2'}
    ],
    special:'—'
  },
  {
    id:'sc2', name:'Hydra', role:'Fleet Carrier', pts:135, tonnage:'M',
    thrust:10, scan:6, sig:8, hull:10, es:'4+', ks:'4+', bs:'—', groupSize:1,
    weapons:[
      {name:'Oculus Beams', arc:'F', att:1, lock:'3+', dmg:2, type:'E', special:'Scald-1'},
      {name:'Plasma Gale', arc:'F/S', att:3, lock:'3+', dmg:1, type:'K', special:'Close Action, Scald-2'}
    ],
    launch:[{name:'Fighters & Bombers', n:3, type:'fighter_bomber'}],
    special:'Minelayer (may swap F&B for 3 Mines, +10 pts)'
  },
  {
    id:'sc3', name:'Chimera', role:'Troopship', pts:95, tonnage:'M',
    thrust:10, scan:6, sig:8, hull:10, es:'4+', ks:'4+', bs:'—', groupSize:1,
    weapons:[
      {name:'Oculus Beams', arc:'F', att:1, lock:'3+', dmg:2, type:'E', special:'Scald-1'},
      {name:'Plasma Gale', arc:'F/S', att:3, lock:'3+', dmg:1, type:'K', special:'Close Action, Scald-2'}
    ],
    launch:[{name:'Bulk Landers', n:4, type:'bulk_lander'}],
    special:'—'
  },
  {
    id:'sc4', name:'Gargoyle', role:'Strike Carrier', pts:40, tonnage:'L', groupSize:2,
    thrust:12, scan:6, sig:3, hull:4, es:'5+', ks:'5+', bs:'—',
    weapons:[
      {name:'Oculus Rays', arc:'F', att:2, lock:'3+', dmg:1, type:'E', special:'Scald-1'}
    ],
    launch:[{name:'Dropships', n:1, type:'dropship'}],
    special:'Descent'
  },
  {
    id:'sc5', name:'Harpy', role:'Frigate', pts:40, tonnage:'L', groupSize:2,
    thrust:12, scan:6, sig:3, hull:4, es:'5+', ks:'5+', bs:'—',
    weapons:[
      {name:'Oculus Beams', arc:'F/S', att:2, lock:'3+', dmg:2, type:'E', special:'Scald-1'}
    ],
    special:'Descent'
  }
];

export const BIOFICER_FLEET = [
  {
    id:'bf1', name:'Comet', porter:{size:'S',cap:1}, role:'Cruiser', pts:82, tonnage:'M', groupSize:1,
    thrust:8, scan:8, sig:3, hull:7, es:'4+', ks:'4+', bs:'—',
    weapons:[
      {name:'Thermator', arc:'F', att:3, lock:'4+', dmg:2, type:'E', special:'Overcharge, Scald-1'},
      {name:'Decon Blaster', arc:'FN', att:3, lock:'3+', dmg:1, type:'E', special:'—'}
    ],
    special:'Porter S-1'
  },
  {
    id:'bf2', name:'Cavern', porter:{size:'S',cap:1}, role:'Fleet Carrier', pts:125, tonnage:'M', groupSize:1,
    thrust:8, scan:8, sig:3, hull:7, es:'4+', ks:'4+', bs:'—',
    weapons:[
      {name:'Scythes', arc:'FN', att:8, lock:'4+', dmg:1, type:'E', special:'Anti Wing, Fusillade-3, Reave-1'}
    ],
    launch:[{name:'Fighters & Bombers', n:2, type:'fighter_bomber'}],
    special:'Porter S-1, Minelayer (may swap F&B for 2 Mines, +10 pts)'
  },
  {
    id:'bf3', name:'Catastrophe', porter:{size:'S',cap:1}, role:'Heavy Cruiser', pts:110, tonnage:'M', groupSize:1,
    thrust:7, scan:8, sig:4, hull:9, es:'4+', ks:'4+', bs:'5+',
    weapons:[
      {name:'Heavy Lightvice', arc:'F', att:5, lock:'2+', dmg:2, type:'K', special:'Close Action, Focused'},
      {name:'Thermator', arc:'F', att:3, lock:'4+', dmg:2, type:'E', special:'Overcharge, Scald-1'}
    ],
    special:'Porter S-1'
  },
  {
    id:'bf4', name:'Prism Cell', payload:{size:'S'}, role:'Cell', pts:10, tonnage:'L', groupSize:1,
    thrust:2, scan:8, sig:1, hull:2, es:'4+', ks:'4+', bs:'6+',
    weapons:[
      {name:'Prism', arc:'F/S/R', att:4, lock:'3+', dmg:1, type:'E', special:'—'}
    ],
    vectored:true,
    special:'Aegis-1, Payload S-1, Vectored'
  },
  {
    id:'bf5', name:'Fulcrum', role:'Frigate', pts:37, tonnage:'L', groupSize:2,
    thrust:14, scan:10, sig:1, hull:3, es:'5+', ks:'5+', bs:'—',
    weapons:[
      {name:'Barb Spiker', arc:'FN', att:1, lock:'2+', dmg:2, type:'K', special:'Reave-2'}
    ],
    special:'—'
  },
  {
    id:'bf6', name:'Foray', porter:{size:'S',cap:1}, role:'Frigate', pts:25, tonnage:'L', groupSize:2,
    thrust:14, scan:8, sig:1, hull:3, es:'5+', ks:'5+', bs:'—',
    weapons:[
      {name:'Decon Burst', arc:'F/S/R', att:1, lock:'4+', dmg:1, type:'E', special:'—'}
    ],
    special:'Porter S-1'
  },
  {
    id:'bf7', name:'Invasion Cells', payload:{size:'S'}, role:'Cell', pts:15, tonnage:'L', groupSize:2,
    thrust:2, scan:8, sig:1, hull:2, es:'4+', ks:'4+', bs:'6+',
    weapons:[
      {name:'Bombardment', arc:'F/S/R', att:3, lock:'5+', dmg:2, type:'E', special:'Alt-1, Bombardment'}
    ],
    launch:[{name:'Drop Pods', n:1, type:'drop_pod'}],
    vectored:true,
    special:'Payload S-1, Vectored'
  },
  {
    id:'bf8', name:'Lander Cells', payload:{size:'S'}, role:'Cell', pts:15, tonnage:'L', groupSize:2,
    thrust:2, scan:8, sig:1, hull:2, es:'4+', ks:'4+', bs:'6+',
    weapons:[],
    launch:[{name:'Bulk Landers', n:2, type:'bulk_lander'}],
    vectored:true,
    special:'Payload S-1, Vectored'
  }
];

export const FACTIONS = {
  ucm:        { name: 'UCM',        fleet: UCM_FLEET },
  shaltari:   { name: 'Shaltari',   fleet: SHAL_FLEET },
  phr:        { name: 'PHR',        fleet: PHR_FLEET },
  resistance: { name: 'Resistance', fleet: RESISTANCE_FLEET },
  scourge:    { name: 'Scourge',    fleet: SCOURGE_FLEET },
  bioficer:   { name: 'Bioficer',   fleet: BIOFICER_FLEET }
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

// Helper to compose a dropsite descriptor (id, type, inch-x, inch-y).
export const ds = (id, type, x, y) => ({ id, type, x, y });

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
    d6:0, name:'Take and Hold',
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
    d6:0, name:'Erupting Battlefront',
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
    d6:0, name:'Power Grab',
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
    d6:0, name:'Shock and Yaw',
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
    d6:0, name:'Orbital Support',
    scenery:{ micrometeor:'2-5', dense:'4-6', rings:0, largeObjects:0 },
    dropsites:[
      ds('ds1','medium_city', 24, 24),
      ds('ds2','large_city',   6, 12),
      ds('ds3','large_city',  42, 12),
      ds('ds4','large_city',   6, 36),
      ds('ds5','large_city',  42, 36),
      ds('ds6','small_city',  24, 12),
      ds('ds7','small_city',  24, 36)
    ],
    rings:[], largeObjects:[]
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
    desc:'R1 — L tonnage only · R2 — also M · R3+ — any Group.' }
};

export const APPROACHES = {
  standoff:                { d6:1, name:'Standoff',                south:'directly_deploy', north:'directly_deploy' },
  close_enough:            { d6:2, name:'Close Enough',            south:'close',           north:'close' },
  column:                  { d6:3, name:'Column',                  south:'distant',         north:'distant' },
  counterattack:           { d6:4, name:'Counterattack',           south:'directly_deploy', north:'close' },
  delayed_response:        { d6:5, name:'Delayed Response',        south:'close',           north:'distant' },
  home_fleet_disadvantage: { d6:6, name:'Home Fleet Disadvantage', south:'close',           north:'directly_deploy' }
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
    d6:0, name:'Civic Infrastructure',
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
    d6:0, name:'Shock and Yaw',
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
    d6:0, name:'Orbital Support',
    short:'Med/Large Cities +2 Mil Outposts. Small Cities +ODG & Mil Outpost.',
    desc:'Each Medium City and Large City gains two Military Outposts; each Small City gains an Orbital Defence Gun and a Military Outpost.',
    apply:(base)=>{
      const features = {};
      base.forEach(d=>{
        if (d.type === 'medium_city' || d.type === 'large_city') features[d.id] = ['military_outpost','military_outpost'];
        if (d.type === 'small_city') features[d.id] = ['orbital_defence_gun','military_outpost'];
      });
      return { dropsites: base.map(d=>({...d})), features, scenery:{} };
    }
  }
};

/* Secondary Objectives — each player chooses two at fleet build; one scores at end.
   (Implemented subset: those computable from tracked state.) */
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
    bonus:'Double VP for Levelled/Ruined ≥24" from your zone · +2 VP per 500 pts destroyed', scoring:'levelled_ruined' }
};

/* Faction-specific Fighter / Bomber / Fire Ship profiles.
   fighter: {thrust, rerolls}; bomber/fireship: {thrust, att, lock, dmg, type, special}.
   `att` is the attack dice PER asset (combined across the wing at attack time). */
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
