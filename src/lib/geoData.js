// src/lib/geoData.js
// ============================================================
// CENTRALIZED PHILIPPINE GEOGRAPHIC DATASET
// Single source of truth for municipality / province / region
// coordinates and hierarchy. All map & geographic analytics
// must resolve locations through this module.
// ============================================================

// Municipality / city coordinates
// Format: MUNICIPALITY_OR_CITY: [latitude, longitude]
export const AREA_COORDS = {

  // =========================
  // REGION I — ILOCOS REGION
  // =========================

  'SAN FERNANDO': [16.6151, 120.3197],
  VIGAN: [17.5730, 120.3871],
  LAOAG: [18.1978, 120.5943],
  BANGAR: [16.8935, 120.4247],
  BAUANG: [16.5307, 120.3333],
  BURGOS: [16.5192, 120.3718],
  CABA: [16.4319, 120.3456],
  LUNA: [16.8529, 120.3768],
  NAGUILIAN: [16.5344, 120.3967],
  ROSARIO: [16.2288, 120.4887],
  SANTOL: [16.8067, 120.4619],

  // Ilocos Norte
  BACARRA: [18.2529, 120.6088],
  BATAC: [18.0556, 120.5644],
  BURGOS_ILOCOS_NORTE: [18.5167, 120.6500],
  DINGRAS: [18.1000, 120.6967],
  DUMALNEG: [18.5333, 120.8167],
  PASUQUIN: [18.3328, 120.6167],
  PAOAY: [18.0617, 120.5167],
  SARRAT: [18.1569, 120.6472],
  SOLSONA: [18.0981, 120.8167],
  VINTAR: [18.2264, 120.6472],

  // Cagayan
  ABULUG: [18.4490, 121.4540],
  ALCALA: [18.1083, 121.6533],
  ALLACAPAN: [18.1667, 121.5833],
  AMULUNG: [17.8333, 121.7167],
  APARRI: [18.3560, 121.6370],
  BAGGAO: [17.9000, 121.9000],
  BUGUEY: [18.2880, 121.8290],
  CALAYAN: [19.2667, 121.4667],
  CAMALANIUGAN: [18.2742, 121.6767],
  CLAVERIA: [18.6072, 121.0833],
  ENRILE: [17.5597, 121.6978],
  GATTARAN: [18.0556, 121.6467],
  GONZAGA: [18.2592, 121.9933],
  IGUIG: [17.7500, 121.7333],
  LAL_LO: [18.2120, 121.6660],
  LASAM: [18.0667, 121.6000],
  PAMPLONA: [18.4667, 121.3333],
  PENABLANCA: [17.6333, 121.7833],
  PIAT: [17.7903, 121.4786],
  RIZAL: [18.5167, 121.3500],
  SANCHEZ_MIRA: [18.5333, 121.2333],
  SANTA_ANA: [18.4740, 122.1440],
  SANTA_PRAXEDES: [18.5667, 121.0667],
  SANTA_TERESITA: [18.2500, 122.0667],
  SOLANA: [17.6500, 121.6833],
  TUAO: [17.7333, 121.4667],

  // =========================
  // REGION II — CAGAYAN VALLEY
  // =========================

  // Isabela
  ALICIA: [16.7792, 121.6972],
  ANGADANAN: [16.7556, 121.7472],
  AURORA_ISABELA: [16.9917, 121.6333],
  BENITO_SOLIVEN: [16.9833, 122.0000],
  BURGOS_ISABELA: [16.9833, 121.7000],
  CABAGAN: [17.4264, 121.7694],
  CABATUAN: [16.9667, 121.6667],
  CAUAYAN: [16.9333, 121.7667],
  CORDON: [16.6667, 121.4500],
  DINAPIGUE: [16.6167, 122.2167],
  ECHAGUE: [16.7000, 121.6833],
  GAMU: [17.0500, 121.8333],
  ILAGAN: [17.1500, 121.8892],
  JONES: [16.5575, 121.7028],
  LUNA_ISABELA: [16.9667, 121.7333],
  MACONACON: [17.3833, 122.2333],
  MALLIG: [17.2167, 121.6167],
  NAGUILIAN_ISABELA: [17.0167, 121.8333],
  PALANAN: [17.0667, 122.4333],
  QUEZON_ISABELA: [17.3167, 121.6167],
  QUIRINO_ISABELA: [17.1333, 121.9667],
  RAMON: [16.7833, 121.5333],
  REINA_MERCEDES: [16.9833, 121.8333],
  ROXAS_ISABELA: [17.1167, 121.6167],
  SAN_AGUSTIN_ISABELA: [16.5000, 121.7500],
  SAN_MATEO_ISABELA: [16.8833, 121.5833],
  SAN_PABLO_ISABELA: [17.4167, 121.9833],
  SANTIAGO_ISABELA: [16.6881, 121.5456],
  SANTO_TOMAS_ISABELA: [17.3500, 121.7667],
  TUMAUINI: [17.2764, 121.8083],

  // =========================
  // NCR
  // =========================

  MANILA: [14.5995, 120.9842],
  CALOOCAN: [14.6507, 120.9830],
  LAS_PINAS: [14.4378, 120.9956],
  MAKATI: [14.5547, 121.0244],
  MALABON: [14.6625, 120.9567],
  MANDALUYONG: [14.5794, 121.0359],
  MARIKINA: [14.6507, 121.1029],
  MUNTINLUPA: [14.4081, 121.0415],
  NAVOTAS: [14.6667, 120.9417],
  PARANAQUE: [14.4793, 121.0198],
  PASAY: [14.5378, 121.0014],
  PASIG: [14.5764, 121.0851],
  PATEROS: [14.5448, 121.0683],
  QUEZON_CITY: [14.6760, 121.0437],
  SAN_JUAN_NCR: [14.6019, 121.0355],
  TAGUIG: [14.5176, 121.0509],
  VALENZUELA: [14.7000, 120.9833],

  // =========================
  // CALABARZON
  // =========================

  // Laguna
  ALAMINOS_LAGUNA: [14.0631, 121.2464],
  BAY: [14.1833, 121.2833],
  BINAN: [14.3039, 121.0781],
  CABUYAO: [14.3378, 121.1252],
  CALAMBA_CITY: [14.2113, 121.1545],
  CALAUAN: [14.0417, 121.3250],
  CAVINTI: [14.2444, 121.5083],
  FAMY: [14.4375, 121.4464],
  KALAYAAN: [14.3500, 121.5667],
  LILIW: [14.1314, 121.4367],
  LOS_BANOS: [14.1700, 121.2430],
  LUISIANA: [14.1833, 121.5167],
  LUMBAN: [14.3000, 121.4500],
  MABITAC: [14.4333, 121.4167],
  MAGDALENA: [14.2000, 121.4333],
  MAJAYJAY: [14.1467, 121.4722],
  NAGCARLAN: [14.1333, 121.4167],
  PAETE: [14.3667, 121.4833],
  PAGSANJAN: [14.2708, 121.4528],
  PAKIL: [14.3833, 121.4667],
  PANGIL: [14.4000, 121.4667],
  PILA: [14.2333, 121.3667],
  RIZAL_LAGUNA: [14.1167, 121.4167],
  SAN_PABLO_CITY: [14.0583, 121.3256],
  SANTA_CRUZ_LAGUNA: [14.2819, 121.4167],
  SANTA_ROSA_LAGUNA: [14.3101, 121.1437],
  SINILOAN: [14.4167, 121.4500],
  VICTORIA_LAGUNA: [14.2250, 121.3292],

  // Cavite
  ALFONSO: [14.1408, 120.8531],
  AMADEO: [14.1692, 120.9233],
  BACOOR: [14.4594, 120.9589],
  CARMONA: [14.3139, 120.9614],
  CAVITE_CITY: [14.4791, 120.8970],
  DASMARINAS: [14.3294, 120.9367],
  GENERAL_TRIAS: [14.3214, 120.9075],
  IMUS: [14.4297, 120.9367],
  INDANG: [14.1953, 120.8717],
  KAWIT: [14.4456, 120.9058],
  MAGALLANES: [14.1861, 120.7464],
  MARAGONDON: [14.2736, 120.7358],
  MENDEZ: [14.1283, 120.9067],
  NAIC: [14.3181, 120.7661],
  NOVELETA: [14.4292, 120.8797],
  ROSARIO_CAVITE: [14.4153, 120.8572],
  SILANG: [14.2306, 120.9747],
  TAGAYTAY: [14.1153, 120.9622],
  TANZA: [14.3967, 120.8528],
  TERNATE: [14.2900, 120.7220],
  TRECE_MARTIRES: [14.2819, 120.8644],

  // Batangas
  AGONCILLO: [13.9367, 120.9994],
  ALITAGTAG: [13.8647, 121.0033],
  BALAYAN: [13.9372, 120.7322],
  BAUAN: [13.7917, 121.0083],
  CALACA: [13.9569, 120.8106],
  CALATAGAN: [14.0197, 120.6508],
  CUENCA: [13.9028, 121.0528],
  'IBaan': [13.8178, 121.1333],
  LAUREL: [14.0567, 120.9083],
  LEMERY: [13.8808, 120.9133],
  LIPA: [13.9411, 121.1631],
  MABINI: [13.7533, 120.9400],
  MALVAR: [14.0650, 121.1583],
  MATAAS_NA_KAHOY: [14.0900, 121.0917],
  NASUGBU: [14.0667, 120.6333],
  PADRE_GARCIA: [13.8792, 121.2142],
  ROSARIO_BATANGAS: [13.8444, 121.2042],
  SAN_JOSE_BATANGAS: [13.8778, 121.1042],
  SAN_PASCUAL: [13.8106, 121.0208],
  SANTA_TERESITA_BATANGAS: [13.8667, 120.9833],
  TANAUAN: [14.0869, 121.1494],
  TAYSAN: [13.7417, 121.3217],

  // Quezon
  GUMACA: [13.9190, 122.0990],
  LUCENA_CITY: [13.9333, 121.6167],
  MULANAY: [13.5280, 122.4040],
  TAYABAS: [14.0250, 121.5917],
  SARIAYA: [13.9644, 121.5267],
  CANDELARIA: [13.9311, 121.4233],
  LUCENA: [13.9333, 121.6167],

  // =========================
  // BICOL REGION
  // =========================

  LEGAZPI: [13.1390, 123.7430],
  DARAGA: [13.1483, 123.7128],
  TABACO: [13.3589, 123.7336],
  LIGAO: [13.2383, 123.5350],
  GUINOBATAN: [13.1917, 123.5983],
  POLANGUI: [13.2928, 123.4856],
  NAGA: [13.6194, 123.1803],
  IRIGA: [13.4283, 123.4133],
  SORSOGON_CITY: [12.9744, 123.9972],
  MASBATE_CITY: [12.3717, 123.6247],

  // =========================
  // WESTERN VISAYAS
  // =========================

  ILOILO_CITY: [10.7202, 122.5621],
  ROXAS_CITY: [11.5842, 122.7504],
  KALIBO: [11.7061, 122.3672],
  BORACAY: [11.9674, 121.9248],
  PANDAN: [11.7330, 122.0980],
  BUGASONG: [11.0390, 122.0920],
  LIBERTAD: [11.3960, 122.0730],
  HAMTIC: [10.6980, 121.9850],
  SAN_JOSE_ANTIQUE: [10.8620, 121.9290],
  TALISAY_NEGROS_OCCIDENTAL: [10.7320, 122.9720],

  // =========================
  // CENTRAL VISAYAS
  // =========================

  CEBU_CITY: [10.3157, 123.8854],
  MANDAUE: [10.3274, 123.9400],
  LAPU_LAPU: [10.3103, 124.0201],
  TAGBILARAN: [9.6587, 123.8496],
  DUMAGUETE: [9.3109, 123.3084],
  TOLEDO_CEBU: [10.3778, 123.6386],
  CARCAR: [10.1061, 123.6406],
  NAGA_CEBU: [10.2081, 123.7586],

  // =========================
  // EASTERN VISAYAS
  // =========================

  TACLOBAN: [11.2444, 125.0040],
  ORMOC: [11.0092, 124.6105],
  CATBALOGAN: [11.7753, 124.8817],
  BORONGAN: [11.6453, 125.4367],
  MAASIN: [10.1333, 124.8500],
  CALBAYOG: [12.0667, 124.6000],

  // =========================
  // NORTHERN MINDANAO
  // =========================

  CAGAYAN_DE_ORO: [8.4824, 124.6472],
  GINGOOG: [8.8102, 125.1172],
  ALUBIJID: [8.5630, 124.4700],
  GITAGUM: [8.4130, 124.4330],
  LUGAIT: [8.3760, 124.4220],
  ILIGAN: [8.2280, 124.2452],
  OZAMIS: [8.1481, 123.8417],
  TANGUB: [8.0597, 123.7481],

  // =========================
  // DAVAO REGION
  // =========================

  DAVAO_CITY: [7.1907, 125.4553],
  TAGUM: [7.4460, 125.8078],
  PANABO: [7.3080, 125.6844],
  DIGOS: [6.7499, 125.3540],
  MATI: [6.9598, 126.2231],
  SAMAL: [7.0731, 125.7083],

  // =========================
  // SOCCSKSARGEN
  // =========================

  GENERAL_SANTOS: [6.1108, 125.1747],
  KORONADAL: [6.5231, 124.8443],
  TACURONG: [6.6942, 124.6630],
  POLOMOLOK: [6.2217, 125.0639],
  SURALLAH: [6.3750, 124.7450],

  // =========================
  // CARAGA
  // =========================

  BUTUAN: [8.9475, 125.5403],
  SURIGAO_CITY: [9.7823, 125.4953],
  TANDAG: [9.0744, 126.2004],
  BAYUGAN: [8.7231, 125.7506],

  // =========================
  // BARMM
  // =========================

  COTABATO_CITY: [7.2167, 124.2500],
  MARAWI: [7.9996, 124.2897],
  JOLO: [6.0534, 121.0012],
  BONGAO: [5.1134, 119.9781]
};

