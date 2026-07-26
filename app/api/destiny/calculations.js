import lunar from "lunar-javascript";
import * as Astronomy from "astronomy-engine";

const { Solar } = lunar;

const ELEMENT_BY_STEM = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

const ELEMENT_BY_BRANCH = {
  寅: "木",
  卯: "木",
  巳: "火",
  午: "火",
  辰: "土",
  戌: "土",
  丑: "土",
  未: "土",
  申: "金",
  酉: "金",
  子: "水",
  亥: "水",
};

const LOCATIONS = [
  ["台北", 25.033, 121.565, 8],
  ["新北", 25.016, 121.462, 8],
  ["基隆", 25.128, 121.739, 8],
  ["桃園", 24.993, 121.301, 8],
  ["新竹", 24.813, 120.967, 8],
  ["苗栗", 24.56, 120.821, 8],
  ["台中", 24.147, 120.674, 8],
  ["臺中", 24.147, 120.674, 8],
  ["彰化", 24.068, 120.557, 8],
  ["南投", 23.961, 120.971, 8],
  ["雲林", 23.709, 120.431, 8],
  ["嘉義", 23.48, 120.449, 8],
  ["台南", 22.999, 120.227, 8],
  ["臺南", 22.999, 120.227, 8],
  ["高雄", 22.627, 120.301, 8],
  ["屏東", 22.551, 120.548, 8],
  ["宜蘭", 24.757, 121.753, 8],
  ["花蓮", 23.991, 121.611, 8],
  ["台東", 22.755, 121.15, 8],
  ["臺東", 22.755, 121.15, 8],
  ["澎湖", 23.571, 119.579, 8],
  ["金門", 24.432, 118.318, 8],
  ["香港", 22.319, 114.169, 8],
  ["澳門", 22.199, 113.544, 8],
  ["上海", 31.23, 121.474, 8],
  ["北京", 39.904, 116.407, 8],
  ["廣州", 23.13, 113.264, 8],
  ["深圳", 22.543, 114.058, 8],
  ["東京", 35.676, 139.65, 9],
  ["大阪", 34.693, 135.502, 9],
  ["首爾", 37.566, 126.978, 9],
  ["曼谷", 13.756, 100.501, 7],
  ["新加坡", 1.352, 103.82, 8],
  ["吉隆坡", 3.139, 101.687, 8],
  ["洛杉磯", 34.052, -118.244, -8],
  ["紐約", 40.713, -74.006, -5],
  ["溫哥華", 49.282, -123.121, -8],
  ["倫敦", 51.507, -0.128, 0],
  ["巴黎", 48.857, 2.352, 1],
];

const PLANETS = [
  ["太陽", "Sun"],
  ["月亮", Astronomy.Body.Moon],
  ["水星", Astronomy.Body.Mercury],
  ["金星", Astronomy.Body.Venus],
  ["火星", Astronomy.Body.Mars],
  ["木星", Astronomy.Body.Jupiter],
  ["土星", Astronomy.Body.Saturn],
  ["天王星", Astronomy.Body.Uranus],
  ["海王星", Astronomy.Body.Neptune],
  ["冥王星", Astronomy.Body.Pluto],
];

const ZODIAC = [
  "牡羊座",
  "金牛座",
  "雙子座",
  "巨蟹座",
  "獅子座",
  "處女座",
  "天秤座",
  "天蠍座",
  "射手座",
  "摩羯座",
  "水瓶座",
  "雙魚座",
];

export function calculateDestinyChart(input) {
  const birth = parseDate(input.birth);
  const time = input.unknownTime ? { hour: 12, minute: 0, approximate: true } : parseTime(input.time);
  const location = resolveLocation(input.birthplace);
  const local = { ...birth, ...time };
  const utcDate = new Date(Date.UTC(birth.year, birth.month - 1, birth.day, time.hour - location.timezone, time.minute, 0));

  return {
    precision: {
      time: time.approximate ? "出生時間未知，以中午 12:00 建立不含上升的星盤" : "使用使用者輸入的出生時間",
      location: location.matched ? `出生地匹配：${location.name}` : "出生地未完整匹配，使用台北作為預設座標",
      timezone: `UTC${location.timezone >= 0 ? "+" : ""}${location.timezone}`,
    },
    birthplace: location,
    bazi: calculateBazi(local),
    astrology: calculateAstrology(utcDate, location, time.approximate),
  };
}

