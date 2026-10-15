// Propositions éditoriales #91. Dates vérifiées dans les sources indiquées ; aucune écriture distante.
// Un jalon daté à l'année reste à l'année, même si le public connaît surtout l'objet.
import sourcesAfi from './sources-films-afi.json';
export type AjoutFun = { pack_id: string; titre: string; annee: number; mois: number | null; jour: number | null;
  niveau: number; description: string; source: string; preuve: string; alias: string[] };
export const ajouts: AjoutFun[] = [];
function ajouter(pack_id: string, titre: string, annee: number, niveau: number, description: string, source: string,
  preuve: string, mois: number | null = null, jour: number | null = null, alias: string[] = []) {
  ajouts.push({ pack_id,titre,annee,mois,jour,niveau,description,source,preuve,alias });
}
const objet = (titre: string, annee: number, description: string, source: string, preuve: string,
  mois: number | null = null, jour: number | null = null) => ajouter('COL-0113',titre,annee,2,description,source,preuve,mois,jour);
const mit = (nom: string) => `https://lemelson.mit.edu/resources/${nom}`;
const strong = (nom: string) => `https://www.museumofplay.org/toys/${nom}/`;
objet('Le ressort Slinky devient un jouet',1945,'Richard et Betty James transforment un ressort qui descend les marches en jouet. La démonstration commerciale lance sa popularité.',mit('richard-james'),'Commercialisation en 1945, distincte de l’observation du ressort en 1943.');
objet('Le nettoyant à papier peint devient Play-Doh',1956,'Une pâte de nettoyage trouve une seconde vie dans les mains des enfants. Rainbow Crafts la commercialise comme pâte à modeler.','https://www.museumofplay.org/blog/the-history-of-play-doh-good-clean-fun/','Rainbow Crafts et reconversion commerciale en 1956.');
objet('La pâte rebondissante Silly Putty est lancée',1950,'Cette matière élastique, issue de recherches sur un substitut au caoutchouc, est vendue comme curiosité dans un petit œuf.',strong('silly-putty'),'Lancement commercial et succès en 1950.');
objet('L’Écran magique est commercialisé aux États-Unis',1960,'L’invention d’André Cassagnes devient Etch A Sketch chez Ohio Art. Deux boutons permettent de dessiner sans crayon.',strong('etch-a-sketch'),'Production et vente sous le nom Etch A Sketch en 1960.');
objet('Monsieur Patate arrive dans les magasins américains',1952,'Les premières boîtes contiennent des accessoires à planter dans un vrai légume. Le corps en plastique viendra ensuite.','https://www.vam.ac.uk/articles/the-most-popular-toys-ever-a-guide-through-the-decades/','Lancement américain en 1952 ; ne pas confondre avec les exemplaires des collections.');
objet('Ernő Rubik construit son premier cube',1974,'Le professeur hongrois assemble un casse-tête aux faces mobiles. Son Magic Cube deviendra le Rubik’s Cube.',strong('rubiks-cube'),'Premier cube en 1974, distinct de sa diffusion internationale en 1980.');
objet('Le Super Soaker est mis en vente',1990,'Lonnie Johnson transforme une idée de pistolet à eau en jouet à réservoir sous pression. Sa carrière passe aussi par l’ingénierie spatiale.','https://www.uspto.gov/kids/lonnie-johnson','Mise sur le marché en 1990, distincte de l’idée de 1982.');
objet('La poupée Barbie est lancée',1959,'Ruth Handler propose une poupée représentant une jeune adulte. Mattel ouvre ainsi une nouvelle place au jeu de projection dans la vie future.',strong('barbie'),'Introduction en 1959.');
objet('Dépôt du brevet de la brique LEGO à tubes',1958,'Des tubes sous la brique améliorent l’emboîtement et la tenue des constructions. Le principe devient la base des briques LEGO modernes.','https://www.lego.com/en-us/history/articles/d-the-stud-and-tube-principle','Dépôt danois du 28 janvier 1958, et non fondation de LEGO.',1,28);
objet('Morrison et Franscioni créent un disque volant en plastique',1948,'Les deux partenaires proposent une version en plastique des disques que l’on se lance. Cette étape précède le succès commercial du Frisbee.',strong('frisbee'),'Version plastique créée en 1948 ; les sources divergent sur la cession ultérieure des droits, non retenue.');
objet('Le Hula Hoop en plastique devient une mode',1958,'Wham-O popularise un cerceau léger que l’on fait tourner autour de la taille. Un jeu ancien devient un phénomène commercial.','https://time.com/archive/6801301/toys-hooping-it-up/','Article contemporain du 15 septembre 1958 décrivant la production et la mode de cette année.');
objet('Les Post-it sont lancés dans tous les États-Unis',1980,'Une colle qui adhère sans rester définitivement fixée trouve son usage sur de petites notes. Le lancement national suit plusieurs essais régionaux.','https://www.invent.org/inductees/arthur-l-fry','Lancement national du 6 avril 1980.',4,6);
objet('Dépôt du brevet de cuisson au micro-ondes',1945,'Percy Spencer et Raytheon développent la cuisson par micro-ondes après des expériences liées au radar. Le dépôt précède la vente des fours.',mit('percy-spencer'),'Dépôt du 8 octobre 1945, distinct de la délivrance du brevet.',10,8);
objet('La Super Glue est commercialisée',1958,'Les cyanoacrylates étaient trop collants pour certaines recherches sur les plastiques. Harry Coover en fait finalement un adhésif commercial.',mit('harry-coover'),'Eastman 910 commercialisé en 1958, pas date de découverte.');
objet('George de Mestral brevète le Velcro',1955,'Des fruits de plantes accrochés aux vêtements inspirent une fermeture à crochets et boucles. L’observation de la nature devient un objet quotidien.',mit('george-de-mestral'),'Brevet et mise au point en 1955.');
objet('Roy Plunkett découvre le Téflon',1938,'En étudiant des gaz réfrigérants, Plunkett découvre un polymère inattendu. Ses propriétés ouvriront de nombreux usages industriels.',mit('roy-plunkett'),'Expérience du 6 avril 1938.',4,6);
objet('Bette Graham crée son entreprise de correcteur blanc',1956,'La secrétaire fabrique un liquide pour masquer les fautes de frappe. Mistake Out deviendra Liquid Paper.',mit('bette-graham'),'Création de Mistake Out en 1956, distincte des premiers essais.');
objet('Leo Baekeland met au point la bakélite',1907,'Cette résine entièrement synthétique peut être moulée. Elle se retrouve notamment dans les boîtiers d’appareils et les objets usuels.',mit('leo-baekeland'),'Invention du polymère en 1907.');
objet('Walter Hunt invente l’épingle de sûreté moderne',1849,'Un ressort et un capuchon protègent la pointe d’une simple épingle. Hunt brevète ce petit mécanisme devenu familier.',mit('walter-hunt'),'Invention et brevet en 1849.');
objet('Sundback perfectionne la fermeture à glissière',1913,'Gideon Sundback améliore les systèmes antérieurs de fermeture. Son mécanisme plus fiable prépare le succès du zip.',mit('whitcomb-judson'),'Refonte du mécanisme en 1913, distincte des premiers brevets de Judson.');
objet('Josephine Cochrane brevète son lave-vaisselle',1886,'Cochrane conçoit un appareil qui nettoie la vaisselle par jets d’eau. Son entreprise vise d’abord des clients comme les hôtels.',mit('josephine-cochrane'),'Brevet de 1886.');
objet('Un essai de papier peint donne le papier bulle',1957,'Fielding et Chavannes tentent de créer un revêtement mural en plastique. Leurs poches d’air trouveront finalement un usage dans l’emballage.','https://www.sealedair.com/products/brand/bubble-wrap','Expérience de 1957, distincte de la fondation de Sealed Air en 1960.');