// Municipality → Province (comprehensive for AREA_COORDS)
export const AREA_PROVINCE = {
  // Region I
  'SAN FERNANDO': 'La Union',
  VIGAN: 'Ilocos Sur',
  LAOAG: 'Ilocos Norte',
  BANGAR: 'La Union',
  BAUANG: 'La Union',
  BURGOS: 'La Union',
  CABA: 'La Union',
  LUNA: 'La Union',
  NAGUILIAN: 'La Union',
  ROSARIO: 'La Union',
  SANTOL: 'La Union',
  BACARRA: 'Ilocos Norte',
  BATAC: 'Ilocos Norte',
  BURGOS_ILOCOS_NORTE: 'Ilocos Norte',
  DINGRAS: 'Ilocos Norte',
  DUMALNEG: 'Ilocos Norte',
  PASUQUIN: 'Ilocos Norte',
  PAOAY: 'Ilocos Norte',
  SARRAT: 'Ilocos Norte',
  SOLSONA: 'Ilocos Norte',
  VINTAR: 'Ilocos Norte',
  // Cagayan
  ABULUG: 'Cagayan',
  ALCALA: 'Cagayan',
  ALLACAPAN: 'Cagayan',
  AMULUNG: 'Cagayan',
  APARRI: 'Cagayan',
  BAGGAO: 'Cagayan',
  BUGUEY: 'Cagayan',
  CALAYAN: 'Cagayan',
  CAMALANIUGAN: 'Cagayan',
  CLAVERIA: 'Cagayan',
  ENRILE: 'Cagayan',
  GATTARAN: 'Cagayan',
  GONZAGA: 'Cagayan',
  IGUIG: 'Cagayan',
  LAL_LO: 'Cagayan',
  LASAM: 'Cagayan',
  PAMPLONA: 'Cagayan',
  PENABLANCA: 'Cagayan',
  PIAT: 'Cagayan',
  RIZAL: 'Cagayan',
  SANCHEZ_MIRA: 'Cagayan',
  SANTA_ANA: 'Cagayan',
  SANTA_PRAXEDES: 'Cagayan',
  SANTA_TERESITA: 'Cagayan',
  SOLANA: 'Cagayan',
  TUAO: 'Cagayan',
  // Region II (Isabela)
  ALICIA: 'Isabela',
  ANGADANAN: 'Isabela',
  AURORA_ISABELA: 'Isabela',
  BENITO_SOLIVEN: 'Isabela',
  BURGOS_ISABELA: 'Isabela',
  CABAGAN: 'Isabela',
  CABATUAN: 'Isabela',
  CAUAYAN: 'Isabela',
  CORDON: 'Isabela',
  DINAPIGUE: 'Isabela',
  ECHAGUE: 'Isabela',
  GAMU: 'Isabela',
  ILAGAN: 'Isabela',
  JONES: 'Isabela',
  LUNA_ISABELA: 'Isabela',
  MACONACON: 'Isabela',
  MALLIG: 'Isabela',
  NAGUILIAN_ISABELA: 'Isabela',
  PALANAN: 'Isabela',
  QUEZON_ISABELA: 'Isabela',
  QUIRINO_ISABELA: 'Isabela',
  RAMON: 'Isabela',
  REINA_MERCEDES: 'Isabela',
  ROXAS_ISABELA: 'Isabela',
  SAN_AGUSTIN_ISABELA: 'Isabela',
  SAN_MATEO_ISABELA: 'Isabela',
  SAN_PABLO_ISABELA: 'Isabela',
  SANTIAGO_ISABELA: 'Isabela',
  SANTO_TOMAS_ISABELA: 'Isabela',
  TUMAUINI: 'Isabela',
  // NCR
  MANILA: 'Metro Manila',
  CALOOCAN: 'Metro Manila',
  LAS_PINAS: 'Metro Manila',
  MAKATI: 'Metro Manila',
  MALABON: 'Metro Manila',
  MANDALUYONG: 'Metro Manila',
  MARIKINA: 'Metro Manila',
  MUNTINLUPA: 'Metro Manila',
  NAVOTAS: 'Metro Manila',
  PARANAQUE: 'Metro Manila',
  PASAY: 'Metro Manila',
  PASIG: 'Metro Manila',
  PATEROS: 'Metro Manila',
  QUEZON_CITY: 'Metro Manila',
  SAN_JUAN_NCR: 'Metro Manila',
  TAGUIG: 'Metro Manila',
  VALENZUELA: 'Metro Manila',
  // Laguna
  ALAMINOS_LAGUNA: 'Laguna',
  BAY: 'Laguna',
  BINAN: 'Laguna',
  CABUYAO: 'Laguna',
  CALAMBA_CITY: 'Laguna',
  CALAUAN: 'Laguna',
  CAVINTI: 'Laguna',
  FAMY: 'Laguna',
  KALAYAAN: 'Laguna',
  LILIW: 'Laguna',
  LOS_BANOS: 'Laguna',
  LUISIANA: 'Laguna',
  LUMBAN: 'Laguna',
  MABITAC: 'Laguna',
  MAGDALENA: 'Laguna',
  MAJAYJAY: 'Laguna',
  NAGCARLAN: 'Laguna',
  PAETE: 'Laguna',
  PAGSANJAN: 'Laguna',
  PAKIL: 'Laguna',
  PANGIL: 'Laguna',
  PILA: 'Laguna',
  RIZAL_LAGUNA: 'Laguna',
  SAN_PABLO_CITY: 'Laguna',
  SANTA_CRUZ_LAGUNA: 'Laguna',
  SANTA_ROSA_LAGUNA: 'Laguna',
  SINILOAN: 'Laguna',
  VICTORIA_LAGUNA: 'Laguna',
  // Cavite
  ALFONSO: 'Cavite',
  AMADEO: 'Cavite',
  BACOOR: 'Cavite',
  CARMONA: 'Cavite',
  CAVITE_CITY: 'Cavite',
  DASMARINAS: 'Cavite',
  GENERAL_TRIAS: 'Cavite',
  IMUS: 'Cavite',
  INDANG: 'Cavite',
  KAWIT: 'Cavite',
  MAGALLANES: 'Cavite',
  MARAGONDON: 'Cavite',
  MENDEZ: 'Cavite',
  NAIC: 'Cavite',
  NOVELETA: 'Cavite',
  ROSARIO_CAVITE: 'Cavite',
  SILANG: 'Cavite',
  TAGAYTAY: 'Cavite',
  TANZA: 'Cavite',
  TERNATE: 'Cavite',
  TRECE_MARTIRES: 'Cavite',
  // Batangas
  AGONCILLO: 'Batangas',
  ALITAGTAG: 'Batangas',
  BALAYAN: 'Batangas',
  BAUAN: 'Batangas',
  CALACA: 'Batangas',
  CALATAGAN: 'Batangas',
  CUENCA: 'Batangas',
  IBaan: 'Batangas',
  LAUREL: 'Batangas',
  LEMERY: 'Batangas',
  LIPA: 'Batangas',
  MABINI: 'Batangas',
  MALVAR: 'Batangas',
  MATAAS_NA_KAHOY: 'Batangas',
  NASUGBU: 'Batangas',
  PADRE_GARCIA: 'Batangas',
  ROSARIO_BATANGAS: 'Batangas',
  SAN_JOSE_BATANGAS: 'Batangas',
  SAN_PASCUAL: 'Batangas',
  SANTA_TERESITA_BATANGAS: 'Batangas',
  TANAUAN: 'Batangas',
  TAYSAN: 'Batangas',
  // Quezon
  GUMACA: 'Quezon',
  LUCENA_CITY: 'Quezon',
  MULANAY: 'Quezon',
  TAYABAS: 'Quezon',
  SARIAYA: 'Quezon',
  CANDELARIA: 'Quezon',
  LUCENA: 'Quezon',
  // Bicol
  LEGAZPI: 'Albay',
  DARAGA: 'Albay',
  TABACO: 'Albay',
  LIGAO: 'Albay',
  GUINOBATAN: 'Albay',
  POLANGUI: 'Albay',
  NAGA: 'Camarines Sur',
  IRIGA: 'Camarines Sur',
  SORSOGON_CITY: 'Sorsogon',
  MASBATE_CITY: 'Masbate',
  // Western Visayas
  ILOILO_CITY: 'Iloilo',
  ROXAS_CITY: 'Capiz',
  KALIBO: 'Aklan',
  BORACAY: 'Aklan',
  PANDAN: 'Antique',
  BUGASONG: 'Antique',
  LIBERTAD: 'Antique',
  HAMTIC: 'Antique',
  SAN_JOSE_ANTIQUE: 'Antique',
  TALISAY_NEGROS_OCCIDENTAL: 'Negros Occidental',
  // Central Visayas
  CEBU_CITY: 'Cebu',
  MANDAUE: 'Cebu',
  LAPU_LAPU: 'Cebu',
  TOLEDO_CEBU: 'Cebu',
  CARCAR: 'Cebu',
  NAGA_CEBU: 'Cebu',
  TAGBILARAN: 'Bohol',
  DUMAGUETE: 'Negros Oriental',
  // Eastern Visayas
  TACLOBAN: 'Leyte',
  ORMOC: 'Leyte',
  CATBALOGAN: 'Samar',
  CALBAYOG: 'Samar',
  BORONGAN: 'Eastern Samar',
  MAASIN: 'Southern Leyte',
  // Northern Mindanao
  CAGAYAN_DE_ORO: 'Misamis Oriental',
  GINGOOG: 'Misamis Oriental',
  ALUBIJID: 'Misamis Oriental',
  GITAGUM: 'Misamis Oriental',
  LUGAIT: 'Misamis Oriental',
  ILIGAN: 'Lanao del Norte',
  OZAMIS: 'Misamis Occidental',
  TANGUB: 'Misamis Occidental',
  // Davao
  DAVAO_CITY: 'Davao del Sur',
  TAGUM: 'Davao del Norte',
  PANABO: 'Davao del Norte',
  SAMAL: 'Davao del Norte',
  DIGOS: 'Davao del Sur',
  MATI: 'Davao Oriental',
  // SOCCSKSARGEN
  GENERAL_SANTOS: 'South Cotabato',
  KORONADAL: 'South Cotabato',
  POLOMOLOK: 'South Cotabato',
  SURALLAH: 'South Cotabato',
  TACURONG: 'Sultan Kudarat',
  // Caraga
  BUTUAN: 'Agusan del Norte',
  BAYUGAN: 'Agusan del Sur',
  SURIGAO_CITY: 'Surigao del Norte',
  TANDAG: 'Surigao del Sur',
  // BARMM
  COTABATO_CITY: 'Maguindanao',
  MARAWI: 'Lanao del Sur',
  JOLO: 'Sulu',
  BONGAO: 'Tawi-Tawi',
};

