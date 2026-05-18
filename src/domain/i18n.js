const LANGUAGE_KEY = "jp-trip-language-v1";

export const LANGUAGES = {
  en: "English",
  zh: "繁中"
};

const TEXT = {
  zh: {
    Home: "首頁",
    Money: "記帳",
    Restaurants: "餐廳",
    Trip: "旅程",
    Stays: "住宿",
    Flights: "航班",
    Expenses: "支出",
    "Osaka 2026": "大阪 2026",
    "Open map hub": "開啟地圖中心",
    "Address copied": "地址已複製",
    "Copy unavailable": "無法複製",
    "Arrival Day": "抵達日",
    "Return Day": "回程日",
    "Hotel Move": "換飯店",
    "KIX -> Hotel": "關西機場 -> 飯店",
    "KIX -> Osaka": "關西機場 -> 大阪",
    "KIX to Osaka": "關西機場到大阪",
    Hotel: "飯店",
    hotel: "飯店",
    "Next Stay": "下一間住宿",
    "Osaka Station": "大阪站",
    "Kansai International Airport": "關西國際機場",
    "Hotels, KIX, Osaka Station": "飯店、關西機場、大阪站",
    "View Steps": "查看步驟",
    "Open Uber": "開啟 Uber",
    "Open Map": "開啟地圖",
    "Open Maps": "開啟地圖",
    "Copy Address": "複製地址",
    "Copy KIX Address": "複製關西機場地址",
    "Check JR West": "查看 JR West",
    "Follow signs for JR / Kansai-Airport Station after arrivals.": "入境後跟著 JR / 關西機場站指標前進。",
    "Take the JR HARUKA Limited Express from Kansai-Airport Station to Osaka Station.": "從關西機場站搭乘 JR HARUKA 特急到大阪站。",
    "Open Uber and set your first stay as the dropoff.": "打開 Uber，將第一間住宿設為目的地。",
    "Restore or add your first stay to use its hotel address here.": "還原或新增第一間住宿後，這裡會使用它的飯店地址。",
    "Head to the departure terminal, airline check-in, and security.": "前往出發航廈、航空公司櫃台與安檢。",
    "Arrival Playbook": "抵達攻略",
    "Return Playbook": "回程攻略",
    "Recommended Trains": "建議班次",
    "Est. Osaka {time}": "預計 {time} 抵達大阪",
    "Est. arr. {time}": "預計 {time} 抵達",
    "After {time} arrival + 60 min": "{time} 抵達後 + 60 分鐘",
    "Add your KIX arrival flight to get recommended HARUKA departures. The static schedule is saved offline.": "新增抵達關西機場的航班後，這裡會推薦 HARUKA 班次。靜態時刻表可離線使用。",
    "Stored from {source}. Last verified {date}. Check JR West if plans change.": "資料來源：{source}。最後確認：{date}。若行程有變，請再查看 JR West。",
    "Airport Hotel to KIX": "機場飯店到關西機場",
    "Target airport arrival": "目標抵達機場時間",
    "Built from departure time minus {hours} hours": "依出發時間往前推 {hours} 小時計算",
    "Add your KIX departure flight to calculate the target airport arrival time.": "新增從關西機場出發的航班後，這裡會計算目標抵達機場時間。",
    "Be at KIX around {time}.": "約 {time} 抵達關西機場。",
    "Open Uber from {hotel} to Kansai International Airport.": "開啟 Uber，從 {hotel} 前往關西國際機場。",
    "Add the next hotel address.": "請新增下一間飯店地址。",
    "Trip days": "旅行日期",
    "Weekend Schedule": "週末時刻表",
    "Weekday Schedule": "平日時刻表",
    offline: "離線",
    Pick: "首選",
    Backup: "備選",
    Backups: "備選",
    "At KIX": "抵達關西機場",
    "Take HARUKA": "搭乘 HARUKA",
    "At Osaka Station": "抵達大阪站",
    "Hotel address": "飯店地址",
    "Airport arrival target": "機場抵達目標",
    "Leave hotel": "離開飯店",
    "Next Move": "下一步",
    "Upcoming Move": "接下來",
    "Arrival from KIX": "從關西機場抵達",
    "Move hotels": "更換飯店",
    "Return to KIX": "返回關西機場",
    Today: "今天",
    Arrive: "抵達",
    Depart: "出發",
    Arrival: "抵達",
    Departure: "出發",
    Flight: "航班",
    "Check in": "入住",
    "Check out": "退房",
    Tonight: "今晚",
    Map: "地圖",
    Addresses: "地址",
    "Open hub": "開啟",
    "Remaining trip balance": "旅費餘額",
    "Add expense": "新增支出",
    "Stays & flights": "住宿與航班",
    "Bookings in one place": "集中管理訂位資訊",
    "Open trip": "開啟旅程",
    Meals: "餐廳",
    "Track restaurants and food spend": "管理餐廳與餐飲紀錄",
    Open: "開啟",
    "Map & Addresses": "地圖與地址",
    Copy: "複製",
    "Add flights and stays to build your journey.": "新增航班與住宿後，這裡會建立你的旅程。",
    "No saved plans for this day yet.": "這一天尚未儲存行程。",
    "Travel day details and quick actions in one place.": "旅行日細節與快速操作都在這裡。",
    "Budget settings": "預算設定",
    "Trip Balance": "旅費餘額",
    Budget: "預算",
    Spent: "已花費",
    Remaining: "剩餘",
    "Add Expense": "新增支出",
    "Budget Settings": "預算設定",
    "Spending Mix": "支出分布",
    "Category Budgets": "分類預算",
    "Total Spent": "總花費",
    "Daily Spend": "每日支出",
    "by category": "依分類",
    "No spending yet.": "尚無支出。",
    "No daily data": "尚無每日資料",
    "Budget not set": "尚未設定預算",
    "Total trip budget (JPY)": "總旅費預算（日圓）",
    "Set category budgets only where you want a spending guardrail.": "只需要在想控制花費的分類設定預算。",
    Save: "儲存",
    "Budget saved": "預算已儲存",
    "Food & Drink": "餐飲",
    Shopping: "購物",
    Transportation: "交通",
    Other: "其他",
    "Saved Places": "收藏餐廳",
    "{count} restaurants": "{count} 間餐廳",
    "Reservations, map links, cuisines, and notes.": "訂位、地圖連結、料理類型與備註。",
    "No restaurants saved.": "尚未儲存餐廳。",
    "Add Restaurant": "新增餐廳",
    "Add restaurant": "新增餐廳",
    "New Restaurant": "新增餐廳",
    "Name of the Restaurant": "餐廳名稱",
    "Type of Cuisine": "料理類型",
    Area: "區域",
    "Map / Google Maps Link": "地圖 / Google Maps 連結",
    "Reservation Date & Time": "訂位日期與時間",
    Status: "狀態",
    Notes: "備註",
    Details: "詳細",
    Cuisine: "料理類型",
    Reservation: "訂位",
    "Not reserved": "未訂位",
    Delete: "刪除",
    "Restaurant saved": "餐廳已儲存",
    "Restaurant deleted": "餐廳已刪除",
    "Enter a restaurant name.": "請輸入餐廳名稱。",
    "Restaurant name is required.": "餐廳名稱為必填。",
    "Confirmation, must-order dishes, queue rules...": "訂位確認、必點菜色、排隊規則...",
    "Want to go": "想去",
    Reserved: "已訂位",
    Visited: "已造訪",
    Bookings: "訂位資訊",
    "Stays & Flights": "住宿與航班",
    "Hotel reservations and flight details live together here.": "飯店訂房與航班細節集中在這裡。",
    saved: "筆",
    "No stays yet.": "尚無住宿。",
    "No flights yet.": "尚無航班。",
    "Manage Stays": "管理住宿",
    "Manage Flights": "管理航班",
    "New Stay": "新增住宿",
    "Add stay": "新增住宿",
    "Back to stays": "返回住宿",
    "No stays yet — add the first hotel.": "尚無住宿，請新增第一間飯店。",
    "Choose check-in date": "選擇入住日期",
    "Choose check-out date": "選擇退房日期",
    "Hotel name": "飯店名稱",
    Address: "地址",
    "Booking reference": "訂房來源",
    "Check-in": "入住",
    "Check-out": "退房",
    Note: "備註",
    "Stay saved": "住宿已儲存",
    Nights: "晚數",
    Booking: "訂房",
    "New Flight": "新增航班",
    "Add flight": "新增航班",
    "Flight number": "航班編號",
    Airline: "航空公司",
    From: "出發地",
    To: "目的地",
    "Departure (local)": "出發時間（當地）",
    "Departure time zone": "出發時區",
    "Arrival (local)": "抵達時間（當地）",
    "Arrival time zone": "抵達時區",
    Passengers: "乘客",
    "Dep terminal": "出發航廈",
    "Dep gate": "出發登機門",
    "Arr terminal": "抵達航廈",
    "Arr gate": "抵達登機門",
    "Flight saved": "航班已儲存",
    Terminal: "航廈",
    Gate: "登機門",
    "Enter departure & arrival times.": "請輸入出發與抵達時間。",
    "Flight number, from, and to are required.": "航班編號、出發地與目的地為必填。",
    "No expenses logged.": "尚無支出。",
    "Add First Expense": "新增第一筆支出",
    "Trip Spend": "旅程花費",
    Entries: "筆數",
    Days: "天數",
    "New Expense": "新增支出",
    "Amount (JPY)": "金額（日圓）",
    "Place / service": "店家 / 服務",
    Category: "分類",
    When: "時間",
    "Receipt photo": "收據照片",
    "Receipt photos are optional proof only. Enter the amount manually above.": "收據照片只是可選憑證，金額請手動輸入。",
    "Expense saved": "支出已儲存",
    "Close": "關閉",
    "Switch language": "切換語言",
    "This section could not load. Refresh once and try again.": "這個頁面無法載入。請重新整理後再試一次。"
  }
};