// Le millésime est l'année de sortie originale américaine, jamais l'année racontée par le film.
const afi = 'https://www.afi.com/afis-100-years-100-movies/';
const films: [string,number,string][] = [
  ['Citizen Kane',1941,'Orson Welles raconte l’ascension d’un magnat de la presse.'],
  ['Casablanca',1942,'Un café marocain devient le lieu d’un choix entre amour et engagement.'],
  ['Autant en emporte le vent',1939,'Cette fresque hollywoodienne suit Scarlett O’Hara dans le Sud américain.'],
  ['Le Magicien d’Oz',1939,'Dorothy part sur la route de briques jaunes dans une comédie musicale fantastique.'],
  ['Chantons sous la pluie',1952,'Cette comédie musicale met en scène le passage du cinéma muet au parlant.'],
  ['Psychose',1960,'Alfred Hitchcock transforme un motel isolé en décor de suspense.'],
  ['2001 : L’Odyssée de l’espace',1968,'Stanley Kubrick imagine un voyage spatial où intervient l’ordinateur HAL.'],
  ['Le Parrain',1972,'Francis Ford Coppola suit la famille Corleone et ses luttes de pouvoir.'],
  ['Le Parrain, 2e partie',1974,'La suite croise les destins de Vito et Michael Corleone.'],
  ['Les Dents de la mer',1975,'Le requin de Steven Spielberg bouleverse la saison touristique d’une station balnéaire.'],
  ['Vol au-dessus d’un nid de coucou',1975,'Un nouvel arrivant conteste les règles d’un établissement psychiatrique.'],
  ['Rocky',1976,'Un boxeur de Philadelphie obtient une chance inattendue de combattre le champion.'],
  ['Taxi Driver',1976,'Martin Scorsese suit un chauffeur de taxi dans les rues de New York.'],
  ['Apocalypse Now',1979,'Le film de Coppola transforme une mission au Viêt Nam en voyage dans la guerre.'],
  ['Alien, le huitième passager',1979,'Une créature menace l’équipage d’un vaisseau spatial.'],
  ['Les Aventuriers de l’arche perdue',1981,'Indiana Jones se lance à la recherche de l’Arche d’alliance.'],
  ['E.T., l’extra-terrestre',1982,'Un enfant se lie d’amitié avec un visiteur venu de l’espace.'],
  ['Lawrence d’Arabie',1962,'David Lean consacre une fresque à l’officier britannique T. E. Lawrence.'],
  ['Certains l’aiment chaud',1959,'Deux musiciens se cachent dans un orchestre féminin après avoir vu un crime.'],
  ['Les Temps modernes',1936,'Charlie Chaplin confronte son personnage au travail industriel.'],
  ['Les Lumières de la ville',1931,'Le vagabond de Chaplin rencontre une jeune fleuriste aveugle.'],
  ['La Ruée vers l’or',1925,'Chaplin transpose son comique dans les paysages de la ruée vers l’or.'],
  ['La Mélodie du bonheur',1965,'Une gouvernante et les enfants von Trapp se retrouvent autour de la musique.'],
  ['West Side Story',1961,'Deux bandes rivales s’opposent dans cette adaptation musicale de Roméo et Juliette.'],
  ['Mary Poppins',1964,'Une gouvernante extraordinaire bouleverse le quotidien de la famille Banks.'],
  ['Blanche-Neige et les Sept Nains',1937,'Disney propose son premier long métrage d’animation.'],
  ['Fantasia',1940,'L’animation de Disney rencontre des œuvres de musique classique.'],
  ['Pinocchio',1940,'Une marionnette de bois apprend à devenir un petit garçon.'],
  ['Forrest Gump',1994,'Le personnage de Tom Hanks traverse plusieurs décennies de l’histoire américaine.'],
  ['Pulp Fiction',1994,'Quentin Tarantino croise plusieurs récits criminels à Los Angeles.'],
];
for (const [nom,annee,description] of films) ajouter('COL-0114',`Sortie de ${nom} (États-Unis)`,annee,2,
  description + ' La question porte sur l’année de sa sortie américaine.',sourcesAfi.find(s=>s.titre_fr===`Sortie de ${nom} (États-Unis)`)?.url ?? afi,
  'Fiche AFI consultée le 15/10/2026 ; seule l’année est retenue, sans confondre ouverture locale et nationale.',null,null,[nom]);