// Province → Region
export const REGION_OF_PROVINCE = {
  // CAR
  ABRA: 'CAR',
  APAYAO: 'CAR',
  BENGUET: 'CAR',
  IFUGAO: 'CAR',
  KALINGA: 'CAR',
  'MOUNTAIN PROVINCE': 'CAR',
  // Region I
  'ILOCOS NORTE': 'Region I',
  'ILOCOS SUR': 'Region I',
  'LA UNION': 'Region I',
  PANGASINAN: 'Region I',
  // Region II
  BATANES: 'Region II',
  CAGAYAN: 'Region II',
  ISABELA: 'Region II',
  'NUEVA VIZCAYA': 'Region II',
  QUIRINO: 'Region II',
  // NCR
  'METRO MANILA': 'NCR',
  MANILA: 'NCR',
  // Region III
  AURORA: 'Region III',
  BATAAN: 'Region III',
  BULACAN: 'Region III',
  'NUEVA ECIJA': 'Region III',
  PAMPANGA: 'Region III',
  TARLAC: 'Region III',
  ZAMBALES: 'Region III',
  // Region IV-A
  BATANGAS: 'Region IV-A',
  CAVITE: 'Region IV-A',
  LAGUNA: 'Region IV-A',
  QUEZON: 'Region IV-A',
  RIZAL: 'Region IV-A',
  // Region IV-B (MIMAROPA)
  MARINDUQUE: 'MIMAROPA',
  'OCCIDENTAL MINDORO': 'MIMAROPA',
  'ORIENTAL MINDORO': 'MIMAROPA',
  PALAWAN: 'MIMAROPA',
  ROMBLON: 'MIMAROPA',
  // Region V
  ALBAY: 'Region V',
  'CAMARINES NORTE': 'Region V',
  'CAMARINES SUR': 'Region V',
  CATANDUANES: 'Region V',
  MASBATE: 'Region V',
  SORSOGON: 'Region V',
  // Region VI
  AKLAN: 'Region VI',
  ANTIQUE: 'Region VI',
  CAPIZ: 'Region VI',
  GUIMARAS: 'Region VI',
  ILOILO: 'Region VI',
  'NEGROS OCCIDENTAL': 'Region VI',
  // Region VII
  BOHOL: 'Region VII',
  CEBU: 'Region VII',
  'NEGROS ORIENTAL': 'Region VII',
  SIQUIJOR: 'Region VII',
  // Region VIII
  BILIRAN: 'Region VIII',
  'EASTERN SAMAR': 'Region VIII',
  LEYTE: 'Region VIII',
  'NORTHERN SAMAR': 'Region VIII',
  SAMAR: 'Region VIII',
  'SOUTHERN LEYTE': 'Region VIII',
  // Region IX
  'ZAMBOANGA DEL NORTE': 'Region IX',
  'ZAMBOANGA DEL SUR': 'Region IX',
  'ZAMBOANGA SIBUGAY': 'Region IX',
  // Region X
  BUKIDNON: 'Region X',
  CAMIGUIN: 'Region X',
  'LANAO DEL NORTE': 'Region X',
  'MISAMIS OCCIDENTAL': 'Region X',
  'MISAMIS ORIENTAL': 'Region X',
  // Region XI
  'DAVAO DE ORO': 'Region XI',
  'DAVAO DEL NORTE': 'Region XI',
  'DAVAO DEL SUR': 'Region XI',
  'DAVAO OCCIDENTAL': 'Region XI',
  'DAVAO ORIENTAL': 'Region XI',
  // Region XII
  COTABATO: 'Region XII',
  'SOUTH COTABATO': 'Region XII',
  'SULTAN KUDARAT': 'Region XII',
  SARANGANI: 'Region XII',
  // Region XIII (Caraga)
  'AGUSAN DEL NORTE': 'Region XIII',
  'AGUSAN DEL SUR': 'Region XIII',
  'DINAGAT ISLANDS': 'Region XIII',
  'SURIGAO DEL NORTE': 'Region XIII',
  'SURIGAO DEL SUR': 'Region XIII',
  // BARMM
  BASILAN: 'BARMM',
  'LANAO DEL SUR': 'BARMM',
  MAGUINDANAO: 'BARMM',
  SULU: 'BARMM',
  'TAWI-TAWI': 'BARMM',
};

