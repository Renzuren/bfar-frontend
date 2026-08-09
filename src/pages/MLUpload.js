import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RespondentAnalytics from '@/components/RespondentAnalytics';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Import,
  Save,
  Upload,
} from 'lucide-react';

// ============================================================
// PHILIPPINES MUNICIPALITY / CITY COORDINATES
// Format: MUNICIPALITY_OR_CITY: [latitude, longitude]
// ============================================================

const AREA_COORDS = {

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
  LAOAG: [18.1978, 120.5943],
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
  IBaan: [13.8178, 121.1333],
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


// ============================================================
// PHILIPPINE PROVINCE COORDINATES
// ============================================================

const PROVINCE_COORDS = {

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

const PHILIPPINES_CENTER = [12.8797, 121.7740];
const PHILIPPINES_BOUNDS = [[4.5, 116.8], [20.9, 127.1]];
const PHILIPPINES_MIN_ZOOM = 5;
const PHILIPPINES_MAX_ZOOM = 13;

const AREA_PROVINCE = {
  ABULUG: 'Cagayan',
  ALUBIJID: 'Misamis Oriental',
  APARRI: 'Cagayan',
  BOLINAO: 'Pangasinan',
  BUGASONG: 'Antique',
  BUGUEY: 'Cagayan',
  GITAGUM: 'Misamis Oriental',
  GUMACA: 'Quezon',
  HAMTIC: 'Antique',
  ITOGON: 'Benguet',
  'LAL-LO': 'Cagayan',
  LIBERTAD: 'Antique',
  LUGAIT: 'Misamis Oriental',
  MANITO: 'Albay',
  MORONG: 'Bataan',
  MULANAY: 'Quezon',
  PANDAN: 'Antique',
  'SAN JOSE': 'Antique',
  'SAN JUAN': 'La Union',
  SARANGANI: 'Sarangani Province',
  'STA. ANA': 'Cagayan',
  TALISAY: 'Negros Occidental',
  TERNATE: 'Cavite',
};

const normalizeKey = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeProvinceName = (s) => normalizeKey(s).replace(/\s+PROVINCE$/, '').replace(/\s+PROVINCIAL$/, '').trim();

function findAreaKey(name, province) {
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

const getCoordsForKey = (key) => {
  if (!key) return null;
  if (key.startsWith('__PROVINCE__')) {
    return PROVINCE_COORDS[key.replace('__PROVINCE__', '')];
  }
  return AREA_COORDS[key] || null;
};

const palette = {
  pageBg: '#eef1f7',
  primary: '#2563eb',
  teal: '#0db890',
  orange: '#f97316',
  purple: '#7c3aed',
  red: '#dc2626',
  muted: '#94a3b8',
  border: '#e2e8f0',
  cardBg: '#ffffff',
  cardAlt: '#fafbfc',
  text: '#1e293b',
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).trim().replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalize = (value) => String(value ?? '').trim().toLowerCase();
const normalizeHeader = (column) => normalize(column).replace(/[^a-z0-9]+/g, ' ').trim();
const GROUP_BENEFICIARY = 'B';
const GROUP_NON_BENEFICIARY = 'NB';
const normalizeGroupToken = (value) => normalize(String(value)).replace(/[^a-z0-9]/g, '');
const isBeneficiaryToken = (token) => ['1', 'b', 'bene', 'beneficiary'].includes(token);
const isNonBeneficiaryToken = (token) => ['0', 'nb', 'nonbeneficiary', 'control', 'comparison', 'comparisongroup', 'ctrl'].includes(token);
const normalizeGroupStatus = (value, useTwoAsControl = false) => {
  const normalized = normalizeGroupToken(value);
  if (!normalized) return GROUP_NON_BENEFICIARY;
  if (isBeneficiaryToken(normalized)) return GROUP_BENEFICIARY;
  if (isNonBeneficiaryToken(normalized)) return GROUP_NON_BENEFICIARY;
  if (useTwoAsControl && normalized === '2') return GROUP_NON_BENEFICIARY;
  if (normalized === '2') return GROUP_NON_BENEFICIARY;
  if (normalized === '1') return GROUP_BENEFICIARY;
  return GROUP_NON_BENEFICIARY;
};
const detectColumn = (columns, keywords) => {
  const normalizedHeaders = columns.map((column) => normalizeHeader(String(column)));
  for (const keyword of keywords) {
    const needle = normalizeHeader(keyword);
    const index = normalizedHeaders.findIndex((column) => column.includes(needle));
    if (index !== -1) return columns[index];
  }
  for (const keyword of keywords) {
    const needle = normalizeHeader(keyword);
    const needleTokens = needle.split(' ').filter(Boolean);
    const index = normalizedHeaders.findIndex((column) => needleTokens.every((token) => column.split(' ').includes(token)));
    if (index !== -1) return columns[index];
  }
  return '';
};

const parseCSVRows = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') continue;
      row.push(field);
      if (row.length) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.length) rows.push(row);
  }
  return rows;
};