const disney = (titre: string, annee: number, description: string, slug: string) => ajouter('COL-0114',`Sortie de ${titre} (États-Unis)`,annee,2,
  description + ' La question porte sur la sortie américaine originale.',`https://movies.disney.com/${slug}`,'Fiche officielle Disney : millésime de sortie originale, précision limitée à l’année.',null,null,[titre]);
disney('La Petite Sirène',1989,'Ariel rêve de quitter son univers sous-marin.','the-little-mermaid');
disney('La Belle et la Bête',1991,'Belle découvre les habitants d’un château ensorcelé.','beauty-and-the-beast');
disney('Aladdin',1992,'Un jeune homme d’Agrabah rencontre un génie dans une lampe.','aladdin');
disney('Le Roi lion',1994,'Simba doit trouver sa place après avoir quitté sa famille.','the-lion-king');
disney('Toy Story',1995,'Woody et Buzz découvrent qu’ils doivent partager leur place auprès d’Andy.','toy-story');
disney('Le Monde de Nemo',2003,'Un poisson-clown traverse l’océan pour retrouver son fils.','finding-nemo');

const film = (nom: string, annee: number, territoire: string, description: string, source: string, preuve: string,
  mois: number | null = null, jour: number | null = null) => ajouter('COL-0114',`Sortie de ${nom} (${territoire})`,annee,2,description,source,preuve,mois,jour,[nom]);