// Approximate region centroids for region-level map markers
export const REGION_COORDS = {
  CAR: [17.3333, 121.0833],
  'Region I': [16.5833, 120.4667],
  'Region II': [17.0833, 121.6667],
  NCR: [14.6042, 120.9822],
  'Region III': [15.3333, 120.7500],
  'Region IV-A': [14.1667, 121.4167],
  MIMAROPA: [12.1667, 121.3333],
  'Region V': [13.5000, 123.4167],
  'Region VI': [11.0000, 122.5000],
  'Region VII': [10.1667, 123.5833],
  'Region VIII': [11.5000, 125.0000],
  'Region IX': [7.8333, 122.7500],
  'Region X': [8.3333, 124.7500],
  'Region XI': [7.1667, 125.7500],
  'Region XII': [6.5000, 124.5833],
  'Region XIII': [9.0000, 125.6667],
  BARMM: [7.0000, 124.0833],
};

// Philippine province coordinates
export const PROVINCE_COORDS = {

  // CAR
  ABRA: [17.5833, 120.7500],
  APAYAO: [17.7500, 121.1667],
  BENGUET: [16.4167, 120.5833],
  IFUGAO: [16.8333, 121.1667],
  KALINGA: [17.3333, 121.3333],
  'MOUNTAIN PROVINCE': [17.0833, 121.1667],

  // Region I
  'ILOCOS NORTE': [18.1667, 120.7500],
  'ILOCOS SUR': [17.3333, 120.5833],
  'LA UNION': [16.6098, 120.3060],
  PANGASINAN: [15.9763, 120.3415],

  // Region II
  BATANES: [20.4167, 121.9667],
  CAGAYAN: [17.8333, 121.5000],
  ISABELA: [16.8333, 121.8333],
  'NUEVA VIZCAYA': [16.5000, 121.2500],
  QUIRINO: [16.2500, 121.5000],

  // Central Luzon
  AURORA: [15.7500, 121.5000],
  BATAAN: [14.6491, 120.4593],
  BULACAN: [14.8500, 121.0000],
  'NUEVA ECIJA': [15.5000, 120.9167],
  PAMPANGA: [15.0500, 120.6667],
  TARLAC: [15.5000, 120.5000],
  ZAMBALES: [15.4167, 120.0000],

  // CALABARZON
  BATANGAS: [13.8333, 121.0000],
  CAVITE: [14.4719, 120.5880],
  LAGUNA: [14.1700, 121.2833],
  QUEZON: [13.9414, 121.6169],
  RIZAL: [14.5833, 121.2500],

  // MIMAROPA
  MARINDUQUE: [13.4000, 121.8333],
  'OCCIDENTAL MINDORO': [13.0000, 120.8333],
  'ORIENTAL MINDORO': [12.8333, 121.5000],
  PALAWAN: [10.0000, 118.8333],
  ROMBLON: [12.5833, 122.2833],

  // Bicol
  'ALBAY': [13.1784, 123.7433],
  'CAMARINES NORTE': [14.1667, 122.8333],
  'CAMARINES SUR': [13.6667, 123.2500],
  CATANDUANES: [13.7500, 124.2500],
  MASBATE: [12.2500, 123.5000],
  SORSOGON: [12.8333, 123.8333],

  // Western Visayas
  AKLAN: [11.6667, 122.3333],
  ANTIQUE: [10.6793, 121.9368],
  CAPIZ: [11.5000, 122.7500],
  GUIMARAS: [10.5000, 122.5833],
  ILOILO: [10.8333, 122.5000],
  'NEGROS OCCIDENTAL': [10.3119, 122.9770],

  // Central Visayas
  BOHOL: [9.8333, 124.1667],
  CEBU: [10.3333, 123.7500],
  'NEGROS ORIENTAL': [9.6667, 122.8333],
  SIQUIJOR: [9.2500, 123.5833],

  // Eastern Visayas
  BILIRAN: [11.5833, 124.5000],
  'EASTERN SAMAR': [11.5000, 125.3333],
  LEYTE: [11.0000, 124.7500],
  'NORTHERN SAMAR': [12.2500, 124.8333],
  SAMAR: [11.8333, 125.0000],
  'SOUTHERN LEYTE': [10.5000, 125.0000],

  // Zamboanga Peninsula
  'ZAMBOANGA DEL NORTE': [8.0000, 122.5000],
  'ZAMBOANGA DEL SUR': [7.8333, 123.3333],
  'ZAMBOANGA SIBUGAY': [7.6667, 122.7500],

  // Northern Mindanao
  BUKIDNON: [8.0000, 125.0000],
  CAMIGUIN: [9.1667, 124.7500],
  'LANAO DEL NORTE': [8.0000, 124.2500],
  'MISAMIS OCCIDENTAL': [8.3333, 123.6667],
  'MISAMIS ORIENTAL': [8.5600, 124.6536],

  // Davao
  'DAVAO DE ORO': [7.5000, 126.0000],
  'DAVAO DEL NORTE': [7.5000, 125.7500],
  'DAVAO DEL SUR': [6.6667, 125.3333],
  'DAVAO OCCIDENTAL': [6.5000, 125.8333],
  'DAVAO ORIENTAL': [7.1667, 126.3333],

  // SOCCSKSARGEN
  'COTABATO': [7.1667, 124.8333],
  'SOUTH COTABATO': [6.3333, 125.0000],
  'SULTAN KUDARAT': [6.6667, 124.5000],
  SARANGANI: [6.1167, 125.1667],

  // Caraga
  'AGUSAN DEL NORTE': [9.0000, 125.5000],
  'AGUSAN DEL SUR': [8.5000, 125.8333],
  'DINAGAT ISLANDS': [9.8333, 125.8333],
  'SURIGAO DEL NORTE': [9.5000, 125.5000],
  'SURIGAO DEL SUR': [8.5000, 126.0000],

  // BARMM
  BASILAN: [6.5000, 122.0000],
  'LANAO DEL SUR': [7.8333, 124.3333],
  MAGUINDANAO: [7.0000, 124.3500],
  SULU: [6.0000, 121.0000],
  'TAWI-TAWI': [5.1667, 119.8333]
};

