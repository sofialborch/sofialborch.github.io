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
        requestsTitle: "Innboks", noReq: "Ingen nye forespørsler", delete: "Slett",
        approve: "Behandle", conflictsFound: "Konflikt: Noen datoer er ikke ledige",
        bulkEditTitle: "Behandle forespørsel", applyToDates: "Godkjenn & Lagre",
        archive: "Avvis / Arkiver",
        // NEW KEYS
        callMe: "Haster det? Ring meg på:",
        loginTip: "Tips: Logg inn for å spore forespørsler permanent.",
        myRequests: "Mine Forespørsler",
        statusPending: "Venter", statusApproved: "Godkjent", statusRejected: "Avvist",
        
        // Response Modal & Msg
        sentTitle: "Forespørsel Sendt!",
        sentBody: "Jeg sjekker den så fort jeg kan. Sjekk status her i appen senere.",
        sentClose: "Den er grei",
        adminResponseLabel: "Svar til bruker (Valgfritt)",
        adminPlaceholder: "Skriv en beskjed til brukeren...",
        adminResponseTitle: "Svar fra meg:",

        // Tutorial
        tutHeader1: "Sjekk Status",
        tutBody1: "Grønn betyr ledig. Rød betyr opptatt. Gul betyr delvis tilgjengelig - ta kontakt.",
        tutHeader2: "Velg Datoer",
        tutBody2: "Trykk på dager i kalenderen for å markere dem. Du kan velge flere dager samtidig.",
        tutHeader3: "Send Forespørsel",
        tutBody3: "Fyll ut navn og melding i menyen som dukker opp for å sende en forespørsel.",
        tutNext: "Neste",
        tutGotIt: "Forstått",
        tutSkip: "Hopp over"
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
        requestsTitle: "Inbox", noReq: "No new requests", delete: "Delete",
        approve: "Process", conflictsFound: "Conflict: Dates not fully available",
        bulkEditTitle: "Process Request", applyToDates: "Approve & Save",
        archive: "Reject / Archive",
        // NEW KEYS
        callMe: "Urgent? Call me at:",
        loginTip: "Tip: Log in to track requests permanently.",
        myRequests: "My Requests",
        statusPending: "Pending", statusApproved: "Approved", statusRejected: "Rejected",
        
        // Response Modal & Msg
        sentTitle: "Request Sent!",
        sentBody: "I'll check it as soon as possible. Check back here for status updates.",
        sentClose: "Sounds good",
        adminResponseLabel: "Reply to User (Optional)",
        adminPlaceholder: "Write a message to the user...",
        adminResponseTitle: "Reply from me:",

        // Tutorial
        tutHeader1: "Check Status",
        tutBody1: "Green means available. Red means busy. Yellow means partially available - contact me.",
        tutHeader2: "Select Dates",
        tutBody2: "Tap days in the calendar to mark them. You can select multiple days.",
        tutHeader3: "Send Request",
        tutBody3: "Fill out your name and message in the menu that appears to send a request.",
        tutNext: "Next",
        tutGotIt: "Got it",
        tutSkip: "Skip"
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
let loadedRequestsCache = {}; 
let currentBulkRequest = null;
let currentTutorialStep = 0;