film('Retour vers le futur',1985,'États-Unis','Marty McFly voyage dans le passé à bord d’une DeLorean. La question porte sur la sortie du film, pas sur l’année visitée.','https://catalog.afi.com/Catalog/MovieDetails/55763','Sortie américaine en 1985.');
film('Jurassic Park',1993,'États-Unis','Des dinosaures recréés menacent les visiteurs d’un parc. Spielberg associe aventures et nouveaux effets visuels.','https://watch.afi.com/movie/jurassic-park-1','Sortie américaine du 11 juin 1993.',6,11);
film('Titanic',1997,'États-Unis','James Cameron mêle une romance fictive au naufrage du paquebot. Il faut dater la sortie du film, pas le naufrage.','https://www.paramountpictures.com/movies/titanic','Film de 1997 ; pas de date du naufrage ni de ressortie en 3D.');
film('Matrix',1999,'États-Unis','Neo découvre que son monde familier dissimule une réalité inattendue. Le film associe science-fiction et arts martiaux.','https://www.the-numbers.com/movie/Matrix-The','Sortie nationale américaine du 31 mars 1999.',3,31);
film('La Communauté de l’anneau',2001,'États-Unis','Peter Jackson ouvre sa trilogie du Seigneur des anneaux. Frodon quitte la Comté avec un anneau dangereux.','https://www.theonering.net/torwp/2000/12/19/23038-new-line-press-release-4/','Communiqué original New Line : sortie le 19 décembre 2001, pas la première londonienne.',12,19);
film('Harry Potter à l’école des sorciers',2001,'États-Unis','Harry découvre Poudlard dans la première adaptation cinématographique de la série. La sortie américaine est distincte de celle du livre.','https://www.the-numbers.com/movie/Harry-Potter-and-the-Sorcerers-Stone-%282001%29','Sortie nationale américaine du 16 novembre 2001.',11,16);
film('Le Fabuleux Destin d’Amélie Poulain',2001,'France','Amélie tente d’améliorer la vie de son entourage à Montmartre. Jean-Pierre Jeunet donne à Paris une allure de conte.','https://www.unifrance.org/film/20864/le-fabuleux-destin-d-amelie-poulain','Date de sortie en France : 25 avril 2001 ; la fiche donne aussi une année de production différente.',4,25);
film('Intouchables',2011,'France','Un aristocrate tétraplégique engage un auxiliaire de vie au parcours très différent du sien. Leur relation porte cette comédie dramatique.','https://www.unifrance.org/film/31884/intouchables','Date de sortie en France : 2 novembre 2011 ; distinguer l’année de production.',11,2);
film('Le Voyage de Chihiro',2001,'Japon','Une jeune fille découvre un établissement de bains peuplé d’esprits. Hayao Miyazaki en fait une aventure du passage à l’âge adulte.','https://www.ghibli.jp/works/chihiro/','Sortie japonaise du 20 juillet 2001.',7,20);
film('Mon voisin Totoro',1988,'Japon','Deux sœurs rencontrent les créatures d’une forêt voisine. Totoro devient une figure emblématique du studio Ghibli.','https://www.ghibli.jp/works/totoro/','Sortie japonaise du 16 avril 1988.',4,16);

export const ajouterPop = (titre: string, annee: number, description: string, source: string, preuve: string,
  mois: number | null = null, jour: number | null = null) => ajouter('COL-0115',titre,annee,2,description,source,preuve,mois,jour);
