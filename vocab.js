// אוצר מילים כללי לאמירנט. נבנה אוטומטית מ-vocab-src (node tools/build-vocab.js). לא לערוך ידנית.
// [מילה, פירוש, קבוצה, חלק דיבור (n שם עצם / v פועל / j תואר / r תואר פועל / x אחר), רמה, משפט עם ___, תרגום המשפט, הערה, מסיחים קבועים]
const VCATS = {
 "vfeel": {
  "he": "רגשות ותחושות",
  "en": "Feelings",
  "icon": "😊",
  "color": "#ff4b4b",
  "tip": "מה מרגישים: שמחה, פחד, כעס, עצב, הפתעה, תשוקה"
 },
 "vchar": {
  "he": "אופי והתנהגות",
  "en": "Character",
  "icon": "🧑",
  "color": "#f06543",
  "tip": "איך אדם מתנהג ומה האופי שלו: אמיץ, עצלן, נדיב, יהיר, זהיר"
 },
 "vmind": {
  "he": "מחשבה, ידע ודעה",
  "en": "Thinking",
  "icon": "🧠",
  "color": "#ce82ff",
  "tip": "לחשוב, להבין, לזכור, להאמין, לשפוט, להחליט, ספק וודאות"
 },
 "vtalk": {
  "he": "דיבור ותקשורת",
  "en": "Communication",
  "icon": "💬",
  "color": "#1cb0f6",
  "tip": "לומר, להסביר, לשאול, להתלונן, לשבח, להודיע, לשכנע"
 },
 "vtrue": {
  "he": "אמת, שקר ורמאות",
  "en": "Truth & Deceit",
  "icon": "🎭",
  "color": "#a568cc",
  "tip": "כנות מול שקר: להונות, לחשוף, להסתיר, אמין, מזויף"
 },
 "vchg": {
  "he": "שינוי ותנועה",
  "en": "Change & Motion",
  "icon": "🔄",
  "color": "#00a6a6",
  "tip": "משהו משתנה, זז, גדל, קטן, נפתח או נסגר"
 },
 "vact": {
  "he": "עשייה, יצירה והשגה",
  "en": "Action",
  "icon": "🛠️",
  "color": "#58cc02",
  "tip": "לעשות, לבנות, ליצור, להשיג, לנסות, להצליח, להיכשל"
 },
 "vqty": {
  "he": "כמות, גודל ומידה",
  "en": "Quantity",
  "icon": "📏",
  "color": "#2b70c9",
  "tip": "כמה, כמה גדול, כמה חזק: הרבה, מעט, עצום, זעיר, מוגזם"
 },
 "vtime": {
  "he": "זמן, סדר ותדירות",
  "en": "Time",
  "icon": "⏳",
  "color": "#ff9600",
  "tip": "מתי, כמה זמן, באיזה סדר ובאיזו תדירות: עתיק, זמני, תכוף"
 },
 "vqual": {
  "he": "תיאור ואיכות",
  "en": "Description",
  "icon": "🎨",
  "color": "#e5a000",
  "tip": "איך משהו נראה או כמה הוא טוב: ברור, מוזר, יפה, פשוט, נדיר"
 },
 "vbody": {
  "he": "גוף ובריאות",
  "en": "Body & Health",
  "icon": "🫀",
  "color": "#d33131",
  "tip": "איברים, מחלות, ריפוי, אוכל, שינה וכוח"
 },
 "vnat": {
  "he": "טבע, מדע וחומר",
  "en": "Nature & Science",
  "icon": "🌿",
  "color": "#3f9b0b",
  "tip": "בעלי חיים, צמחים, מזג אוויר, חומרים, ניסויים וחלל"
 },
 "vsoc": {
  "he": "חברה, חוק ושלטון",
  "en": "Society & Law",
  "icon": "⚖️",
  "color": "#4b4b4b",
  "tip": "אנשים, משפחה, קהילה, חוקים, בית משפט, ממשלה ודת"
 },
 "veco": {
  "he": "כסף, עבודה ומסחר",
  "en": "Money & Work",
  "icon": "💰",
  "color": "#7a5c3e",
  "tip": "לקנות, למכור, להרוויח, מקצועות, עסקים ורכוש"
 },
 "vconf": {
  "he": "מאבק, פגיעה וסכנה",
  "en": "Conflict",
  "icon": "⚔️",
  "color": "#cc348d",
  "tip": "מלחמה, אלימות, נזק, איום, סכנה, עונש והרס"
 },
 "vhelp": {
  "he": "עזרה, הסכמה ותמיכה",
  "en": "Support",
  "icon": "🤝",
  "color": "#1899d6",
  "tip": "לעזור, לתמוך, להסכים, לשתף פעולה, להגן, לסלוח"
 },
 "vneg": {
  "he": "שלילה, מניעה וסירוב",
  "en": "Refusal",
  "icon": "🚫",
  "color": "#ea2b2b",
  "tip": "לסרב, למנוע, לאסור, להגביל, לנטוש, להתנגד"
 },
 "vlife": {
  "he": "יומיום, בית ומקום",
  "en": "Everyday",
  "icon": "🏠",
  "color": "#8a6d3b",
  "tip": "בית, חפצים, לבוש, נסיעה, מקומות וכיוונים"
 },
 "vcult": {
  "he": "שפה, אמנות ותרבות",
  "en": "Culture",
  "icon": "📚",
  "color": "#6a5acd",
  "tip": "מילים, ספרים, מוזיקה, אמנות, חינוך ומסורת"
 }
};
const VNEAR = {"vfeel":["vchar"],"vchar":["vfeel","vtrue"],"vmind":["vtalk","vtrue"],"vtalk":["vmind","vcult","vtrue"],"vtrue":["vchar","vmind","vtalk"],"vchg":["vact","vqty"],"vact":["vchg"],"vqty":["vchg","vqual"],"vqual":["vqty"],"vconf":["vneg"],"vneg":["vconf"],"vsoc":["veco"],"veco":["vsoc"],"vbody":["vnat"],"vnat":["vbody"]};
const VRAW = [
["abandon","לנטוש, לזנוח","vneg","v",1,"The crew had to ___ the sinking ship.","הצוות נאלץ לנטוש את הספינה הטובעת."],
["abbreviate","לקצר (מילה או שם)","vcult","v",2,"People often ___ long names to save time.","אנשים מקצרים לעיתים קרובות שמות ארוכים כדי לחסוך זמן."],
["abdomen","בטן","vbody","n",2,"The doctor pressed gently on his ___ to check for pain.","הרופא לחץ בעדינות על הבטן שלו כדי לבדוק אם כואב."],
["abide","לציית, לעמוד ב...","vsoc","v",3,"All players must ___ by the rules of the game.","כל השחקנים חייבים לציית לחוקי המשחק.","בדרך כלל בא עם by: abide by = לציית ל..."],
["ability","יכולת","vact","n",1,"She has the ___ to learn languages very quickly.","יש לה את היכולת ללמוד שפות מהר מאוד."],
["abolish","לבטל (חוק או מנהג)","vsoc","v",2,"Many countries decided to ___ the death penalty.","מדינות רבות החליטו לבטל את עונש המוות."],
["abroad","בחו\"ל","vlife","r",1,"After the army, he traveled ___ for a year.","אחרי הצבא הוא טייל בחו\"ל במשך שנה."],
["abrupt","פתאומי, חד","vtime","j",2,"The meeting came to an ___ end when the fire alarm rang.","הפגישה הגיעה לסוף פתאומי כשאזעקת האש צלצלה."],
["absence","היעדרות, חוסר","vqty","n",1,"Nobody noticed his ___ from class yesterday.","אף אחד לא שם לב להיעדרות שלו מהשיעור אתמול."],
["absolute","מוחלט, גמור","vqty","j",1,"I have ___ trust in my best friend.","יש לי אמון מוחלט בחבר הכי טוב שלי."],
["absorb","לספוג, לקלוט","vnat","v",2,"A sponge can ___ a lot of water.","ספוג יכול לספוג הרבה מים."],
["abstract","מופשט","vmind","j",2,"Love and freedom are ___ ideas; you cannot touch them.","אהבה וחופש הם רעיונות מופשטים; אי אפשר לגעת בהם."],
["absurd","מגוחך, אבסורדי","vqual","j",2,"It is ___ to wear a winter coat in August in Tel Aviv.","זה מגוחך ללבוש מעיל חורף באוגוסט בתל אביב."],
["abundant","שופע, מצוי בשפע","vqty","j",3,"Fresh fruit is ___ in the market during the summer.","פירות טריים מצויים בשפע בשוק בקיץ."],
["abuse","התעללות, ניצול לרעה","vconf","n",2,"The new law protects children from ___.","החוק החדש מגן על ילדים מפני התעללות."],
["accelerate","להאיץ, להגביר מהירות","vchg","v",2,"The driver began to ___ when the light turned green.","הנהג התחיל להאיץ כשהרמזור התחלף לירוק."]
];