export const PHILIPPINES_CENTER = [12.8797, 121.7740];
export const PHILIPPINES_BOUNDS = [[4.5, 116.8], [20.9, 127.1]];
export const PHILIPPINES_MIN_ZOOM = 5;
export const PHILIPPINES_MAX_ZOOM = 13;

export const normalizeKey = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const normalizeProvinceName = (s) => normalizeKey(s).replace(/\s+PROVINCE$/, '').replace(/\s+PROVINCIAL$/, '').trim();

// Resolve province → region label using REGION_OF_PROVINCE
export const resolveRegion = (province) => {
  if (!province) return '';
  const normalized = normalizeProvinceName(province);
  const direct = REGION_OF_PROVINCE[province] || REGION_OF_PROVINCE[normalized];
  if (direct) return direct;
  const found = Object.keys(REGION_OF_PROVINCE).find((key) => normalizeProvinceName(key) === normalized);
  return found ? REGION_OF_PROVINCE[found] : '';
};

// Best-effort: region label from a municipality name (via province)
export const resolveRegionForArea = (areaName, provinceName) => {
  if (provinceName) {
    const region = resolveRegion(provinceName);
    if (region) return region;
  }
  const key = findAreaKey(areaName, provinceName);
  if (key && key !== `__PROVINCE__${normalizeProvinceName(provinceName)}`) {
    const province = AREA_PROVINCE[key];
    if (province) return resolveRegion(province);
  }
  if (provinceName) return resolveRegion(provinceName);
  return '';
};

