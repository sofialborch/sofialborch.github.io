// Global Configuration and State
const TR = {
    nb: {
        title: "Tilgjengelighet", printBtn: "Skriv ut", today: "I dag", quickOutlook: "Hurtigoversikt",
        selectWeek: "Velg uke", wk: "Uke", ledig: "Ledig", opptatt: "Opptatt", delvis: "Delvis",
        lookup: "Søk", start: "Fra dato", end: "Til dato", searchBtn: "Søk i periode",
        fra: "Fra", til: "Til",
        printSettings: "Utskrift", certaintyLabel: "Bekreftet status til",
        generatePdf: "Generer PDF", loading: "Laster...", online: "Tilkoblet", local: "Lokal økt",
        noPlans: "Ingen planer registrert.", week: "Uke", monthLocale: 'nb-NO',
        days: ['M', 'T', 'O', 'T', 'F', 'L', 'S'],
        reqTitle: "Send Forespørsel",
        requestsTitle: "Innboks", noReq: "Ingen nye forespørsler", delete: "Slett"
    },
    en: {
        title: "Availability", printBtn: "Print Schedule", today: "Today", quickOutlook: "Quick Outlook",
        selectWeek: "Select Week", wk: "Wk", ledig: "Available", opptatt: "Busy", delvis: "Partial",
        lookup: "Lookup", start: "Start Date", end: "End Date", searchBtn: "Search Range",
        fra: "From", til: "To",
        printSettings: "Print Settings", certaintyLabel: "Status Secured Until",
        generatePdf: "Generate PDF", loading: "Loading...", online: "Online", local: "Local Session",
        noPlans: "No specific plans logged.", week: "Week", monthLocale: 'en-GB',
        days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        reqTitle: "Send Request",
        requestsTitle: "Inbox", noReq: "No new requests", delete: "Delete"
    }
};

const DYNAMIC_TR = {
    "studying": "studerer", "working": "jobber", "norønna": "norønna",
    "weekend": "helg", "vacation": "ferie", "traveling": "reiser",
    "at home": "hjemme", "busy": "opptatt", "available": "tilgjengelig"
};

let CURRENT_LANG = 'nb';
let DATA_STORE = { overrides: {}, settings: { certainUntil: '', phone: '' } };
let currentViewDate = new Date();
let currentEditDate = null;
let currentEditStatus = 'available';
let currentBadge = null;
let selectedRequestDates = new Set();