function parseDate(value) {
  const match = String(value || "").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) throw new Error("生日格式需要 YYYY/MM/DD");
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error("生日日期不合法");
  return { year, month, day };
}

function parseTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) throw new Error("出生時間格式需要 HH:MM");
  const [, hour, minute] = match.map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error("出生時間不合法");
  return { hour, minute, approximate: false };
}

function resolveLocation(value) {
  const text = String(value || "").replace(/\s/g, "");
  const found = LOCATIONS.find(([name]) => text.includes(name));
  const [name, latitude, longitude, timezone] = found || LOCATIONS[0];
  return { name, latitude, longitude, timezone, matched: Boolean(found) };
}

function calculateBazi(local) {
  const solar = Solar.fromYmdHms(local.year, local.month, local.day, local.hour, local.minute, 0);
  const lunarDate = solar.getLunar();
  const eight = lunarDate.getEightChar();
  const pillars = [
    makePillar("年柱", eight.getYear(), eight.getYearGan(), eight.getYearZhi(), eight.getYearWuXing(), eight.getYearShiShenGan(), eight.getYearShiShenZhi(), eight.getYearNaYin()),
    makePillar("月柱", eight.getMonth(), eight.getMonthGan(), eight.getMonthZhi(), eight.getMonthWuXing(), eight.getMonthShiShenGan(), eight.getMonthShiShenZhi(), eight.getMonthNaYin()),
    makePillar("日柱", eight.getDay(), eight.getDayGan(), eight.getDayZhi(), eight.getDayWuXing(), eight.getDayShiShenGan(), eight.getDayShiShenZhi(), eight.getDayNaYin()),
    makePillar("時柱", eight.getTime(), eight.getTimeGan(), eight.getTimeZhi(), eight.getTimeWuXing(), eight.getTimeShiShenGan(), eight.getTimeShiShenZhi(), eight.getTimeNaYin()),
  ];

  return {
    solar: solar.toYmdHms(),
    lunar: lunarDate.toString(),
    zodiac: lunarDate.getYearShengXiao(),
    dayMaster: `${eight.getDayGan()}${ELEMENT_BY_STEM[eight.getDayGan()] || ""}`,
    pillars,
    elementCounts: countElements(pillars),
    tenGods: {
      heavenly: lunarDate.getBaZiShiShenGan(),
      earthly: lunarDate.getBaZiShiShenZhi(),
    },
    mingGong: eight.getMingGong(),
    shenGong: eight.getShenGong(),
  };
}

function makePillar(label, value, stem, branch, wuxing, tenGodStem, tenGodBranch, naYin) {
  return { label, value, stem, branch, wuxing, tenGodStem, tenGodBranch, naYin };
}

function countElements(pillars) {
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of pillars) {
    const stemElement = ELEMENT_BY_STEM[pillar.stem];
    const branchElement = ELEMENT_BY_BRANCH[pillar.branch];
    if (stemElement) counts[stemElement] += 1;
    if (branchElement) counts[branchElement] += 1;
  }
  return counts;
}

function calculateAstrology(utcDate, location, timeApproximate) {
  const planets = PLANETS.map(([name, body]) => {
    const longitude = calculateTropicalLongitude(body, utcDate);
    return {
      key: planetKey(body),
      name,
      symbol: planetSymbol(body),
      longitude: round(longitude),
      sign: zodiacSign(longitude),
      degreeInSign: round(((longitude % 30) + 30) % 30),
    };
  });

  return {
    calculatedAtUtc: utcDate.toISOString(),
    planets,
    ascendant: timeApproximate ? null : calculateAscendant(utcDate, location),
    display: buildNatalChartDisplay(planets, timeApproximate ? null : calculateAscendant(utcDate, location)),
  };
}

function calculateTropicalLongitude(body, utcDate) {
  if (body === "Sun") return normalizeDegrees(Astronomy.SunPosition(utcDate).elon);
  if (body === Astronomy.Body.Moon) return normalizeDegrees(Astronomy.EclipticGeoMoon(utcDate).lon);

  const geocentricVector = Astronomy.GeoVector(body, utcDate, true);
  const eclipticVector = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), geocentricVector);
  const sphere = Astronomy.SphereFromVector(eclipticVector);
  return normalizeDegrees(sphere.lon);
}