export const ajouterDerape = (titre: string, annee: number, description: string, source: string, preuve: string,
  mois: number | null = null, jour: number | null = null) => ajouter('COL-0117',titre,annee,2,description,source,preuve,mois,jour);

ajouterPop('Pong arrive dans les salles d’arcade',1972,'Atari propose un jeu de tennis à deux raquettes. Sa simplicité contribue au développement du jeu vidéo commercial.','https://mztv.com/timeline/pong-video-game/','Introduction de Pong le 29 novembre 1972.',11,29);
ajouterPop('Alexeï Pajitnov crée Tetris',1984,'Des pièces composées de quatre carrés tombent dans un puits. Le jeu conçu en Union soviétique devient un classique mondial.','https://www.museumofplay.org/games/tetris/','Adaptation informatique et création en 1984.');
ajouterPop('Pac-Man apparaît dans les salles d’arcade',1980,'Le personnage de Namco parcourt un labyrinthe en mangeant des pastilles. Il devient l’une des silhouettes les plus reconnaissables du jeu vidéo.','https://www.moma.org/collection/works/164917','Œuvre Pac-Man de Toru Iwatani, datée 1980.');
ajouterPop('Sortie de Super Mario Bros. au Japon',1985,'Mario traverse le Royaume Champignon dans un jeu de plates-formes. Cette aventure installe durablement la série.','https://www.nintendo.com/jp/character/mario/history/index.html','Historique Nintendo : Super Mario Bros., 1985.');
ajouterPop('La Game Boy est lancée au Japon',1989,'Nintendo rend ses jeux transportables grâce à une console à cartouches. Son écran monochrome devient familier à toute une génération.','https://www.nintendo.co.jp/corporate/history/index.html','Historique Nintendo : commercialisation de la Game Boy en 1989.');
ajouterPop('Pokémon Rouge et Vert sortent au Japon',1996,'Les joueurs collectionnent et échangent des créatures sur Game Boy. Les premières versions japonaises lancent la série.','https://apps.apple.com/us/story/id1548902597','Rétrospective App Store : sortie japonaise du 27 février 1996.',2,27);
ajouterPop('Sonic the Hedgehog arrive sur Mega Drive',1991,'Sega mise sur un hérisson capable de courir à toute vitesse. Sonic devient la mascotte de la marque.','https://www.museumofplay.org/games/sonic-the-hedgehog/','Premier jeu Sonic, 1991.');
ajouterPop('La première PlayStation est lancée au Japon',1994,'Sony entre sur le marché des consoles avec une machine à disques compacts. Les sorties occidentales suivent l’année suivante.','https://www.playstation.com/en-us/playstation-history/1994-ps-one/','Lancement japonais du 3 décembre 1994.',12,3);
ajouterPop('Minecraft passe en version 1.0 sur PC',2011,'Le jeu de construction quitte sa phase de développement initiale. Ce jalon est distinct des premières versions publiques.','https://news.xbox.com/en-us/2024/05/17/minecraft-15-years-most-important-moments/','Version 1.0 du 18 novembre 2011.',11,18);
ajouterPop('Doctor Who débute à la télévision britannique',1963,'Le Docteur entreprend ses voyages dans le temps à bord du TARDIS. La série commence sur la BBC.','https://downloads.bbc.co.uk/historyofthebbc/1960s.pdf','Chronologie BBC : première diffusion du 23 novembre 1963.',11,23);
ajouterPop('Les Simpson deviennent une série à part entière',1989,'La famille de Springfield obtient son propre programme sur Fox. Ce début est distinct des courts sketches antérieurs.','https://en.wikipedia.org/wiki/The_Simpsons_season_1','Premier épisode de la série autonome le 17 décembre 1989.',12,17);
ajouterPop('Friends débute à la télévision américaine',1994,'Six amis new-yorkais partagent appartements, amours et café. Le premier épisode est diffusé sur NBC.','https://en.wikipedia.org/wiki/Friends','Première diffusion américaine du 22 septembre 1994.',9,22);
ajouterPop('MTV commence à émettre aux États-Unis',1981,'La chaîne fait du clip musical le centre de sa programmation. La télévision devient un terrain majeur de la culture pop.','https://www.smithsonianmag.com/innovation/40-mtv-officially-over-hill-180978539/','Début des émissions le 1er août 1981.',8,1);
ajouterPop('Les Beatles publient Sgt. Pepper',1967,'Le groupe explore les possibilités du studio sur un album devenu célèbre. Sa pochette rassemble une foule de personnages.','https://www.thebeatles.com/sgt-peppers-lonely-hearts-club-band-0','Année 1967 certaine ; les dates de mai/juin diffèrent selon les récits et territoires, donc pas de jour retenu.');
ajouterPop('Queen publie Bohemian Rhapsody',1975,'Freddie Mercury associe ballade, opéra et rock dans un même morceau. Le single dépasse les formats habituels de la radio.','https://www.officialcharts.com/songs/queen-bohemian-rhapsody/','Sortie britannique du 31 octobre 1975.',10,31);
ajouterPop('Les concerts Live Aid réunissent les stars du rock',1985,'Des concerts à Londres et Philadelphie sont organisés pour une collecte humanitaire. La prestation de Queen reste l’un des moments marquants.','https://apnews.com/article/ceb42fcd7a65609bde3517272b47cdb6','Concerts simultanés du 13 juillet 1985.',7,13);
ajouterPop('Space Invaders envahit les salles d’arcade',1978,'Des rangées d’extraterrestres avancent vers le joueur. Le jeu de Taito devient un symbole de l’arcade.','https://www.museumofplay.org/games/space-invaders/','Sortie initiale en 1978.');
ajouterPop('The Legend of Zelda sort au Japon',1986,'Link explore un royaume rempli de donjons. Cette première aventure inaugure la série de Nintendo.','https://www.nintendo.com/jp/character/zelda/history/index.html','Historique officiel : premier Zelda en 1986.');

