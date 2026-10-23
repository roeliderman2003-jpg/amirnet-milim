# השקת פטורנט: מה עושים פעם אחת

הקוד כבר מוכן: גרסה חינמית, נעילת תוכן, תשלום דרך Grow, דף נחיתה, היכרות ואבחון, מסמכים משפטיים, מחיקה והורדת נתונים, לוג אירועים ושגיאות, התקנה לטלפון ומצב לא מקוון.
כל מה שכאן דורש חשבון שלך, ולכן נעשה ידנית. לפי הסדר:

## 1. Supabase: מסד הנתונים (5 דקות)
1. Project → **SQL Editor** → New query.
2. קודם שני הסודות (הערכים האמיתיים נמצאים בהודעה בצ'אט, לא כאן):
   ```sql
   select vault.create_secret('<כתובת whatsapp_send של roee-context>', 'amirnet_ctx_url');
   select vault.create_secret('<המספר>@c.us', 'amirnet_wa_chat');
   ```
3. להדביק את כל `sql/004_paid.sql` ולהריץ (Run).
4. גישה מלאה לעצמך (בלי לשלם):
   ```sql
   insert into amirnet.entitlements (user_id, plan, valid_until, payment_ref)
   select id, 'owner', now() + interval '10 years', 'owner-' || id from auth.users where email = 'roe.liderman2003@gmail.com';
   ```

## 2. Supabase: התוכן המלא (2 דקות)
1. **Storage** → אמור להופיע bucket בשם `paid` (נוצר ב-SQL). הוא פרטי. לא לסמן Public.
2. Upload → הקובץ `paid.js` (נשלח אליך בצ'אט; אפשר לבנות מחדש עם `node tools/build-tiers.js`, והוא נוצר ב-`paid/paid.js`).
3. בכל פעם שמשנים תוכן (מילים, משפטים, שאלות): מריצים שוב את tools/build-tiers.js, מעלים את paid.js החדש (להחליף את הקיים), ודוחפים את free.js.

## 3. Grow: קישור תשלום + webhook (הדרך שכבר עובדת אצלך ב-lidercontent). API עם userId/pageCode הוא אפשרות לגיבוי
- ליצור קישור תשלום ב-Grow: 99 ₪, תיאור «פטורנט · גישה לכל החיים», כתובת חזרה: האתר עם ?paid=1. להדביק אותו ב-PAY_LINK ב-pro.js
- להריץ את sql/005_paylink.sql
- secrets ל-grow-notify: GROW_WEBHOOK_KEY (המפתח של ה-webhooks בחשבון) ו/או GROW_WEBHOOK_SECRET, ולבקש מ-Grow להוסיף webhook לכתובת https://jezxhibenekurxymwxrb.supabase.co/functions/v1/grow-notify?k=<GROW_WEBHOOK_SECRET>

### אפשרות API (אם Grow נותנים userId ו-pageCode)
1. לכתוב ל-apisupport@grow.business: "אני רוצה לחבר את עמוד התשלום שלי ב-API (createPaymentProcess עם notifyUrl ו-approveTransaction). אשמח ל-userId ו-pageCode לסביבת בדיקות ולייצור, עמוד שמאפשר אשראי וביט, והפקת חשבונית/קבלה אוטומטית."
2. Grow בודקים את האתר לפני ייצור: צריך תנאי שימוש (יש: terms.html), מדיניות פרטיות (יש), ופרטי העסק.

## 4. Supabase: הפונקציות של התשלום (10 דקות)
1. **Edge Functions** → Deploy a new function → Via Editor:
   - שם `grow-create`, להדביק את `supabase/functions/grow-create/index.ts`. Deploy.
   - שם `grow-notify`, להדביק את `supabase/functions/grow-notify/index.ts`. **לכבות "Verify JWT"** (Grow לא שולחים טוקן). Deploy.
2. **Edge Functions → Secrets** (Manage secrets):
   - `GROW_USER_ID`, `GROW_PAGE_CODE` מ-Grow. `GROW_API_KEY` רק אם נתנו.
   - `GROW_ENV` = `sandbox` לבדיקה, ואחרי שהכול עובד `production` (ולהחליף ל-userId ו-pageCode של ייצור).
   - `SITE_URL` = כתובת האתר, למשל `https://roeliderman2003-jpg.github.io/amirnet-milim/`
3. בדיקה: להתחבר עם חשבון אחר (לא שלך), «פתיחת הגישה המלאה», לשלם בכרטיס בדיקה של Grow, ולוודא שהגישה נפתחת. ב-Table Editor → amirnet.payments רואים את התשלום (status = paid).
4. המחיר (99 ₪ חד-פעמי, לכל החיים): ב-`grow-create`/`grow-notify` (PLANS) ובתצוגה ב-`pro.js` (PRICES). חייבים להיות זהים.

## 5. GitHub: שהתוכן המלא לא יהיה גלוי באתר
1. Settings → **Pages** → Source: **GitHub Actions**. מעכשיו עולים לאתר רק הקבצים הציבוריים (`.github/workflows/pages.yml`).
2. מומלץ: להפוך את ה-repo לפרטי (Settings → General → Danger zone). Pages ב-repo פרטי דורש GitHub Pro (4$ לחודש). בלי זה, מי שמכיר את ה-repo יכול להוריד ממנו את קבצי התוכן.
   (מה שכבר פורסם עד היום נשאר בהיסטוריה. כל תוכן חדש מעכשיו מוגן.)

## 6. Google: מסך הכניסה (15 דקות, אישור של Google לוקח כמה ימים)
Google Cloud Console → APIs & Services → **OAuth consent screen**: שם האפליקציה «פטורנט», לוגו (`icons/icon-512.png`), קישורים ל-privacy.html ו-terms.html, ו-Publish. אחרי האימות המשתמשים יראו «פטורנט» ולא כתובת supabase.co.

## 7. לפני שמתחילים לגבות ברצינות
- **Supabase Pro** (25$ לחודש): גיבוי יומי, והפרויקט לא נעצר אחרי שבוע בלי פעילות.
- **עורך דין**: שעה-שעתיים על terms.html, privacy.html ושם המוצר.
- **רואה חשבון**: עוסק פטור / מורשה, חשבוניות.

## איפה רואים מה קורה
- Table Editor → `amirnet.events`: כניסות, שיעורים, אבחונים, לחיצות על תשלום, שגיאות (kind = error).
- `amirnet.payments`, `amirnet.entitlements`: תשלומים וגישות.
- `amirnet.real_scores`: ציונים אמיתיים שמשתמשים דיווחו (לכיול הציון המשוער).
- `amirnet.reports`: דיווחים על טעויות (נשלחים גם לווצאפ).
