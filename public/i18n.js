/* Lightweight i18n for Climb Tracker.
   Keys are the German source strings. An observer translates static + dynamically
   rendered text nodes, placeholders and titles that EXACTLY match a dictionary key,
   so user content (route/tour/crag names, notes, usernames) stays untouched. */
(function () {
  const LANGS = ["de", "en", "it"];
  const LABELS = { de: "DE", en: "EN", it: "IT" };

  const EN = {
    // Nav / common
    "Dashboard": "Dashboard", "Community": "Community", "Topos": "Topos", "Mein Profil": "My profile",
    "Logout": "Log out", "Login": "Login", "Registrieren": "Register", "Admin Reset": "Admin reset",
    "Einloggen": "Log in", "Speichern": "Save", "Abbrechen": "Cancel", "Schließen": "Close",
    "Bearbeiten": "Edit", "Hinzufügen": "Add", "Alles klar": "Got it", "Los geht's!": "Let's go!",
    "speichern": "save", "Tour speichern": "Save tour",
    // Placeholders
    "Schreib etwas über dich…": "Write something about yourself…",
    "aktuelles Passwort": "current password", "mind. 3 Zeichen": "at least 3 characters", "mind. 6 Zeichen": "at least 6 characters",
    "z.B. max": "e.g. alex", "z.B. 25": "e.g. 25", "z.B. 12": "e.g. 12", "z.B. 6 h": "e.g. 6 h",
    "z.B. Watzmann Ostwand": "e.g. Watzmann Ostwand", "z.B. Watzmann": "e.g. Watzmann", "z.B. Berchtesgaden": "e.g. Berchtesgaden",
    "z.B. Boulder-Name oder Link aus der Tension-App": "e.g. boulder name or link from the Tension app",
    "Winkel in ° (z.B. 40)": "Angle in ° (e.g. 40)", "Winkel in °": "Angle in °",
    "Besonderheiten Zustieg": "Approach details", "Besonderheiten Abstieg": "Descent details",
    "Felsqualität, Eis-/Schneelage, Steinschlagrisiko …": "Rock quality, ice/snow, rockfall risk …",
    "Taktik-Tipps, Schlüsselstellen, Routenführung …": "Tactics, crux moves, route finding …",
    "Klettergarten hinzufügen": "Add crag", "Halle hinzufügen": "Add gym", "Gebiet / Ort hinzufügen": "Add area / place",
    "Sektor hinzufügen": "Add sector", "Route hinzufügen": "Add route",
    "+ Hinzufügen…": "+ Add…", "+ Partner hinzufügen…": "+ Add partner…",
    // Alerts
    "Gespeichert.": "Saved.", "Konnte nicht angelegt werden.": "Could not be created.",
    "Position gespeichert.": "Position saved.", "Bitte zuerst eine Position auf der Karte setzen.": "Please set a position on the map first.",
    "Bio gespeichert.": "Bio saved.", "Username geändert.": "Username changed.", "Passwort geändert.": "Password changed.",
    "Passwort gesetzt.": "Password set.", "Benutzer zurückgesetzt.": "User reset.", "Fehler beim Löschen": "Error while deleting",
    "Heute schon gedehnt": "Already stretched today", "Fehler beim Speichern": "Error while saving",
    "optional": "optional", "Alle anzeigen →": "Show all →", "← Alle Topos": "← All topos",
    "Ansehen →": "View →", "Profil →": "Profile →", "Mehr Optionen": "More options", "Weniger Optionen": "Fewer options",
    "Lädt…": "Loading…", "Fehler": "Error", "Suchen…": "Search…", "Nichts gefunden.": "Nothing found.",
    "Zu viele Login-Versuche. Bitte in ein paar Minuten erneut versuchen.": "Too many login attempts. Please try again in a few minutes.",
    "Login fehlgeschlagen": "Login failed", "Falscher Benutzername oder falsches Passwort.": "Wrong username or password.",
    // Login / register
    "Willkommen zurück": "Welcome back",
    "Melde dich an, um Dashboard, Ziele und Community zu sehen.": "Log in to see your dashboard, goals and the community.",
    "Username": "Username", "Passwort": "Password", "Eingeloggt bleiben (30 Tage)": "Stay logged in (30 days)",
    "Noch keinen Account?": "No account yet?", "Jetzt registrieren": "Register now", "Info": "Info",
    "Community: Deine Profildaten, Ziele und dein Logbuch sind für alle eingeloggten Nutzer sichtbar. Mit dem Erstellen eines Accounts stimmst du der Speicherung zu.":
      "Community: your profile data, goals and logbook are visible to all logged-in users. By creating an account you agree to this storage.",
    "Account erstellen": "Create account",
    "Erstelle einen Account, um deine Kletterdaten zu speichern.": "Create an account to save your climbing data.",
    "Schon registriert?": "Already registered?", "Zum Login": "To login", "Hinweis": "Note",
    "Deine Einträge, Ziele und Profildaten werden dauerhaft in einer Datenbank gespeichert. Passwörter werden sicher gehasht (nie im Klartext). Mit der Registrierung stimmst du der Speicherung zu.":
      "Your entries, goals and profile data are stored permanently in a database. Passwords are securely hashed (never in plain text). By registering you agree to this storage.",
    "Community: Jeder eingeloggte Nutzer kann Ziele und Logbücher der anderen sehen.":
      "Community: every logged-in user can see the goals and logbooks of others.",
    // Dashboard
    "Diese Woche": "This week", "Platz": "Rank", "Score": "Score", "Lead": "Lead", "Boulder": "Boulder",
    "Eintragen": "Log", "Umgebung": "Environment", "Indoor": "Indoor", "Outdoor": "Outdoor",
    "Disziplin": "Discipline", "Sport": "Sport", "Alpin": "Alpine", "Tension": "Tension", "Modus": "Mode",
    "Toprope": "Toprope", "Schwierigkeit": "Difficulty", "UIAA-Schwierigkeit": "UIAA difficulty",
    "Begehungsart": "Ascent style", "Versuche": "Attempts", "Anzahl": "Count", "Notiz": "Note",
    "Fortschritt": "Progress", "X/Y = geschafft/gesetzt": "X/Y = done/set", "Keine Ziele gesetzt.": "No goals set.",
    "Keine Ziele gesetzt": "No goals set", "{a} von {b} Zielen erreicht": "{a} of {b} goals reached", "Ziele bearbeiten": "Edit goals", "Setze Ziele pro Schwierigkeit": "Set goals per difficulty",
    "Logbuch": "Logbook", "Letzte 50 Einträge": "Last 50 entries", "Noch keine Logbuch-Einträge.": "No logbook entries yet.",
    "Keine Logbuch-Einträge.": "No logbook entries.", "Alle Schwierigkeiten": "All difficulties", "Nur aktive Ziele": "Active goals only",
    "Board-Winkel": "Board angle", "Routenlänge (m)": "Route length (m)", "Express benötigt": "Quickdraws needed",
    "Tension-App: Name / ID / Link": "Tension app: name / ID / link",
    "Halle (mit Tension Board)": "Gym (with Tension Board)", "— wählen —": "— select —", "Halle": "Gym",
    "Klettergarten": "Crag", "Gebiet / Ort": "Area / place", "Sektor": "Sector", "Route": "Route",
    "erst Klettergarten wählen": "select a crag first", "erst Sektor wählen": "select a sector first",
    "Onsight — erster Versuch, kein Beta, keine Vorinformation.": "Onsight — first try, no beta, no prior info.",
    "Flash — erster Versuch mit Beta (Zusehen, Tipps, …).": "Flash — first try with beta (watching, tips, …).",
    "Rotpunkt — sauberer Durchstieg nach mehreren Versuchen.": "Redpoint — clean ascent after several tries.",
    "Pinkpoint — wie RP, aber Expressschlingen waren vorgehängt.": "Pinkpoint — like RP, but the quickdraws were pre-placed.",
    "Onsight — erster Versuch, kein Beta.": "Onsight — first try, no beta.",
    "Flash — erster Versuch mit Beta.": "Flash — first try with beta.",
    "Toprope — durchgestiegen nach mehreren Versuchen.": "Toprope — sent after several tries.",
    // Alpine entry
    "Tourname": "Tour name", "Gipfel": "Summit", "Region": "Region", "Seillängen": "Pitches",
    "Höhenmeter": "Elevation gain", "Datum": "Date", "Zeitaufwand": "Time needed", "Absicherung": "Protection",
    "Trad / selbst absichern": "Trad / self-protected", "Bohrhaken": "Bolts", "Gemischt": "Mixed",
    "Verhältnisse": "Conditions", "Zustieg": "Approach", "Abstieg": "Descent", "Beta": "Beta",
    "Kletterpartner": "Climbing partners", "Ort auf der Karte": "Location on the map", "Position": "Position",
    "Position bearbeiten": "Edit position", "Position speichern": "Save position", "📍 Mein Standort": "📍 My location",
    "Nadel entfernen": "Remove pin",
    // Dehn streak
    "🔥 Dehn Streak": "🔥 Stretch Streak", "Deine tägliche Dehn-Routine.": "Your daily stretching routine.",
    "🔥 Aktueller Streak": "🔥 Current streak", "📅 Längster": "📅 Longest", "🃏 Joker übrig": "🃏 Jokers left",
    "Heute gedehnt!": "Stretched today!", "✅ Heute gedehnt!": "✅ Stretched today!",
    "Dehn Streak einrichten": "Set up Stretch Streak", "Wie viele Joker pro Monat?": "How many jokers per month?",
    "Aktivieren": "Activate", "Deaktiviert.": "Disabled.", "Heute schon gedehnt ✅": "Already stretched today ✅",
    "Heute noch nicht eingecheckt — Einchecken geht im Dashboard.": "Not checked in yet — check in from the dashboard.",
    "Wenn du den Dehn Streak deaktivierst, wird dein aktueller Streak zurückgesetzt. Fortfahren?":
      "Disabling the Stretch Streak resets your current streak. Continue?",
    // Profile
    "Aktivität": "Activity", "Routen pro Tag – letzte 365 Tage": "Routes per day – last 365 days",
    "Mein Account": "My account", "Nur du kannst deinen Namen, dein Passwort oder deinen Account ändern.":
      "Only you can change your name, password or account.", "Name ändern": "Change name",
    "Username muss mind. 3 Zeichen lang sein.": "Username must be at least 3 characters.", "Neuer Username": "New username",
    "Passwort ändern": "Change password", "Neues Passwort mind. 6 Zeichen.": "New password at least 6 characters.",
    "Altes Passwort": "Old password", "Neues Passwort": "New password", "Passwort speichern": "Save password",
    "Account löschen": "Delete account", "Löscht deinen User inkl. Ziele & Logbuch. Nicht rückgängig zu machen.":
      "Deletes your user incl. goals & logbook. Cannot be undone.", "Bio": "Bio", "Öffentlicher Text": "Public text",
    "Keine Bio gesetzt.": "No bio set.", "Deine Bio": "Your bio", "Bio speichern": "Save bio",
    "Ziele": "Goals", "Öffentliche Ziele dieses Nutzers": "This user's public goals", "Keine Ziele.": "No goals.",
    "Letzte 50 Einträge (inkl. Umgebung Indoor/Outdoor)": "Last 50 entries (incl. indoor/outdoor)",
    "IP-Adressen": "IP addresses", "Nur für Admins sichtbar. Für den Nutzer unsichtbar.": "Admin-only. Invisible to the user.",
    "Admin Aktionen": "Admin actions", "Fortschritt": "Progress",
    "Diese Aktionen betreffen den ausgewählten Benutzer.": "These actions affect the selected user.",
    "Benutzer zurücksetzen": "Reset user", "Löscht Ziele + Logbuch dieses Benutzers.": "Deletes this user's goals + logbook.",
    "User Reset": "Reset user", "Passwort setzen": "Set password", "Setzt ein neues Passwort für diesen Benutzer.": "Sets a new password for this user.",
    "Username ändern": "Change username", "Ändert den Namen dieses Benutzers.": "Changes this user's name.", "Umbenennen": "Rename",
    "Benutzer löschen": "Delete user", "User löschen": "Delete user",
    "Löscht den Benutzer inkl. Ziele & Logbuch. Nicht rückgängig zu machen.": "Deletes the user incl. goals & logbook. Cannot be undone.",
    "Noch keine Position. Klicke „Position bearbeiten“ und tippe auf die Karte.": "No position yet. Click “Edit position” and tap the map.",
    "Noch keine Position gesetzt.": "No position set yet.",
    "Tippe auf die Karte, um die Nadel zu setzen (oder ziehe sie).": "Tap the map to place the pin (or drag it).",
    // Community
    "Leaderboard": "Leaderboard", "Alle Nutzer": "All users", "Woche ab:": "Week from:",
    "Klicke auf einen Nutzer, um Profil, Ziele und Logbuch zu sehen.": "Click a user to see their profile, goals and logbook.",
    "Keine Daten diese Woche.": "No data this week.", "Keine Nutzer gefunden.": "No users found.", "Keine Einträge": "No entries",
    // Topo
    "Alle bekannten Klettergärten, Sektoren, Routen und Alpin-Touren – inkl. Länge, Bemerkungen und Karte.":
      "All known crags, sectors, routes and alpine tours – incl. length, remarks and map.",
    "Klettergärten": "Crags", "Boulder-Gebiete": "Boulder areas", "Hallen": "Gyms", "Alpin-Touren": "Alpine tours",
    "Sektoren & Routen": "Sectors & routes", "Noch keine Sektoren/Routen erfasst.": "No sectors/routes yet.",
    "Keine Routen.": "No routes.", "Tension Board": "Tension Board", "Tension Board vorhanden": "Tension Board available",
    "Variabler Winkel (verstellbares Board)": "Variable angle (adjustable board)",
    "Gibt es in dieser Halle ein Tension Board? Dann kann man beim Loggen die Halle wählen und der Winkel wird automatisch gesetzt.":
      "Does this gym have a Tension Board? Then you can pick the gym when logging and the angle is set automatically.",
    "Infos": "Info", "Schwierigkeit": "Difficulty", "Begehungen": "Ascents", "Wer diese Tour bereits eingetragen hat.":
      "Who has already logged this tour.", "Ersteintrag": "First logger", "Noch keine Begehungen erfasst.": "No ascents yet.",
    "Tour nicht gefunden.": "Tour not found.", "Klettergarten nicht gefunden.": "Crag not found.",
    "Bekannte Position dieses Klettergartens.": "Known position of this crag.",
    // Logs page
    "Alle Einträge": "All entries", "Details ▾": "Details ▾", "Details ▴": "Details ▴", "Partner": "Partners",
    // Onboarding / patch notes
    "Willkommen bei Climb Tracker! 🧗": "Welcome to Climb Tracker! 🧗", "Kurz das Wichtigste:": "The essentials:",
    "Deine Daten werden dauerhaft gespeichert.": "Your data is stored permanently.", "Neue Features ✨": "New features ✨",
    "Was seit deinem letzten Besuch dazugekommen ist:": "What's new since your last visit:",
    "<strong>Eintragen:</strong> Logge Begehungen Schritt für Schritt — Indoor/Outdoor, Sport, Boulder, Alpin und <strong>Tension Board</strong>.":
      "<strong>Log:</strong> Log ascents step by step — indoor/outdoor, sport, boulder, alpine and <strong>Tension Board</strong>.",
    "<strong>Diese Woche:</strong> Ein wöchentliches Leaderboard bewertet deine Begehungen nach Schwierigkeit.":
      "<strong>This week:</strong> A weekly leaderboard rates your ascents by difficulty.",
    "<strong>Topos:</strong> Durchstöbere Klettergärten, Sektoren und Routen inkl. Karte.":
      "<strong>Topos:</strong> Browse crags, sectors and routes incl. a map.",
    "<strong>Dehn Streak:</strong> Optionaler täglicher Dehn-Streak mit Joker-System — im <em>Profil</em> aktivieren, täglich im Dashboard einchecken.":
      "<strong>Stretch Streak:</strong> Optional daily stretching streak with a joker system — enable it in your <em>profile</em>, check in daily on the dashboard.",
    "<strong>Profil & Community:</strong> Ziele setzen, Aktivität sehen; Profile aller Nutzer sind einsehbar.":
      "<strong>Profile & community:</strong> Set goals, see activity; all users' profiles are visible.",
    "Tension Board, Topos & Dehn Streak": "Tension Board, Topos & Stretch Streak",
    "Tension-Board-Boulder loggen — mit Board-Winkel und kombiniertem French/V-Grad (z. B. 6b/V4).":
      "Log Tension Board boulders — with board angle and combined French/V grade (e.g. 6b/V4).",
    "In den Topos kannst du bei einer Halle das Tension Board aktivieren und den Winkel hinterlegen. Beim Loggen wird der Winkel dann automatisch gesetzt.":
      "In the Topos you can flag a gym's Tension Board and store the angle. When logging, the angle is then set automatically.",
    "Dehn Streak: täglicher Dehn-Streak mit Joker-System — im Profil aktivieren, täglich im Dashboard einchecken.":
      "Stretch Streak: daily stretching streak with a joker system — enable it in your profile, check in daily on the dashboard.",
    "Topos: durchsuchbare Übersicht aller Klettergärten, Sektoren und Routen inkl. Karte pro Ort.":
      "Topos: searchable overview of all crags, sectors and routes incl. a map per place."
  };

  const IT = {
    "Dashboard": "Dashboard", "Community": "Community", "Topos": "Topo", "Mein Profil": "Il mio profilo",
    "Logout": "Esci", "Login": "Accedi", "Registrieren": "Registrati", "Admin Reset": "Reset admin",
    "Einloggen": "Accedi", "Speichern": "Salva", "Abbrechen": "Annulla", "Schließen": "Chiudi",
    "Bearbeiten": "Modifica", "Hinzufügen": "Aggiungi", "Alles klar": "Ok", "Los geht's!": "Iniziamo!",
    "speichern": "salva", "Tour speichern": "Salva tour",
    "Schreib etwas über dich…": "Scrivi qualcosa su di te…",
    "aktuelles Passwort": "password attuale", "mind. 3 Zeichen": "almeno 3 caratteri", "mind. 6 Zeichen": "almeno 6 caratteri",
    "z.B. max": "es. alex", "z.B. 25": "es. 25", "z.B. 12": "es. 12", "z.B. 6 h": "es. 6 h",
    "z.B. Watzmann Ostwand": "es. Watzmann Ostwand", "z.B. Watzmann": "es. Watzmann", "z.B. Berchtesgaden": "es. Berchtesgaden",
    "z.B. Boulder-Name oder Link aus der Tension-App": "es. nome boulder o link dall'app Tension",
    "Winkel in ° (z.B. 40)": "Angolo in ° (es. 40)", "Winkel in °": "Angolo in °",
    "Besonderheiten Zustieg": "Dettagli avvicinamento", "Besonderheiten Abstieg": "Dettagli discesa",
    "Felsqualität, Eis-/Schneelage, Steinschlagrisiko …": "Qualità roccia, neve/ghiaccio, rischio caduta sassi …",
    "Taktik-Tipps, Schlüsselstellen, Routenführung …": "Tattica, passaggi chiave, linea …",
    "Klettergarten hinzufügen": "Aggiungi falesia", "Halle hinzufügen": "Aggiungi palestra", "Gebiet / Ort hinzufügen": "Aggiungi zona / luogo",
    "Sektor hinzufügen": "Aggiungi settore", "Route hinzufügen": "Aggiungi via",
    "+ Hinzufügen…": "+ Aggiungi…", "+ Partner hinzufügen…": "+ Aggiungi compagno…",
    "Gespeichert.": "Salvato.", "Konnte nicht angelegt werden.": "Impossibile creare.",
    "Position gespeichert.": "Posizione salvata.", "Bitte zuerst eine Position auf der Karte setzen.": "Imposta prima una posizione sulla mappa.",
    "Bio gespeichert.": "Bio salvata.", "Username geändert.": "Nome utente modificato.", "Passwort geändert.": "Password modificata.",
    "Passwort gesetzt.": "Password impostata.", "Benutzer zurückgesetzt.": "Utente reimpostato.", "Fehler beim Löschen": "Errore durante l'eliminazione",
    "Heute schon gedehnt": "Stretching già fatto oggi", "Fehler beim Speichern": "Errore durante il salvataggio",
    "optional": "opzionale", "Alle anzeigen →": "Mostra tutti →", "← Alle Topos": "← Tutti i topo",
    "Ansehen →": "Vedi →", "Profil →": "Profilo →", "Mehr Optionen": "Più opzioni", "Weniger Optionen": "Meno opzioni",
    "Lädt…": "Caricamento…", "Fehler": "Errore", "Suchen…": "Cerca…", "Nichts gefunden.": "Nessun risultato.",
    "Zu viele Login-Versuche. Bitte in ein paar Minuten erneut versuchen.": "Troppi tentativi di accesso. Riprova tra qualche minuto.",
    "Login fehlgeschlagen": "Accesso non riuscito", "Falscher Benutzername oder falsches Passwort.": "Nome utente o password errati.",
    "Willkommen zurück": "Bentornato",
    "Melde dich an, um Dashboard, Ziele und Community zu sehen.": "Accedi per vedere dashboard, obiettivi e community.",
    "Username": "Nome utente", "Passwort": "Password", "Eingeloggt bleiben (30 Tage)": "Resta connesso (30 giorni)",
    "Noch keinen Account?": "Non hai un account?", "Jetzt registrieren": "Registrati ora", "Info": "Info",
    "Community: Deine Profildaten, Ziele und dein Logbuch sind für alle eingeloggten Nutzer sichtbar. Mit dem Erstellen eines Accounts stimmst du der Speicherung zu.":
      "Community: i dati del profilo, gli obiettivi e il diario sono visibili a tutti gli utenti registrati. Creando un account accetti questa memorizzazione.",
    "Account erstellen": "Crea account",
    "Erstelle einen Account, um deine Kletterdaten zu speichern.": "Crea un account per salvare i tuoi dati di arrampicata.",
    "Schon registriert?": "Già registrato?", "Zum Login": "Vai al login", "Hinweis": "Avviso",
    "Deine Einträge, Ziele und Profildaten werden dauerhaft in einer Datenbank gespeichert. Passwörter werden sicher gehasht (nie im Klartext). Mit der Registrierung stimmst du der Speicherung zu.":
      "Le tue voci, gli obiettivi e i dati del profilo vengono salvati in modo permanente in un database. Le password sono cifrate in modo sicuro (mai in chiaro). Registrandoti accetti questa memorizzazione.",
    "Community: Jeder eingeloggte Nutzer kann Ziele und Logbücher der anderen sehen.":
      "Community: ogni utente registrato può vedere gli obiettivi e i diari degli altri.",
    "Diese Woche": "Questa settimana", "Platz": "Posizione", "Score": "Punteggio", "Lead": "Lead", "Boulder": "Boulder",
    "Eintragen": "Registra", "Umgebung": "Ambiente", "Indoor": "Indoor", "Outdoor": "Outdoor",
    "Disziplin": "Disciplina", "Sport": "Sport", "Alpin": "Alpinismo", "Tension": "Tension", "Modus": "Modalità",
    "Toprope": "Moulinette", "Schwierigkeit": "Difficoltà", "UIAA-Schwierigkeit": "Difficoltà UIAA",
    "Begehungsart": "Stile di salita", "Versuche": "Tentativi", "Anzahl": "Quantità", "Notiz": "Nota",
    "Fortschritt": "Progresso", "X/Y = geschafft/gesetzt": "X/Y = fatti/impostati", "Keine Ziele gesetzt.": "Nessun obiettivo impostato.",
    "Keine Ziele gesetzt": "Nessun obiettivo impostato", "{a} von {b} Zielen erreicht": "{a} di {b} obiettivi raggiunti", "Ziele bearbeiten": "Modifica obiettivi", "Setze Ziele pro Schwierigkeit": "Imposta obiettivi per difficoltà",
    "Logbuch": "Diario", "Letzte 50 Einträge": "Ultime 50 voci", "Noch keine Logbuch-Einträge.": "Ancora nessuna voce nel diario.",
    "Keine Logbuch-Einträge.": "Nessuna voce nel diario.", "Alle Schwierigkeiten": "Tutte le difficoltà", "Nur aktive Ziele": "Solo obiettivi attivi",
    "Board-Winkel": "Angolo del board", "Routenlänge (m)": "Lunghezza via (m)", "Express benötigt": "Rinvii necessari",
    "Tension-App: Name / ID / Link": "App Tension: nome / ID / link",
    "Halle (mit Tension Board)": "Palestra (con Tension Board)", "— wählen —": "— seleziona —", "Halle": "Palestra",
    "Klettergarten": "Falesia", "Gebiet / Ort": "Zona / luogo", "Sektor": "Settore", "Route": "Via",
    "erst Klettergarten wählen": "seleziona prima una falesia", "erst Sektor wählen": "seleziona prima un settore",
    "Onsight — erster Versuch, kein Beta, keine Vorinformation.": "Onsight — primo tentativo, senza beta né informazioni.",
    "Flash — erster Versuch mit Beta (Zusehen, Tipps, …).": "Flash — primo tentativo con beta (osservare, consigli, …).",
    "Rotpunkt — sauberer Durchstieg nach mehreren Versuchen.": "Rotpunkt — salita pulita dopo vari tentativi.",
    "Pinkpoint — wie RP, aber Expressschlingen waren vorgehängt.": "Pinkpoint — come RP, ma i rinvii erano già posizionati.",
    "Onsight — erster Versuch, kein Beta.": "Onsight — primo tentativo, senza beta.",
    "Flash — erster Versuch mit Beta.": "Flash — primo tentativo con beta.",
    "Toprope — durchgestiegen nach mehreren Versuchen.": "Moulinette — salita dopo vari tentativi.",
    "Tourname": "Nome tour", "Gipfel": "Cima", "Region": "Regione", "Seillängen": "Tiri",
    "Höhenmeter": "Dislivello", "Datum": "Data", "Zeitaufwand": "Tempo impiegato", "Absicherung": "Protezione",
    "Trad / selbst absichern": "Trad / autoprotezione", "Bohrhaken": "Spit", "Gemischt": "Misto",
    "Verhältnisse": "Condizioni", "Zustieg": "Avvicinamento", "Abstieg": "Discesa", "Beta": "Beta",
    "Kletterpartner": "Compagni di cordata", "Ort auf der Karte": "Luogo sulla mappa", "Position": "Posizione",
    "Position bearbeiten": "Modifica posizione", "Position speichern": "Salva posizione", "📍 Mein Standort": "📍 La mia posizione",
    "Nadel entfernen": "Rimuovi segnaposto",
    "🔥 Dehn Streak": "🔥 Stretch Streak", "Deine tägliche Dehn-Routine.": "La tua routine di stretching quotidiana.",
    "🔥 Aktueller Streak": "🔥 Serie attuale", "📅 Längster": "📅 Più lunga", "🃏 Joker übrig": "🃏 Jolly rimasti",
    "Heute gedehnt!": "Stretching fatto oggi!", "✅ Heute gedehnt!": "✅ Stretching fatto oggi!",
    "Dehn Streak einrichten": "Configura Stretch Streak", "Wie viele Joker pro Monat?": "Quanti jolly al mese?",
    "Aktivieren": "Attiva", "Deaktiviert.": "Disattivato.", "Heute schon gedehnt ✅": "Stretching già fatto oggi ✅",
    "Heute noch nicht eingecheckt — Einchecken geht im Dashboard.": "Non ancora registrato oggi — registra dalla dashboard.",
    "Wenn du den Dehn Streak deaktivierst, wird dein aktueller Streak zurückgesetzt. Fortfahren?":
      "Disattivando lo Stretch Streak la serie attuale verrà azzerata. Continuare?",
    "Aktivität": "Attività", "Routen pro Tag – letzte 365 Tage": "Vie al giorno – ultimi 365 giorni",
    "Mein Account": "Il mio account", "Nur du kannst deinen Namen, dein Passwort oder deinen Account ändern.":
      "Solo tu puoi cambiare nome, password o account.", "Name ändern": "Cambia nome",
    "Username muss mind. 3 Zeichen lang sein.": "Il nome utente deve avere almeno 3 caratteri.", "Neuer Username": "Nuovo nome utente",
    "Passwort ändern": "Cambia password", "Neues Passwort mind. 6 Zeichen.": "Nuova password almeno 6 caratteri.",
    "Altes Passwort": "Vecchia password", "Neues Passwort": "Nuova password", "Passwort speichern": "Salva password",
    "Account löschen": "Elimina account", "Löscht deinen User inkl. Ziele & Logbuch. Nicht rückgängig zu machen.":
      "Elimina il tuo utente con obiettivi e diario. Non annullabile.", "Bio": "Bio", "Öffentlicher Text": "Testo pubblico",
    "Keine Bio gesetzt.": "Nessuna bio impostata.", "Deine Bio": "La tua bio", "Bio speichern": "Salva bio",
    "Ziele": "Obiettivi", "Öffentliche Ziele dieses Nutzers": "Obiettivi pubblici di questo utente", "Keine Ziele.": "Nessun obiettivo.",
    "Letzte 50 Einträge (inkl. Umgebung Indoor/Outdoor)": "Ultime 50 voci (incl. indoor/outdoor)",
    "IP-Adressen": "Indirizzi IP", "Nur für Admins sichtbar. Für den Nutzer unsichtbar.": "Solo per admin. Invisibile all'utente.",
    "Admin Aktionen": "Azioni admin",
    "Diese Aktionen betreffen den ausgewählten Benutzer.": "Queste azioni riguardano l'utente selezionato.",
    "Benutzer zurücksetzen": "Reimposta utente", "Löscht Ziele + Logbuch dieses Benutzers.": "Elimina obiettivi + diario di questo utente.",
    "User Reset": "Reimposta utente", "Passwort setzen": "Imposta password", "Setzt ein neues Passwort für diesen Benutzer.": "Imposta una nuova password per questo utente.",
    "Username ändern": "Cambia nome utente", "Ändert den Namen dieses Benutzers.": "Modifica il nome di questo utente.", "Umbenennen": "Rinomina",
    "Benutzer löschen": "Elimina utente", "User löschen": "Elimina utente",
    "Löscht den Benutzer inkl. Ziele & Logbuch. Nicht rückgängig zu machen.": "Elimina l'utente con obiettivi e diario. Non annullabile.",
    "Noch keine Position. Klicke „Position bearbeiten“ und tippe auf die Karte.": "Nessuna posizione. Clicca “Modifica posizione” e tocca la mappa.",
    "Noch keine Position gesetzt.": "Nessuna posizione impostata.",
    "Tippe auf die Karte, um die Nadel zu setzen (oder ziehe sie).": "Tocca la mappa per posizionare il segnaposto (o trascinalo).",
    "Leaderboard": "Classifica", "Alle Nutzer": "Tutti gli utenti", "Woche ab:": "Settimana dal:",
    "Klicke auf einen Nutzer, um Profil, Ziele und Logbuch zu sehen.": "Clicca su un utente per vedere profilo, obiettivi e diario.",
    "Keine Daten diese Woche.": "Nessun dato questa settimana.", "Keine Nutzer gefunden.": "Nessun utente trovato.", "Keine Einträge": "Nessuna voce",
    "Alle bekannten Klettergärten, Sektoren, Routen und Alpin-Touren – inkl. Länge, Bemerkungen und Karte.":
      "Tutte le falesie, i settori, le vie e i tour alpinistici noti – incl. lunghezza, note e mappa.",
    "Klettergärten": "Falesie", "Boulder-Gebiete": "Zone boulder", "Hallen": "Palestre", "Alpin-Touren": "Tour alpinistici",
    "Sektoren & Routen": "Settori e vie", "Noch keine Sektoren/Routen erfasst.": "Ancora nessun settore/via.",
    "Keine Routen.": "Nessuna via.", "Tension Board": "Tension Board", "Tension Board vorhanden": "Tension Board disponibile",
    "Variabler Winkel (verstellbares Board)": "Angolo variabile (board regolabile)",
    "Gibt es in dieser Halle ein Tension Board? Dann kann man beim Loggen die Halle wählen und der Winkel wird automatisch gesetzt.":
      "C'è un Tension Board in questa palestra? Così puoi scegliere la palestra e l'angolo viene impostato automaticamente.",
    "Infos": "Info", "Begehungen": "Salite", "Wer diese Tour bereits eingetragen hat.": "Chi ha già registrato questo tour.",
    "Ersteintrag": "Prima voce", "Noch keine Begehungen erfasst.": "Ancora nessuna salita.",
    "Tour nicht gefunden.": "Tour non trovato.", "Klettergarten nicht gefunden.": "Falesia non trovata.",
    "Bekannte Position dieses Klettergartens.": "Posizione nota di questa falesia.",
    "Alle Einträge": "Tutte le voci", "Partner": "Compagni",
    "Willkommen bei Climb Tracker! 🧗": "Benvenuto su Climb Tracker! 🧗", "Kurz das Wichtigste:": "In breve l'essenziale:",
    "Deine Daten werden dauerhaft gespeichert.": "I tuoi dati vengono salvati in modo permanente.", "Neue Features ✨": "Nuove funzioni ✨",
    "Was seit deinem letzten Besuch dazugekommen ist:": "Cosa è stato aggiunto dall'ultima visita:",
    "<strong>Eintragen:</strong> Logge Begehungen Schritt für Schritt — Indoor/Outdoor, Sport, Boulder, Alpin und <strong>Tension Board</strong>.":
      "<strong>Registra:</strong> registra le salite passo dopo passo — indoor/outdoor, sport, boulder, alpinismo e <strong>Tension Board</strong>.",
    "<strong>Diese Woche:</strong> Ein wöchentliches Leaderboard bewertet deine Begehungen nach Schwierigkeit.":
      "<strong>Questa settimana:</strong> una classifica settimanale valuta le tue salite per difficoltà.",
    "<strong>Topos:</strong> Durchstöbere Klettergärten, Sektoren und Routen inkl. Karte.":
      "<strong>Topo:</strong> esplora falesie, settori e vie, mappa inclusa.",
    "<strong>Dehn Streak:</strong> Optionaler täglicher Dehn-Streak mit Joker-System — im <em>Profil</em> aktivieren, täglich im Dashboard einchecken.":
      "<strong>Stretch Streak:</strong> serie di stretching giornaliera opzionale con sistema di jolly — attivala nel <em>profilo</em>, registra ogni giorno dalla dashboard.",
    "<strong>Profil & Community:</strong> Ziele setzen, Aktivität sehen; Profile aller Nutzer sind einsehbar.":
      "<strong>Profilo & community:</strong> imposta obiettivi, vedi l'attività; i profili di tutti gli utenti sono visibili.",
    "Tension Board, Topos & Dehn Streak": "Tension Board, Topo & Stretch Streak",
    "Tension-Board-Boulder loggen — mit Board-Winkel und kombiniertem French/V-Grad (z. B. 6b/V4).":
      "Registra boulder su Tension Board — con angolo del board e grado combinato French/V (es. 6b/V4).",
    "In den Topos kannst du bei einer Halle das Tension Board aktivieren und den Winkel hinterlegen. Beim Loggen wird der Winkel dann automatisch gesetzt.":
      "Nei Topo puoi attivare il Tension Board di una palestra e salvare l'angolo. Durante la registrazione l'angolo viene impostato automaticamente.",
    "Dehn Streak: täglicher Dehn-Streak mit Joker-System — im Profil aktivieren, täglich im Dashboard einchecken.":
      "Stretch Streak: serie di stretching giornaliera con sistema di jolly — attivala nel profilo, registra ogni giorno dalla dashboard.",
    "Topos: durchsuchbare Übersicht aller Klettergärten, Sektoren und Routen inkl. Karte pro Ort.":
      "Topo: panoramica ricercabile di tutte le falesie, i settori e le vie, con mappa per ogni luogo."
  };

  const DICT = { en: EN, it: IT };

  function getLang() { try { return localStorage.getItem("ct_lang") || "de"; } catch { return "de"; } }
  function setLang(l) { try { localStorage.setItem("ct_lang", l); } catch (e) {} location.reload(); }
  const LANG = getLang();
  const MAP = DICT[LANG] || null;

  // expose a helper for scripts that want explicit translation
  window.t = function (s) { return (MAP && MAP[s] != null) ? MAP[s] : s; };

  // Translate alert() messages (alerts aren't part of the DOM, so the observer can't catch them)
  const _alert = window.alert.bind(window);
  window.alert = function (m) { const k = String(m).trim(); _alert(MAP && MAP[k] != null ? MAP[k] : m); };

  function trText(node) {
    const v = node.nodeValue;
    if (!v) return;
    const k = v.trim();
    if (!k || MAP[k] == null) return;
    node.nodeValue = v.replace(k, MAP[k]);
  }
  function trAttrs(el) {
    if (el.nodeType !== 1) return;
    ["placeholder", "title"].forEach(a => {
      if (el.hasAttribute && el.hasAttribute(a)) {
        const k = el.getAttribute(a).trim();
        if (MAP[k] != null) el.setAttribute(a, MAP[k]);
      }
    });
  }
  function walk(root) {
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1) return;
    trAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = []; let n; while ((n = tw.nextNode())) texts.push(n);
    texts.forEach(trText);
    root.querySelectorAll && root.querySelectorAll("[placeholder],[title]").forEach(trAttrs);
  }

  function buildSwitcher() {
    const sel = document.createElement("select");
    sel.className = "lang-select";
    sel.setAttribute("aria-label", "Language");
    sel.innerHTML = LANGS.map(l => `<option value="${l}"${l === LANG ? " selected" : ""}>${LABELS[l]}</option>`).join("");
    sel.addEventListener("change", () => setLang(sel.value));
    const nav = document.querySelector(".topbar .nav") || document.querySelector(".topbar");
    if (nav) nav.appendChild(sel);
    else { sel.style.cssText = "position:fixed;top:10px;right:10px;z-index:60;width:auto;"; document.body.appendChild(sel); }
  }

  function start() {
    buildSwitcher();
    if (!MAP) return; // German: nothing to translate
    walk(document.body);
    const obs = new MutationObserver(muts => {
      for (const mu of muts) mu.addedNodes.forEach(node => {
        if (node.nodeType === 3) trText(node);
        else if (node.nodeType === 1) walk(node);
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