// Resolve municipality key against AREA_COORDS (returns canonical key or '__PROVINCE__X')
export function findAreaKey(name, province) {
  if (!name && !province) return null;
  const norm = normalizeKey(name || '');
  const provinceNorm = normalizeProvinceName(province || '');
  // direct key match
  for (const key of Object.keys(AREA_COORDS)) {
    if (normalizeKey(key) === norm) return key;
  }
  // direct match using province for ambiguous names
  if (provinceNorm) {
    for (const key of Object.keys(AREA_COORDS)) {
      if (normalizeKey(key) === norm && normalizeProvinceName(AREA_PROVINCE[key]) === provinceNorm) return key;
    }
  }
  // try matching by contains / startsWith / endsWith
  for (const key of Object.keys(AREA_COORDS)) {
    const k = normalizeKey(key);
    if (!k) continue;
    if (norm === k) return key;
    if (norm.includes(k) && (!provinceNorm || normalizeProvinceName(AREA_PROVINCE[key]) === provinceNorm)) return key;
    if (k.includes(norm) && (!provinceNorm || normalizeProvinceName(AREA_PROVINCE[key]) === provinceNorm)) return key;
    if ((norm.startsWith(k) || norm.endsWith(k)) && (!provinceNorm || normalizeProvinceName(AREA_PROVINCE[key]) === provinceNorm)) return key;
  }
  // as a last resort, try mapping common trimmed tokens
  const tokens = norm.split(' ');
  for (const key of Object.keys(AREA_COORDS)) {
    const k = normalizeKey(key);
    const keyTokens = k.split(' ');
    if (tokens.some((t) => keyTokens.includes(t)) && (!provinceNorm || normalizeProvinceName(AREA_PROVINCE[key]) === provinceNorm)) return key;
  }
  if (provinceNorm && PROVINCE_COORDS[provinceNorm]) {
    return `__PROVINCE__${provinceNorm}`;
  }
  return null;
}

export const getCoordsForKey = (key) => {
  if (!key) return null;
  if (key.startsWith('__PROVINCE__')) {
    return PROVINCE_COORDS[key.replace('__PROVINCE__', '')];
  }
  return AREA_COORDS[key] || null;
};

// Resolve canonical province name for an area (municipality) string
export const resolveProvince = (areaName, provinceName) => {
  const supplied = String(provinceName || '').trim();
  if (supplied && REGION_OF_PROVINCE[normalizeProvinceName(supplied)] !== undefined) return supplied;
  if (supplied) return supplied;
  const key = findAreaKey(areaName, provinceName);
  if (key && !key.startsWith('__PROVINCE__') && AREA_PROVINCE[key]) return AREA_PROVINCE[key];
  return supplied || 'Unknown';
};