function calculateAscendant(date, location) {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);
  const rotation = Astronomy.Rotation_ECL_HOR(date, observer);
  const longitude = findEasternHorizonEclipticLongitude(date, rotation);
  return {
    key: "ascendant",
    symbol: "ASC",
    longitude: round(longitude),
    sign: zodiacSign(longitude),
    degreeInSign: round(longitude % 30),
  };
}

function findEasternHorizonEclipticLongitude(date, rotation) {
  let previousLongitude = 0;
  let previous = eclipticHorizonVector(previousLongitude, date, rotation);

  for (let longitude = 1; longitude <= 360; longitude += 1) {
    const current = eclipticHorizonVector(longitude, date, rotation);
    const crossesHorizon = previous.z === 0 || current.z === 0 || previous.z * current.z < 0;
    const easternSide = (previous.y + current.y) / 2 < 0;

    if (crossesHorizon && easternSide) {
      return refineHorizonCrossing(previousLongitude, longitude, date, rotation);
    }

    previousLongitude = longitude;
    previous = current;
  }

  return normalizeDegrees(previousLongitude);
}

function refineHorizonCrossing(low, high, date, rotation) {
  let left = low;
  let right = high;
  let leftVector = eclipticHorizonVector(left, date, rotation);

  for (let index = 0; index < 24; index += 1) {
    const middle = (left + right) / 2;
    const middleVector = eclipticHorizonVector(middle, date, rotation);

    if (leftVector.z * middleVector.z <= 0) {
      right = middle;
    } else {
      left = middle;
      leftVector = middleVector;
    }
  }

  return normalizeDegrees((left + right) / 2);
}

function eclipticHorizonVector(longitude, date, rotation) {
  const sphere = new Astronomy.Spherical(0, normalizeDegrees(longitude), 1);
  const eclipticVector = Astronomy.VectorFromSphere(sphere, date);
  return Astronomy.RotateVector(rotation, eclipticVector);
}

function buildNatalChartDisplay(planets, ascendant) {
  const visiblePlanets = planets.filter((planet) =>
    ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"].includes(planet.key),
  );
  const points = visiblePlanets.map((planet, index) => ({
    ...planet,
    ...chartPosition(planet.longitude, 32 - index * 1.7),
  }));

  if (ascendant) {
    points.push({
      ...ascendant,
      name: "ASC",
      ...chartPosition(ascendant.longitude, 18),
    });
  }

  const sun = planets.find((planet) => planet.key === "sun");
  const moon = planets.find((planet) => planet.key === "moon");

  return {
    title: "出生星盤預覽",
    summary: [sun && `太陽 ${sun.sign}`, moon && `月亮 ${moon.sign}`, ascendant && `上升 ${ascendant.sign}`].filter(Boolean),
    wheel: {
      centerX: 50,
      centerY: 51,
      radiusX: 35,
      radiusY: 22,
    },
    points,
  };
}

function chartPosition(longitude, radius) {
  const angle = deg2rad(normalizeDegrees(longitude) - 90);
  return {
    x: round(50 + Math.cos(angle) * radius),
    y: round(51 + Math.sin(angle) * radius * 0.58),
  };
}

function planetKey(body) {
  if (body === "Sun") return "sun";
  const text = String(body).toLowerCase();
  if (text.includes("moon")) return "moon";
  if (text.includes("mercury")) return "mercury";
  if (text.includes("venus")) return "venus";
  if (text.includes("mars")) return "mars";
  if (text.includes("jupiter")) return "jupiter";
  if (text.includes("saturn")) return "saturn";
  if (text.includes("uranus")) return "uranus";
  if (text.includes("neptune")) return "neptune";
  if (text.includes("pluto")) return "pluto";
  return text;
}

function planetSymbol(body) {
  const symbols = {
    sun: "☉",
    moon: "☽",
    mercury: "☿",
    venus: "♀",
    mars: "♂",
    jupiter: "♃",
    saturn: "♄",
    uranus: "♅",
    neptune: "♆",
    pluto: "♇",
  };
  return symbols[planetKey(body)] || "•";
}

function zodiacSign(longitude) {
  return ZODIAC[Math.floor(normalizeDegrees(longitude) / 30)];
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function deg2rad(value) {
  return (value * Math.PI) / 180;
}

function rad2deg(value) {
  return (value * 180) / Math.PI;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