ajouterDerape('Le Vasa coule lors de son premier voyage',1628,'Le navire de prestige suédois sombre dans le port de Stockholm peu après son départ. Son manque de stabilité transforme le voyage inaugural en catastrophe.','https://www.vasamuseet.se/en/explore/vasa-history/disaster','Naufrage du 10 août 1628.',8,10);
ajouterDerape('L’armée australienne est envoyée contre les émeus',1932,'Des soldats tentent de réduire les dégâts agricoles causés par les oiseaux. L’opération, surnommée « guerre des émeus », rencontre de grandes difficultés.','https://www.nationalgeographic.com/history/article/australian-emu-war-history','Opération de 1932 ; pas de guerre officiellement déclarée.');
ajouterDerape('La Grande Puanteur envahit Londres',1858,'La chaleur accentue l’odeur des eaux usées dans la Tamise. Cet épisode pousse les autorités à agir sur les égouts.','https://www.londonmuseum.org.uk/collections/london-stories/great-stink-of-1858/','Été 1858, pas de jour unique.');
ajouterDerape('Mars Climate Orbiter est perdue près de Mars',1999,'Une erreur de conversion entre systèmes d’unités fausse la navigation de la sonde. Le dernier contact a lieu à son arrivée près de Mars.','https://www.jpl.nasa.gov/missions/mars-climate-orbiter/','Dernier contact le 23 septembre 1999.',9,23);
ajouterDerape('La BBC diffuse une récolte de spaghettis sur des arbres',1957,'Panorama présente de faux arbres à pâtes dans un reportage. Il s’agit d’un poisson d’avril, pas d’une découverte agricole.','https://feeds.bbci.co.uk/news/articles/cn8rxm0nrz9o','Canular du 1er avril 1957.',4,1);
ajouterDerape('L’homme de Piltdown est présenté comme une découverte',1912,'Des fragments sont présentés comme un ancêtre humain. Des décennies plus tard, l’assemblage est démontré frauduleux.','https://www.nhm.ac.uk/our-science/services/library/collections/piltdown-man.html','Annonce en 1912 ; démystification en 1953.');
ajouterDerape('Un journal annonce de faux habitants de la Lune',1835,'Le New York Sun publie des récits prétendant décrire la vie lunaire. Le Great Moon Hoax est une invention journalistique.','https://www.loc.gov/collections/finding-our-place-in-the-cosmos-with-carl-sagan/articles-and-essays/life-on-other-worlds/peoples-and-creatures-of-the-moon/','Série d’articles de 1835.');
ajouterDerape('Un cochon tué déclenche une crise anglo-américaine',1859,'Sur l’île de San Juan, un différend agricole aggrave un conflit de frontière. Des troupes se font face, sans bataille entre les deux pays.','https://home.nps.gov/sajh/learn/historyculture/the-pig-war.htm','Incident initial du 15 juin 1859.',6,15);
ajouterDerape('Les premières photos des fées de Cottingley sont réalisées',1917,'Deux jeunes cousines fabriquent des images montrant des fées en papier. Ces photographies tromperont une partie du public.','https://blog.scienceandmediamuseum.org.uk/the-story-of-the-cottingley-fairies-shows-that-image-manipulation-is-nothing-new/','Premières images en 1917, distinctes de leur publication plus tardive.');
ajouterDerape('Le faux géant de Cardiff est découvert',1869,'Une statue enterrée est présentée comme un homme pétrifié. Le faux attire les visiteurs avant d’être démasqué.','https://www.farmersmuseum.org/annualreport/2019/highlights/','Le musée commémore en 2019 les 150 ans du canular de 1869.');
ajouterDerape('Carrington observe une éruption solaire exceptionnelle',1859,'L’observation précède une tempête géomagnétique qui perturbe les télégraphes. Le Soleil rappelle sa capacité à affecter les technologies terrestres.','https://www.nasa.gov/history/spots-waves-and-wind-a-solar-science-timeline-full-text/','Observation de l’éruption le 1er septembre 1859 ; distinguer le pic géomagnétique.',9,1);
ajouterDerape('L’Europe connaît une « année sans été »',1816,'Après l’éruption du Tambora l’année précédente, le refroidissement bouleverse les saisons. Les mauvaises récoltes entraînent de graves difficultés.','https://research-information.bris.ac.uk/en/publications/climate-and-carbon-cycle-response-to-the-1815-tambora-volcanic-er/','Année climatique 1816 ; l’éruption est de 1815.');
ajouterDerape('Orson Welles diffuse La Guerre des mondes à la radio',1938,'Une fiction prend la forme de bulletins d’information annonçant une invasion martienne. Des auditeurs s’inquiètent, mais l’ampleur de la panique a été exagérée.','https://www.archives.gov/publications/prologue/2003/fall/war-of-worlds.html','Diffusion CBS du 30 octobre 1938.',10,30);
ajouterDerape('Le marché spéculatif des tulipes s’effondre',1637,'Aux Provinces-Unies, les prix de certains bulbes chutent brutalement. La crise ne doit pas être confondue avec un effondrement de toute l’économie néerlandaise.','https://www.rijksmuseum.nl/en/collection/object/Floral-Still-Life--c3c05d8cfd0da3b92a72445596e8a914','Effondrement du commerce des bulbes en 1637.');
ajouterDerape('La Grande-Bretagne retire onze dates de son calendrier',1752,'Le passage au calendrier grégorien change la numérotation des jours. Personne ne perd réellement onze jours de vie.','https://www.rmg.co.uk/collections/objects/rmgc-object-367588','Réforme de 1752 : onze dates supprimées, pas onze jours physiques.');
ajouterDerape('Le marathon olympique de Saint-Louis vire à l’épreuve chaotique',1904,'La chaleur, la poussière et les incidents rendent la course particulièrement difficile. Fred Lorz, qui a effectué une partie du trajet en voiture, est disqualifié.','https://en.wikipedia.org/wiki/Athletics_at_the_1904_Summer_Olympics_%E2%80%93_Men%27s_marathon','Marathon du 30 août 1904.',8,30);
ajouterDerape('La célèbre photo du « monstre » du Loch Ness est publiée',1934,'Une silhouette dans l’eau devient une image emblématique du mystère. La photographie dite « du chirurgien » se révélera un montage.','https://blog.nms.ac.uk/2022/04/01/the-monster-files-letters-about-alleged-monsters/','Photographie de 1934 ; existence du monstre non établie.');
ajouterDerape('Les faux journaux d’Hitler sont démasqués',1983,'Après leur annonce par Stern, des expertises révèlent que les cahiers sont des faux. L’affaire devient un scandale majeur de la presse.','https://www.bundesarchiv.de/themen-entdecken/online-entdecken/geschichtsgalerien/pressekonferenz-des-bundesarchivs-zu-hitler-tagebuechern/','Annonce de la falsification en mai 1983.');