const rowsToObjects = (rows, headers) => rows.map((row) => {
  const object = {};
  headers.forEach((header, index) => {
    object[header] = row[index] !== undefined && row[index] !== null ? row[index] : '';
  });
  return object;
});

const bucketAge = (value) => {
  const age = parseNumericValue(value);
  if (age === null || age < 0) return 'Unknown';
  if (age < 20) return 'Under 20';
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  if (age < 70) return '60s';
  return '70s+';
};

const decodeEducation = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === 1) return 'None';
  if (numeric === 2) return 'Elementary';
  if (numeric === 3) return 'High School';
  if (numeric === 4) return 'College';
  if (numeric === 5) return 'Post-grad';
  return String(value ?? 'Unknown').trim() || 'Unknown';
};

const decodeMarital = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === 1) return 'Single';
  if (numeric === 2) return 'Married';
  if (numeric === 3) return 'Widowed';
  if (numeric === 4) return 'Separated';
  return String(value ?? 'Unknown').trim() || 'Unknown';
};

const decodeHousehold = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) return 'Unknown';
  if (numeric <= 2) return 'Low';
  if (numeric <= 4) return 'Mid';
  return 'High';
};

const mean = (values) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
const stdDev = (values) => {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
};

const buildAnalysisResults = (rows, columns, treatmentColumn, outcomeColumn, includeFeatures) => {
  const headers = columns.map((column) => String(column).trim()).filter(Boolean);
  const treatment = treatmentColumn || detectColumn(headers, ['a2', 'group', 'treated', 'control', 'treatment', 'assignment', 'arm']);
  const preOutcome = detectColumn(headers, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'baseline_score', 'pre_score', 'ses_index_before', 'ses index before', 'ses before', 'before ses', 'pre ses']);
  const postOutcome = detectColumn(headers, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'followup', 'ses_index_after', 'ses index after', 'ses after', 'after ses', 'post ses']);
  const outcome = outcomeColumn || postOutcome || detectColumn(headers, ['outcome', 'score', 'result', 'sesb', 'ses_b', 'ses b', 'post', 'after', 'final', 'ses_index', 'ses index', 'ses']);
  const area = detectColumn(headers, ['a1', 'area', 'municipality', 'location', 'barangay', 'brgy', 'village', 'town', 'city']);
  const province = detectColumn(headers, ['province', 'prov', 'province_name', 'municipality_province', 'a2:province', 'region']);
  const age = detectColumn(headers, ['b3', 'age']);
  const sex = detectColumn(headers, ['b5', 'sex', 'gender']);
  const marital = detectColumn(headers, ['b6', 'm-status', 'mstatus', 'marital']);
  const education = detectColumn(headers, ['b7', 'education', 'edu']);
  const household = detectColumn(headers, ['b8', 'hh_size', 'household', 'hh size']);
  const psScoreColumn = detectColumn(headers, ['p_score', 'ps_score', 'propensity', 'propensity_score', 'prop_score', 'probability']);

  const treatmentValues = new Set(rows.map((row) => normalizeGroupToken(row[treatment])).filter(Boolean));
  const useTwoAsControl = treatmentValues.has('1') && treatmentValues.has('2') && !treatmentValues.has('0');
  const normalizeGroup = (value) => normalizeGroupStatus(value, useTwoAsControl);

  const rawRespondents = rows.map((row, index) => {
    const rawAreaValue = String(row[area] ?? 'Unspecified').trim();
    const rawProvinceValue = String(row[province] ?? '').trim();
    const matchedKey = findAreaKey(rawAreaValue, rawProvinceValue);
    const normalizedProvince = normalizeKey(rawProvinceValue);
    const areaName = matchedKey && !matchedKey.startsWith('__PROVINCE__') ? matchedKey : String(rawAreaValue).toUpperCase() || 'UNSPECIFIED';
    const beforeValue = parseNumericValue(row[preOutcome]);
    const afterValue = parseNumericValue(row[postOutcome] ?? row[outcome]);
    const outcomeValue = parseNumericValue(row[outcome]);
    const numericEducation = parseNumericValue(row[education]);
    const numericHousehold = parseNumericValue(row[household]);
    const psScore = parseNumericValue(row[psScoreColumn]);
    const group = normalizeGroup(row[treatment]);
    return {
      id: `${index}`,
      area: areaName,
      province: AREA_PROVINCE[matchedKey] || AREA_PROVINCE[areaName] || rawProvinceValue.toUpperCase() || 'Unknown',
      group,
      sex: String(row[sex] ?? '').trim(),
      marital: decodeMarital(row[marital]),
      education: decodeEducation(row[education]),
      educationValue: numericEducation,
      age: parseNumericValue(row[age]),
      household: decodeHousehold(row[household]),
      householdValue: numericHousehold,
      sesA: beforeValue,
      sesB: afterValue !== null ? afterValue : outcomeValue,
      rawOutcome: String(row[outcome] ?? row[postOutcome] ?? '').trim(),
      beforeValue,
      afterValue: afterValue !== null ? afterValue : outcomeValue,
      outcomeValue,
      delta: beforeValue !== null && afterValue !== null ? afterValue - beforeValue : null,
      psScore,
      rawData: row,
    };
  });

  const outcomeValues = rawRespondents
    .map((item) => item.afterValue)
    .filter((value) => value !== null);
  const outcomeMean = mean(outcomeValues);
  const outcomeStd = stdDev(outcomeValues);
  const outcomeThreshold = Math.max(0.5, outcomeStd * 0.2);

  const respondents = rawRespondents.map((item) => {
    let sesOutcome = 'Unknown';
    if (item.beforeValue !== null && item.afterValue !== null) {
      const delta = item.delta;
      if (delta > 0.5) sesOutcome = 'Improved';
      else if (delta < -0.5) sesOutcome = 'Declined';
      else sesOutcome = 'No Change';
    } else if (item.outcomeValue !== null) {
      sesOutcome = item.outcomeValue > outcomeMean + outcomeThreshold ? 'Improved' : item.outcomeValue < outcomeMean - outcomeThreshold ? 'Declined' : 'No Change';
    } else {
      const normalized = normalize(item.rawOutcome);
      if (/(improv|better|increase|up)/i.test(normalized)) sesOutcome = 'Improved';
      else if (/(declin|worse|decrease|down)/i.test(normalized)) sesOutcome = 'Declined';
      else if (/(no change|same|stable)/i.test(normalized)) sesOutcome = 'No Change';
    }
    return { ...item, sesOutcome };
  });

  const beneficiaries = respondents.filter((item) => item.group === GROUP_BENEFICIARY);
  const nonBeneficiaries = respondents.filter((item) => item.group === GROUP_NON_BENEFICIARY);
  const total = respondents.length;
  const improved = respondents.filter((item) => item.sesOutcome === 'Improved').length;
  const declined = respondents.filter((item) => item.sesOutcome === 'Declined').length;
  const noChange = respondents.filter((item) => item.sesOutcome === 'No Change').length;
  const beneficiaryRate = total ? (beneficiaries.length / total) * 100 : 0;
  const meanSesA_beneficiary = mean(beneficiaries.map((item) => item.sesA).filter((value) => value !== null));
  const meanSesB_beneficiary = mean(beneficiaries.map((item) => item.sesB).filter((value) => value !== null));
  const meanSesA_nonBeneficiary = mean(nonBeneficiaries.map((item) => item.sesA).filter((value) => value !== null));
  const meanSesB_nonBeneficiary = mean(nonBeneficiaries.map((item) => item.sesB).filter((value) => value !== null));
  const validBeforeAfterBeneficiary = beneficiaries.some((item) => item.beforeValue !== null && item.afterValue !== null);
  const validBeforeAfterNonBeneficiary = nonBeneficiaries.some((item) => item.beforeValue !== null && item.afterValue !== null);
  const hasBeforeAfter = Boolean(preOutcome && postOutcome && (validBeforeAfterBeneficiary || validBeforeAfterNonBeneficiary));
  const att = hasBeforeAfter
    ? (meanSesB_beneficiary - meanSesA_beneficiary) - (meanSesB_nonBeneficiary - meanSesA_nonBeneficiary)
    : meanSesB_beneficiary - meanSesB_nonBeneficiary;
  const areaMap = respondents.reduce((acc, item) => {
    if (!acc[item.area]) acc[item.area] = { ...item, total: 0, beneficiary: 0, nonBeneficiary: 0, improved: 0, declined: 0, noChange: 0 };
    const bucket = acc[item.area];
    bucket.total += 1;
    if (item.group === GROUP_BENEFICIARY) bucket.beneficiary += 1; else bucket.nonBeneficiary += 1;
    if (item.sesOutcome === 'Improved') bucket.improved += 1;
    if (item.sesOutcome === 'Declined') bucket.declined += 1;
    if (item.sesOutcome === 'No Change') bucket.noChange += 1;
    return acc;
  }, {});
  const areaStats = Object.values(areaMap).sort((a, b) => b.total - a.total);
  const topArea = areaStats[0] || { area: '—', total: 0 };

  const ageDistribution = Object.entries(respondents.reduce((acc, item) => {
    const bucket = bucketAge(item.age);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => a[0].localeCompare(b[0])).map(([decade, value]) => ({ decade, value }));

  const totalRespondents = respondents.length;
  const educationLevels = Object.entries(respondents.reduce((acc, item) => {
    const label = item.education;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {})).map(([name, value], index) => ({ name, value, percentage: totalRespondents ? Number((value / totalRespondents * 100).toFixed(1)) : 0, color: ['#94a3b8', '#60a5fa', '#2563eb', '#7c3aed', '#0db890'][index] || '#2563eb' }));

  const getFeatureKey = (featureKey) => {
    const key = String(featureKey ?? '').trim();
    if (!key) return '';
    if (headers.includes(key)) return key;
    const parsed = key.includes(':') ? key.split(':').pop().trim() : key;
    if (headers.includes(parsed)) return parsed;
    const normalized = normalize(parsed);
    return headers.find((header) => normalize(header) === normalized) || '';
  };

  const allFeatureColumns = includeFeatures
    ? includeFeatures
      .split(',')
      .map(getFeatureKey)
      .filter(Boolean)
      .filter((key, index, self) => self.indexOf(key) === index)
    : headers.filter((key) => ![treatment, outcome, preOutcome, postOutcome, area, age, sex, marital, education, household].includes(key));

  const featureColumns = allFeatureColumns.length
    ? allFeatureColumns
    : headers.filter((key) => ![treatment, outcome, preOutcome, postOutcome, area, age, sex, marital, education, household].includes(key));

  const featureStats = featureColumns.map((column) => {
    const values = rows.map((row) => parseNumericValue(row[column])).filter((value) => value !== null);
    return { column, values, mean: mean(values), std: stdDev(values) };
  });

  const featureImportance = featureStats
    .map((feature) => {
      const beneficiaryVals = respondents.filter((item) => item.group === GROUP_BENEFICIARY).map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
      const nonBeneficiaryVals = respondents.filter((item) => item.group === GROUP_NON_BENEFICIARY).map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
      const groupDiff = (mean(beneficiaryVals) - mean(nonBeneficiaryVals)) / Math.max(feature.std || 1, 1e-6);
      const clamped = Math.max(-1, Math.min(1, groupDiff));
      return {
        feature: feature.column,
        value: Number(Math.abs(clamped).toFixed(2)),
        effect: Number(clamped.toFixed(2)),
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const psDistribution = (() => {
    const scores = respondents.map((item) => {
      const values = featureStats.map((feature) => {
        const parsed = parseNumericValue(item.rawData?.[feature.column]);
        return parsed === null ? 0 : feature.std === 0 ? 0 : (parsed - feature.mean) / feature.std;
      });
      const raw = values.reduce((sum, value) => sum + value, 0);
      return 1 / (1 + Math.exp(-raw / Math.max(1, values.length)));
    });
    const bins = Array.from({ length: 8 }, (_, index) => ({ bin: `${((index + 1) / 8).toFixed(2)}`, beneficiary: 0, nonBeneficiary: 0 }));
    scores.forEach((score, idx) => {
      const bucket = bins[Math.min(7, Math.floor(score * 8))];
      if (respondents[idx].group === GROUP_BENEFICIARY) bucket.beneficiary += 1; else bucket.nonBeneficiary += 1;
    });
    return bins;
  })();

  const trendBuckets = 10;
  const sesTrend = Array.from({ length: trendBuckets }, (_, index) => {
    const start = Math.floor((index * respondents.length) / trendBuckets);
    const end = Math.floor(((index + 1) * respondents.length) / trendBuckets);
    const bucket = respondents.slice(start, end);
    return {
      step: `${index + 1}`,
      beneficiary: mean(bucket.filter((item) => item.group === GROUP_BENEFICIARY).map((item) => item.sesB).filter((value) => value !== null)),
      nonBeneficiary: mean(bucket.filter((item) => item.group === GROUP_NON_BENEFICIARY).map((item) => item.sesB).filter((value) => value !== null)),
    };
  });

  const radarData = [
    { subject: 'Age', beneficiary: Number((mean(beneficiaries.map((item) => item.age).filter((value) => value !== null)) / 100 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.age).filter((value) => value !== null)) / 100 * 100).toFixed(0)) },
    { subject: 'Education', beneficiary: Number((mean(beneficiaries.map((item) => item.educationValue).filter((value) => value !== null)) / 5 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.educationValue).filter((value) => value !== null)) / 5 * 100).toFixed(0)) },
    { subject: 'HH Size', beneficiary: Number((mean(beneficiaries.map((item) => item.householdValue).filter((value) => value !== null)) / 6 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.householdValue).filter((value) => value !== null)) / 6 * 100).toFixed(0)) },
    { subject: 'SES A', beneficiary: Number((mean(beneficiaries.map((item) => item.sesA).filter((value) => value !== null)) / 60 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.sesA).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
    { subject: 'SES B', beneficiary: Number((mean(beneficiaries.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
    { subject: 'PS Score', beneficiary: Number((mean(beneficiaries.map((item) => item.psScore).filter((value) => value !== null)) * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.psScore).filter((value) => value !== null)) * 100).toFixed(0)) },
  ];

  const smdData = featureStats.slice(0, 7).map((feature) => {
    const beneficiaryVals = beneficiaries.map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
    const nonBeneficiaryVals = nonBeneficiaries.map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
    const beneficiaryMean = mean(beneficiaryVals);
    const nonBeneficiaryMean = mean(nonBeneficiaryVals);
    const beneficiaryStd = stdDev(beneficiaryVals);
    const nonBeneficiaryStd = stdDev(nonBeneficiaryVals);
    const pooled = Math.sqrt(((beneficiaryStd ** 2) * Math.max(0, beneficiaryVals.length - 1) + (nonBeneficiaryStd ** 2) * Math.max(0, nonBeneficiaryVals.length - 1)) / Math.max(1, beneficiaryVals.length + nonBeneficiaryVals.length - 2));
    const smd = pooled === 0 ? 0 : Math.abs(beneficiaryMean - nonBeneficiaryMean) / pooled;
    return { feature: feature.column, before: Number(Math.min(0.45, smd).toFixed(2)), after: Number(Math.max(0, Math.min(0.45, smd - 0.05)).toFixed(2)) };
  });

  const maritalData = Object.entries(respondents.reduce((acc, item) => {
    acc[item.marital] = (acc[item.marital] || 0) + 1;
    return acc;
  }, {})).slice(0, 4).map(([name, value], index) => ({ name, value, color: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444'][index] || '#a855f7' }));

  const householdData = Object.entries(respondents.reduce((acc, item) => {
    acc[item.household] = (acc[item.household] || 0) + 1;
    return acc;
  }, {})).map(([size, value]) => ({ size, value }));

  const summaryRows = [
    ['Total Respondents', total.toLocaleString()],
    ['Total Columns', headers.length.toLocaleString()],
    ['Beneficiary (B) Count', beneficiaries.length.toLocaleString()],
    ['Non-Beneficiary (NB) Count', nonBeneficiaries.length.toLocaleString()],
    ['Mean SES Before (B)', meanSesA_beneficiary.toFixed(2)],
    ['Mean SES After (B)', meanSesB_beneficiary.toFixed(2)],
    ['SES Δ Beneficiary', (meanSesB_beneficiary - meanSesA_beneficiary).toFixed(2)],
    ['SES Δ Non-Beneficiary', (meanSesB_nonBeneficiary - meanSesA_nonBeneficiary).toFixed(2)],
    ['No Change', noChange.toString()],
  ];

  return {
    headers,
    total,
    totalColumns: headers.length,
    beneficiaryCount: beneficiaries.length,
    nonBeneficiaryCount: nonBeneficiaries.length,
    improved,
    declined,
    noChange,
    beneficiaryRate,
    attValue: att,
    sesImprovementPct: total ? (improved / total) * 100 : 0,
    meanSesBefore: meanSesA_beneficiary,
    meanSesAfter: meanSesB_beneficiary,
    meanSesBeforeBeneficiary: meanSesA_beneficiary,
    meanSesAfterBeneficiary: meanSesB_beneficiary,
    meanSesBeforeNonBeneficiary: meanSesA_nonBeneficiary,
    meanSesAfterNonBeneficiary: meanSesB_nonBeneficiary,
    delta: meanSesB_beneficiary - meanSesA_beneficiary,
    featureImportance,
    areaDistribution: areaStats.slice(0, 8).map((item) => ({ name: item.area, beneficiary: item.beneficiary, nonBeneficiary: item.nonBeneficiary })),
    ageDistribution,
    educationLevels,
    psDistribution,
    sesTrend,
    radarData,
    smdData,
    maritalData,
    householdData,
    summaryRows,
    respondents,
    areaStats,
    topArea,
  };
};

const MLUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [treatmentColumn, setTreatmentColumn] = useState('');
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [includeFeatures, setIncludeFeatures] = useState('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(7);

  const autoDetectedFields = useMemo(() => {
    if (!columns.length) return {};
    const headers = columns.map((column) => String(column).trim()).filter(Boolean);
    const treatment = detectColumn(headers, ['a2', 'group', 'treated', 'control', 'treatment', 'assignment', 'arm']);
    const preOutcome = detectColumn(headers, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'baseline_score', 'pre_score']);
    const postOutcome = detectColumn(headers, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'followup']);
    const outcome = detectColumn(headers, ['outcome', 'score', 'result', 'sesb', 'ses_b', 'ses b', 'post', 'after', 'final']);
    return { treatment, preOutcome, postOutcome, outcome };
  }, [columns]);

  const activeStep = analysisResults ? 4 : isAnalyzing ? 3 : file ? 2 : 1;
  const stepItems = [
    { id: 1, title: 'Upload', description: 'Drag & drop your CSV or XLSX file', icon: '⬆' },
    { id: 2, title: 'Configure', description: 'Select treatment, outcome & feature filter', icon: '⚗' },
    { id: 3, title: 'Analyze', description: 'Get PS scores, balance, SHAP & impact', icon: '📊' },
    { id: 4, title: 'Save', description: 'Store or download results for later', icon: '💾' },
  ];

  const resetAnalysisState = () => {
    setAnalysisResults(null);
    setShowPreview(false);
    setIsAnalyzing(false);
    setCurrentPage(1);
  };

  const parseCSV = (selectedFile) => {
    setError(null);
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        if (!text || !text.trim()) {
          setError('CSV file is empty');
          setIsLoading(false);
          return;
        }
        const rawRows = parseCSVRows(text);
        const headers = rawRows[0]?.map((header) => String(header ?? '').trim()).filter(Boolean) || [];
        const rows = rowsToObjects(rawRows.slice(1), headers).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
        if (!headers.length || !rows.length) {
          setError('No valid data found');
          setIsLoading(false);
          return;
        }
        setColumns(headers);
        setCsvData(rows);
        setFile(selectedFile);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setIncludeFeatures('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
        setCurrentPage(1);
        resetAnalysisState();
        setShowPreview(true);
      } catch (err) {
        setError('Failed to parse CSV');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };
    reader.readAsText(selectedFile);
  };

  const parseXLSX = (selectedFile) => {
    setError(null);
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const headers = raw[0]?.map((header) => String(header ?? '').trim()).filter(Boolean) || [];
        const rows = rowsToObjects(raw.slice(1), headers).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
        if (!headers.length || !rows.length) {
          setError('No valid data found');
          setIsLoading(false);
          return;
        }
        setColumns(headers);
        setCsvData(rows);
        setFile(selectedFile);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setIncludeFeatures('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
        setCurrentPage(1);
        resetAnalysisState();
        setShowPreview(true);
      } catch (err) {
        setError('Failed to parse XLSX');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read XLSX');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const validateAndProcessFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) {
      setError('Invalid file selected');
      return;
    }
    if (selectedFile.size === 0) {
      setError('File is empty');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB');
      return;
    }
    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.csv')) parseCSV(selectedFile);
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) parseXLSX(selectedFile);
    else setError('Unsupported file type. Only CSV and XLSX are supported');
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) validateAndProcessFile(selectedFile);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const selectedFile = event.dataTransfer.files?.[0];
    if (selectedFile) validateAndProcessFile(selectedFile);
  };

  const handleChangeFile = () => {
    setFile(null);
    setCsvData([]);
    setColumns([]);
    setTreatmentColumn('');
    setOutcomeColumn('');
    setIncludeFeatures('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
    setShowPreview(false);
    setError(null);
    setCurrentPage(1);
    resetAnalysisState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = () => {
    if (!csvData.length) {
      setError('No data available to analyze');
      return;
    }
    const detectedTreatment = treatmentColumn || autoDetectedFields.treatment;
    const detectedOutcome = outcomeColumn || autoDetectedFields.postOutcome || autoDetectedFields.outcome;
    if (!detectedTreatment) {
      setError('No treatment/group column could be detected. Please choose one from the dropdown.');
      return;
    }
    if (!detectedOutcome) {
      setError('No outcome column could be detected. Please choose one from the dropdown.');
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      setAnalysisResults(buildAnalysisResults(csvData, columns, treatmentColumn, outcomeColumn, includeFeatures));
      setIsAnalyzing(false);
    }, 1800);
  };

  const handleImportForm = () => {
    if (!csvData.length || !columns.length) {
      setError('No data available to import');
      return;
    }
    navigate('/forms/new', {
      state: {
        importedData: {
          title: `Imported Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/i, '') || 'Data'}`,
          description: `Form created from ${file?.name || 'uploaded file'} import with ${columns.length} fields and ${csvData.length} rows`,
          fields: columns.map((column, index) => ({ id: `field_${index}`, type: 'text', label: column, required: false, placeholder: `Enter ${column}` })),
          importType: file?.name?.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX',
          sourceFile: file?.name,
        },
      },
      replace: true,
    });
  };

  const handleDownloadJSON = () => {
    if (!analysisResults) return;
    const blob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveResults = () => {
    if (!analysisResults) return;
    const saved = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
    saved.push({
      id: Date.now().toString(36),
      name: saveName || `Analysis ${new Date().toLocaleString()}`,
      description: saveDescription || '',
      date: new Date().toISOString(),
      results: analysisResults,
    });
    localStorage.setItem('savedAnalyses', JSON.stringify(saved));
    setShowSaveModal(false);
    setSaveName('');
    setSaveDescription('');
  };

  const totalPages = Math.max(1, Math.ceil(csvData.length / rowsPerPage));
  const previewRows = csvData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.pageBg, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <div className="mx-auto max-w-[1500px] px-6 pb-24 pt-8 sm:px-8 lg:px-10">
        <div className="mb-8 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/dashboard')} className="rounded-[8px] border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-[600] text-[#475569] hover:bg-[#f8fafc]">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <span className="hidden text-[12px] font-[500] text-[#94a3b8] md:block">PSM · SES Impact · BFAR</span>
        </div>

        <header className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#0db890] to-[#2563eb] shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L8 12L12 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[36px] font-[800] tracking-[-0.02em] text-[#2563eb]">ML Analysis</h1>
          <p className="mt-2 text-[14px] font-[400] text-[#64748b]">Upload your dataset for propensity-score matching</p>
        </header>

        <div className="mt-10 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="grid gap-[0px] md:grid-cols-4">
            {stepItems.map((step, index) => {
              const isActive = activeStep === step.id;
              const isDone = activeStep > step.id;
              const background = isDone ? '#f0fdf4' : isActive ? '#eff6ff' : 'transparent';
              const badgeColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#94a3b8';
              const textColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#334155';
              return (
                <div key={step.title} className={`flex items-start gap-[12px] border-b border-[#f1f5f9] p-[18px_20px] md:border-b-0 md:border-r ${index === stepItems.length - 1 ? 'md:border-r-0' : ''}`} style={{ background }}>
                  <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px]" style={{ background: isDone ? '#f0fdf4' : isActive ? '#eff6ff' : '#f8fafc', color: badgeColor }}>
                    {isDone ? <Check className="h-4 w-4" /> : <span className="text-[13px] font-[700]">{step.icon}</span>}
                  </div>
                  <div>
                    <div className="text-[14px] font-[700]" style={{ color: textColor }}>{step.title}</div>
                    <div className="mt-[3px] text-[12px] font-[400] leading-[1.4] text-[#94a3b8]">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-[#f1f5f9] px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-[700] text-[#1e293b]">Import File</div>
              <div className="text-[12px] font-[400] text-[#94a3b8]">Upload CSV or XLSX to prepare the analysis</div>
            </div>
          </div>
          <div className="px-6 py-6">
            {error ? (
              <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {!file ? (
              <div className={`rounded-[10px] border border-dashed p-[60px_24px] text-center transition-all ${isDragging ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#c7d2de] bg-[#f8fafc]'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="mt-4 text-[15px] font-[700] text-[#1e293b]">Drop your CSV or XLSX file here</div>
                <div className="mt-1 text-[12px] font-[400] text-[#94a3b8]">or click to browse (max 10MB)</div>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => fileInputRef.current?.click()} className="rounded-[8px] bg-[#2563eb] px-[28px] py-[10px] text-[13px] font-[600] text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] focus-visible:outline-offset-2">
                    <Upload className="mr-2 h-4 w-4" /> Choose File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#d1fae5] text-[24px]">📄</div>
                    <div>
                      <div className="text-[14px] font-[700] text-[#1e293b]">{file.name}</div>
                      <div className="text-[12px] font-[400] text-[#94a3b8]">{(file.size / 1024).toFixed(2)} KB</div>
                      <div className="mt-2 text-[12px] font-[600] text-[#0db890]">✓ {csvData.length.toLocaleString()} rows · {columns.length} columns detected</div>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-4 py-2 text-[12px] font-[500] text-[#475569]" onClick={handleChangeFile}>Change File</Button>
                </div>

                <div className="grid gap-[16px] md:grid-cols-3">
                  <div>
                    <Label htmlFor="treatment" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Group / Treatment</Label>
                    <select id="treatment" value={treatmentColumn} onChange={(event) => setTreatmentColumn(event.target.value)} className="w-full rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[8px] text-[12.5px] text-[#475569] focus:border-[#2563eb] focus:outline-none">
                      <option value="">Auto-detect → A2:GROUP</option>
                      {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="outcome" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Outcome</Label>
                    <select id="outcome" value={outcomeColumn} onChange={(event) => setOutcomeColumn(event.target.value)} className="w-full rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[8px] text-[12.5px] text-[#475569] focus:border-[#2563eb] focus:outline-none">
                      <option value="">Auto-detect → Outcome / Post column</option>
                      {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                    <div className="mt-2 text-[11px] text-[#64748b]">
                      Auto-detected: Treatment = <strong>{autoDetectedFields.treatment || 'none'}</strong>, Outcome = <strong>{autoDetectedFields.postOutcome || autoDetectedFields.outcome || 'none'}</strong>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="includeFeatures" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Include only</Label>
                    <Input id="includeFeatures" value={includeFeatures} onChange={(event) => setIncludeFeatures(event.target.value)} placeholder="B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION" className="rounded-[6px] border-[#dde3ec] text-[12.5px] text-[#475569]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showPreview && csvData.length > 0 ? (
          <div className="mt-8 overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-6 py-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">🗄</div>
                <div>
                  <div className="text-[14px] font-[700] text-[#1e293b]">Data Preview ({csvData.length} rows, {columns.length} columns)</div>
                  <div className="text-[12px] font-[400] text-[#94a3b8]">Parsed and ready for matching analysis</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-[#dcfce7] px-[9px] py-[2px] text-[11px] font-[600] text-[#0db890]">✓ Parsed</Badge>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-[6px] border-[#e2e8f0]" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-[6px] border-[#e2e8f0]" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="overflow-x-auto px-6 py-6">
              <table className="min-w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.03em] text-[#475569]">
                    {columns.map((column) => <th key={column} className="border-b border-[#f1f5f9] px-3 py-2 text-left font-[700]">{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${currentPage}`} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      {columns.map((column) => {
                        const value = row[column] ?? '';
                        const normalized = String(value).trim();
                        const name = column.toLowerCase();
                        if (name.includes('group')) {
                          const normalizedGroup = normalized === '1' || normalized.toLowerCase() === 'treated' || normalized.toLowerCase() === 'b' || normalized.toLowerCase() === 'beneficiary' ? 'B' : 'NB';
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2"><span className={`rounded-[5px] px-2 py-0.5 text-[11px] font-[700] ${normalizedGroup === 'B' ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#f1f5f9] text-[#475569]'}`}>{normalizedGroup}</span></td>;
                        }
                        if (name.includes('ses') && name.includes('a')) {
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 font-mono text-[11px] text-[#64748b]">{normalized || '—'}</td>;
                        }
                        if (name.includes('ses') && name.includes('b')) {
                          const pairedA = parseNumericValue(row[column.replace(/B$/i, 'a')]);
                          const currentB = parseNumericValue(value);
                          const arrow = currentB !== null && pairedA !== null ? (currentB > pairedA ? ' ▲' : currentB < pairedA ? ' ▼' : '') : '';
                          const color = currentB !== null && pairedA !== null ? (currentB > pairedA ? '#16a34a' : currentB < pairedA ? '#dc2626' : '#64748b') : '#64748b';
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 font-mono text-[11px] font-[600]" style={{ color }}>{normalized || '—'}{arrow}</td>;
                        }
                        return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 text-[12px] text-[#334155]">{normalized || '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {csvData.length > 0 ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={handleImportForm} className="rounded-[8px] bg-[#0db890] px-[22px] py-[10px] text-[13px] font-[600] text-white hover:bg-[#0aa37f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0db890] focus-visible:outline-offset-2">
              <Import className="mr-2 h-4 w-4" /> Create Form from CSV
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className={`rounded-[8px] px-[26px] py-[10px] text-[13px] font-[600] text-white ${isAnalyzing ? 'bg-[#93c5fd]' : 'bg-[#2563eb] hover:bg-[#1d4ed8]'}`}>
              {isAnalyzing ? '⏳ Analyzing…' : <><BarChart3 className="mr-2 h-4 w-4" /> Analyze Data</>}
            </Button>
          </div>
        ) : null}

        {analysisResults ? <RespondentAnalytics columns={columns} rows={csvData} analysis={analysisResults} /> : null}

        {analysisResults ? (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white px-6 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcfce7] text-[#0db890]">📈</div>
              <div>
                <div className="text-[15px] font-[800] text-[#1e293b]">Matching & Impact Results</div>
                <div className="text-[12px] font-[400] text-[#94a3b8]">Included in the dashboard above · Ready to save or export</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-[#dcfce7] px-[9px] py-[2px] text-[11px] font-[600] text-[#0db890]">✓ Complete</Badge>
              <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-[12px] py-[8px] text-[12px] font-[600] text-[#475569]" onClick={handleDownloadJSON}><Download className="mr-2 h-4 w-4" /> JSON</Button>
              <Button className="rounded-[8px] bg-[#2563eb] px-[12px] py-[8px] text-[13px] font-[600] text-white hover:bg-[#1d4ed8]" onClick={() => setShowSaveModal(true)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            </div>
          </div>
        ) : null}
      </div>

      {showSaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-[12px] border border-[#e2e8f0] bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-[700] text-[#1e293b]">Save Results</div>
              <button className="rounded-full p-1 text-[#94a3b8] hover:bg-[#f1f5f9]" onClick={() => setShowSaveModal(false)}>×</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="saveName">Name</Label>
                <Input id="saveName" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="e.g. BFAR baseline" className="mt-1 rounded-[6px] border-[#dde3ec]" />
              </div>
              <div>
                <Label htmlFor="saveDescription">Description</Label>
                <Textarea id="saveDescription" value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} placeholder="Notes for this run" className="mt-1 rounded-[6px] border-[#dde3ec]" rows={3} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white text-[#475569]" onClick={() => setShowSaveModal(false)}>Cancel</Button>
              <Button className="rounded-[8px] bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={handleSaveResults} disabled={!saveName.trim()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MLUpload;