export const CUISINES = [
  "Ramen", "Yakiniku", "Yakitori", "Sukiyaki", "Kaiseki", "Sushi",
  "Okonomiyaki", "Dessert", "Drinks", "Cafe"
];

export const OSAKA_AREAS = [
  "Umeda", "Namba", "Shinsaibashi", "Dotonbori", "Honmachi", "Kitahama",
  "Nakanoshima", "Fukushima", "Tennoji", "Shin-Osaka", "Osaka Castle",
  "Kyobashi", "Universal City", "Rinku Town / KIX"
];

const OPTION_TEXT_ZH = {
  Ramen: "拉麵",
  Yakiniku: "燒肉",
  Yakitori: "烤雞串",
  Sukiyaki: "壽喜燒",
  Kaiseki: "懷石料理",
  Sushi: "壽司",
  Okonomiyaki: "大阪燒",
  Dessert: "甜點",
  Drinks: "酒吧 / 飲品",
  Cafe: "咖啡廳",
  Umeda: "梅田",
  Namba: "難波",
  Shinsaibashi: "心齋橋",
  Dotonbori: "道頓堀",
  Honmachi: "本町",
  Kitahama: "北濱",
  Nakanoshima: "中之島",
  Fukushima: "福島",
  Tennoji: "天王寺",
  "Shin-Osaka": "新大阪",
  "Osaka Castle": "大阪城",
  Kyobashi: "京橋",
  "Universal City": "環球城",
  "Rinku Town / KIX": "臨空城 / 關西機場"
};

export function getLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function setLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language === "zh" ? "zh" : "en");
  } catch {
    // The app remains usable without persistence.
  }
}

export function toggleLanguage() {
  const next = getLanguage() === "zh" ? "en" : "zh";
  setLanguage(next);
  return next;
}

export function t(key, vars = {}) {
  const value = getLanguage() === "zh" ? TEXT.zh[key] || key : key;
  return Object.entries(vars).reduce((out, [name, replacement]) =>
    out.replaceAll(`{${name}}`, String(replacement)), value);
}

export function optionLabel(value) {
  return getLanguage() === "zh" ? OPTION_TEXT_ZH[value] || value : value;
}

export function languageButtonLabel() {
  return getLanguage() === "zh" ? "EN" : "繁";
}
