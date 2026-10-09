// Search ideas per category for the collector (tools/collector.mjs): the bookmark pre-fills the
// category of a search it knows (these, and the game's own keywords in server/items/themes.mjs),
// and `npm run collector` shows them as a checklist. The first lot are well-known things, the second
// lot ones nobody can price (the user asked for both, 2026-10-09). Searches on ebay.de, sold items.

export const IDEAS = {
  tech: [
    'iPhone 13', 'AirPods Pro', 'Nintendo Switch', 'Game Boy Color', 'PlayStation 2', 'Polaroid Kamera', 'Kindle', 'Tamagotchi', 'Röhrenfernseher', 'Walkman',
    'Nokia 3310', 'Commodore Amiga 500', 'Minidisc Player', 'Diaprojektor', 'Super 8 Kamera', 'Wählscheibentelefon', 'Nixie Uhr', 'Röhrenverstärker', 'Atari 2600', 'Overheadprojektor', 'Casio Uhrenrechner', 'Furby',
  ],
  home: [
    'Stressless Sessel', 'Vitra Stuhl', 'Artemide Lampe', 'Fat Lava Vase', 'IKEA Poäng', 'Nierentisch', 'Perserteppich', 'Kuckucksuhr', 'Lavalampe',
    'Sputnik Lampe', 'Panton Chair', 'Ohrensessel', 'Tütenlampe', 'Kristalllüster', 'Schrankwand Eiche', 'Wandteppich Hirsch', 'Messingbett', 'Wasserbett', 'Pendeluhr', 'Raumteiler Rattan', 'Sitzsack',
  ],
  kitchen: [
    'Thermomix TM6', 'KitchenAid', "De'Longhi Magnifica", 'Le Creuset', 'WMF Topfset', 'Bialetti', 'Nespresso', 'Fondue Set', 'SodaStream',
    'Römertopf', 'Zuckerwattemaschine', 'Schokobrunnen', 'Fleischwolf', 'Nudelmaschine', 'Dörrautomat', 'Kupferpfanne', 'Sahnesiphon', 'Popcornmaschine', 'Eismaschine', 'Tupperware Vintage', 'Mörser Granit',
  ],
  fashion: [
    'Barbour Jacke', 'Birkenstock', 'Rolex', 'Swatch', 'Ray-Ban', 'Fjällräven Kånken', "Levi's 501", 'Dr. Martens', 'Longchamp Tasche',
    'Dirndl', 'Lederhose', 'Moon Boots', 'Buffalo Plateau', 'Hawaiihemd', 'Cowboystiefel', 'Kimono', 'Zylinder Hut', 'Taschenuhr', 'Manschettenknöpfe', 'Hermès Seidenschal', 'Holzclogs',
  ],
  toys: [
    'Lego Millennium Falcon', 'Playmobil Piratenschiff', 'Märklin', 'Carrera Bahn', 'Barbie 80er', 'Siku', 'Steiff Teddy', 'Monopoly alt',
    'Polly Pocket', 'Fischertechnik', 'Puppenhaus', 'Schaukelpferd', 'Tipp-Kick', 'Hot Wheels Redline', 'Masters of the Universe', 'Sylvanian Families', 'Bobby Car', 'Lego Technic 8880', 'Teddy Ruxpin', 'Zauberwürfel',
  ],
  collect: [
    'Pokémon Glurak', 'Panini Album', 'Schallplatte Beatles', 'Briefmarken Sammlung', 'Matchbox', 'Asterix Comic', 'Meissen Porzellan', 'Hummel Figur',
    'Diddl Blätter', 'Überraschungsei Figuren', 'Telefonkarten', 'Bierdeckel Sammlung', 'Pez Spender', 'Zinnfiguren', 'Schlümpfe Figuren', 'Kinoplakat', 'Autogrammkarte', 'Glasmurmeln', 'Kronkorken', 'DM Münzen',
  ],
  outdoor: [
    'Brompton', 'Rennrad', 'E-Bike', 'Hollandrad', 'Skateboard', 'Tischtennisplatte', 'Zelt Vaude', 'Kettlebell',
    'Bonanzarad', 'Tandem', 'Einrad', 'Kanu', 'Stand Up Paddle', 'Holzschlitten', 'Rollschuhe Vintage', 'Golfschläger Set', 'Boccia Set', 'Hängematte', 'Trampolin', 'Segway',
  ],
  garden: [
    'Weber Kugelgrill', 'Rasenroboter', 'Gartenzwerg', 'Stihl Kettensäge', 'Kärcher', 'Strandkorb', 'Hollywoodschaukel', 'Vogelhaus',
    'Feuerschale', 'Gartenbrunnen', 'Steinlöwe', 'Vogeltränke', 'Hühnerstall', 'Gewächshaus', 'Spindelmäher', 'Schwengelpumpe', 'Pavillon', 'Holzspalter', 'Rankgitter', 'Teichfigur',
  ],
  odd: [
    'Wackeldackel', 'Schneekugel', 'Diskokugel', 'Röhrenradio', 'Jukebox', 'Ritterrüstung', 'Flipper', 'Telefonzelle',
    'Kaugummiautomat', 'Schaufensterpuppe', 'Parkuhr', 'Friseurstuhl', 'Kirchenbank', 'Kinositze', 'Leuchtreklame', 'Globusbar', 'Karussellpferd', 'Ampel', 'Schreibmaschine', 'Feuerwehrhelm',
  ],
};
