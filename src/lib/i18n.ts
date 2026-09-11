import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "KHALEEJ": "KHALEEJ",
      "Tomorrow": "Tomorrow",
      "Today": "Today",
      "Live player count": "Live player count",
      "Coming": "Coming",
      "Maybe": "Maybe",
      "Can't come": "Can't come",
      "Need more players": "Need more players",
      "Almost there — need {{count}} more": "Almost there — need {{count}} more",
      "Enough players for a match!": "Enough players for a match!",
      "Full — {{count}}/{{max}}": "🔥 Full — {{count}}/{{max}}",
      "Voting closed": "🔒 Voting closed",
      "Voting closes in": "Voting closes in",
      "I'm Coming": "I'm Coming",
      "Admin": "Admin",
      "Players": "Players",
      "Match full": "🔥 Match full"
    }
  },
  ml: {
    translation: {
      "KHALEEJ": "KHALEEJ",
      "Tomorrow": "നാളെ",
      "Today": "ഇന്ന്",
      "Live player count": "തത്സമയ കളിക്കാരുടെ എണ്ണം",
      "Coming": "വരും",
      "Maybe": "ചിലപ്പോൾ വരും",
      "Can't come": "വരാൻ കഴിയില്ല",
      "Need more players": "കൂടുതൽ കളിക്കാരെ ആവശ്യമുണ്ട്",
      "Almost there — need {{count}} more": "ഏകദേശം ആയി — {{count}} പേർ കൂടി വേണം",
      "Enough players for a match!": "മാച്ചിന് ആവശ്യത്തിന് കളിക്കാരായി!",
      "Full — {{count}}/{{max}}": "🔥 ഫുൾ — {{count}}/{{max}}",
      "Voting closed": "🔒 വോട്ടിംഗ് അവസാനിച്ചു",
      "Voting closes in": "വോട്ടിംഗ് അവസാനിക്കാൻ",
      "I'm Coming": "ഞാൻ വരും",
      "Admin": "അഡ്മിൻ",
      "Players": "കളിക്കാർ",
      "Match full": "🔥 മാച്ച് ഫുൾ ആയി"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('khaleej_lang') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
