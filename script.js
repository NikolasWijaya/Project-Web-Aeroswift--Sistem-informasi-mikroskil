
// ==========================================================
// SHARED BOOKING STORAGE (localStorage)
// Used by booking.html to save new bookings, and by
// history.html to list them alongside the existing examples.
// ==========================================================

const BOOKINGS_KEY = "aeroswift_bookings";

const BOOKING_COUNTER_KEY = "aeroswift_booking_counter";

// Sequential IDs continuing on from the existing BK1001 / BK1002 examples
function getNextBookingId(){
    const next = parseInt(localStorage.getItem(BOOKING_COUNTER_KEY) || "1003", 10);
    localStorage.setItem(BOOKING_COUNTER_KEY, String(next + 1));
    return "BK" + next;
}

function formatToday(){
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const d = new Date();
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

function getSavedBookings(){
    try {
        return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || [];
    } catch (e){
        return [];
    }
}

function saveBooking(booking){
    const all = getSavedBookings();
    all.push(booking);
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all));
}

// Full names for the airport codes used across flight.html's results,
// so a link only needs to carry the short code.
const AIRPORT_NAMES = {
    KNO: "Medan, Kualanamu (KNO)",
    DPO: "Bali, Denpasar (DPO)",
    CGK: "Jakarta, Soekarno-Hatta (CGK)",
    YIA: "Yogyakarta, Kulon Progo (YIA)",
    TKG: "Lampung, Radin Inten II (TKG)",
    BPN: "Balikpapan, Sepinggan (BPN)"
};

function airportName(code){
    return AIRPORT_NAMES[code] || code;
}

function formatRupiah(amount){
    return "Rp " + Math.round(amount).toLocaleString("id-ID");
}


// ==========================================================
// BOOKING PAGE (booking.html) — passenger form + ticket modal
// Guarded so this block only runs on the page that has #bookingForm.
// ==========================================================

const form = document.getElementById("bookingForm");

if (form) {

    const modal = document.getElementById("ticketModal");

    const detail = document.getElementById("ticketDetail");

    const stub = document.getElementById("ticketStub");

    const closeBtn = document.getElementById("closeModal");

    const confirmBtn = document.getElementById("confirmTicket");

    // Nicely-labelled seat preference, keyed off the <select> values
    const seatLabels = {
        any: "No Preference",
        window: "Window",
        aisle: "Aisle",
        middle: "Middle"
    };

    // Which flight is being booked — read from the query string that
    // flight.html's "Select Flight" links attach (falls back to the
    // original Batik flight if opened with no params, e.g. a direct visit).
    const flightParams = new URLSearchParams(window.location.search);

    const selectedFlight = {
        airline: flightParams.get("airline") || "Batik Airlines",
        flightNumber: flightParams.get("flightNo") || "BTK-238",
        from: flightParams.get("from") || "KNO",
        to: flightParams.get("to") || "DPO",
        depart: flightParams.get("depart") || "08:00",
        arrive: flightParams.get("arrive") || "11:30",
        basePrice: parseInt(flightParams.get("price"), 10) || 2600000,
        date: "July 19, 2026"
    };

    const taxes = Math.round(selectedFlight.basePrice * 0.10);
    const total = selectedFlight.basePrice + taxes;

    // Fill in the summary sidebar with the selected flight's real numbers
    const summaryAirline = document.getElementById("summaryAirline");
    const summaryRoute = document.getElementById("summaryRoute");
    const summaryDate = document.getElementById("summaryDate");
    const summaryDepart = document.getElementById("summaryDepart");
    const summaryArrive = document.getElementById("summaryArrive");
    const summaryBaseFare = document.getElementById("summaryBaseFare");
    const summaryTaxes = document.getElementById("summaryTaxes");
    const summaryTotal = document.getElementById("summaryTotal");

    if (summaryAirline)  summaryAirline.textContent  = selectedFlight.airline;
    if (summaryRoute)    summaryRoute.textContent    = selectedFlight.from + " → " + selectedFlight.to;
    if (summaryDate)     summaryDate.textContent     = selectedFlight.date;
    if (summaryDepart)   summaryDepart.textContent   = selectedFlight.depart;
    if (summaryArrive)   summaryArrive.textContent   = selectedFlight.arrive;
    if (summaryBaseFare) summaryBaseFare.textContent = formatRupiah(selectedFlight.basePrice);
    if (summaryTaxes)    summaryTaxes.textContent     = formatRupiah(taxes);
    if (summaryTotal)    summaryTotal.textContent     = formatRupiah(total);

    // Holds the current booking's data from the moment the ticket
    // preview is shown until "Confirm" actually saves it.
    let pendingBooking = null;

    form.addEventListener("submit", function(e){

        e.preventDefault();

        const name = document.getElementById("fullName").value;

        const email = document.getElementById("email").value;

        const phone = document.getElementById("phone").value;

        const seat = seatLabels[document.getElementById("seatPref").value] || "No Preference";

        pendingBooking = {
            id: getNextBookingId(),
            passenger: name,
            email: email,
            phone: phone,
            airline: selectedFlight.airline,
            flightNumber: selectedFlight.flightNumber,
            departure: airportName(selectedFlight.from),
            destination: airportName(selectedFlight.to),
            date: selectedFlight.date,
            time: selectedFlight.depart,
            arriveTime: selectedFlight.arrive,
            seat: seat,
            class: "Economy",
            price: formatRupiah(total),
            status: "Confirmed",
            bookedOn: formatToday()
        };

        detail.innerHTML = `
            <div class="ticket-passenger-label">Passenger</div>
            <div class="ticket-passenger-name">${pendingBooking.passenger}</div>

            <div class="ticket-route">
                <div class="ticket-route-block">
                    <div class="ticket-route-code">${selectedFlight.from}</div>
                    <div class="ticket-route-time">${pendingBooking.time}</div>
                </div>
                <div class="ticket-route-line"></div>
                <div class="ticket-route-block">
                    <div class="ticket-route-code">${selectedFlight.to}</div>
                    <div class="ticket-route-time">${pendingBooking.arriveTime}</div>
                </div>
            </div>

            <div class="ticket-grid">
                <div>
                    <div class="ticket-field-label">Flight</div>
                    <div class="ticket-field-value">${pendingBooking.airline}</div>
                </div>
                <div>
                    <div class="ticket-field-label">Date</div>
                    <div class="ticket-field-value">${pendingBooking.date}</div>
                </div>
                <div>
                    <div class="ticket-field-label">Departs</div>
                    <div class="ticket-field-value">${pendingBooking.time}</div>
                </div>
                <div>
                    <div class="ticket-field-label">Arrives</div>
                    <div class="ticket-field-value">${pendingBooking.arriveTime}</div>
                </div>
                <div>
                    <div class="ticket-field-label">Seat</div>
                    <div class="ticket-field-value">${pendingBooking.seat}</div>
                </div>
                <div>
                    <div class="ticket-field-label">Gate</div>
                    <div class="ticket-field-value">B12</div>
                </div>
            </div>

            <div class="ticket-contact">
                <span>✉ ${pendingBooking.email}</span>
                <span>📞 ${pendingBooking.phone}</span>
            </div>
        `;

        stub.innerHTML = `
            <div class="ticket-barcode"></div>
            <div class="ticket-stub-row">
                <div>
                    <div class="ticket-ref-label">Booking Ref</div>
                    <div class="ticket-ref-value">${pendingBooking.id}</div>
                </div>
                <div style="text-align:right">
                    <div class="ticket-total-label">Total</div>
                    <div class="ticket-total-value">${pendingBooking.price}</div>
                </div>
            </div>
        `;

        modal.style.display = "flex";

    });

    closeBtn.addEventListener("click", function(){

        modal.style.display = "none";

    });

    confirmBtn.addEventListener("click", function(){

        // Persist the booking so it shows up in Ticket History, then
        // continue with the existing navigation to history.html.
        if (pendingBooking){
            saveBooking(pendingBooking);
        }

        form.submit();

    });

}


// ==========================================================
// HISTORY PAGE (history.html) — render saved bookings as history
// cards, and drive the shared "View Details" table modal.
// Guarded so this block only runs on the page that has #historyList.
// ==========================================================

const historyList = document.getElementById("historyList");

if (historyList) {

    const detailModal = document.getElementById("detailModal");

    const detailModalClose = document.getElementById("detailModalClose");

    const detailTableBody = document.getElementById("detailTableBody");

    // Same markup/classes as the existing static history cards, just filled in from data
    function historyCardHTML(b){
        return `
            <div class="history-card" style="margin-bottom:1.25rem">
                <div class="history-card-header">
                    <div>
                        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.3rem">
                            <span class="booking-airline">${b.airline}</span>
                            <span class="badge badge-success">✔ ${b.status}</span>
                        </div>
                        <div class="booking-id">Booking ID: ${b.id}</div>
                    </div>
                    <div class="booking-price">${b.price}</div>
                </div>

                <div class="history-card-meta">
                    <div class="meta-item-history">
                        <span class="icon">📍</span>
                        <div>
                            <div class="info-label">Route</div>
                            <div class="info-value">${b.departure} → ${b.destination}</div>
                        </div>
                    </div>
                    <div class="meta-item-history">
                        <span class="icon">📅</span>
                        <div>
                            <div class="info-label">Flight Date</div>
                            <div class="info-value">${b.date}</div>
                        </div>
                    </div>
                    <div class="meta-item-history">
                        <span class="icon">👤</span>
                        <div>
                            <div class="info-label">Passenger</div>
                            <div class="info-value">${b.passenger}</div>
                        </div>
                    </div>
                    <div class="meta-item-history">
                        <span class="icon">🗓</span>
                        <div>
                            <div class="info-label">Booked On</div>
                            <div class="info-value">${b.bookedOn}</div>
                        </div>
                    </div>
                </div>

                <div class="history-card-actions">
                    <button type="button" class="btn btn-primary view-detail-btn"
                        data-id="${b.id}"
                        data-passenger="${b.passenger}"
                        data-airline="${b.airline}"
                        data-flightnumber="${b.flightNumber}"
                        data-departure="${b.departure}"
                        data-destination="${b.destination}"
                        data-date="${b.date}"
                        data-time="${b.time}"
                        data-seat="${b.seat}"
                        data-class="${b.class}"
                        data-price="${b.price}"
                        data-status="${b.status}">👁 View Details</button>
                    <a href="#" class="btn btn-outline">⬇ Download Ticket</a>
                </div>
            </div>
        `;
    }

    // Add one card per saved booking, each inserted at the top — so
    // after looping oldest→newest, the most recent booking ends up
    // above everything else, right where new activity belongs.
    getSavedBookings().forEach(function(b){
        historyList.insertAdjacentHTML("afterbegin", historyCardHTML(b));
    });

    // One shared modal handles "View Details" for every card, whether
    // it's a static example or one just created above.
    historyList.addEventListener("click", function(e){

        const btn = e.target.closest(".view-detail-btn");

        if (!btn) return;

        const d = btn.dataset;

        detailTableBody.innerHTML = `
            <tr><th>Booking ID</th><td>${d.id}</td></tr>
            <tr><th>Passenger Name</th><td>${d.passenger}</td></tr>
            <tr><th>Airline</th><td>${d.airline}</td></tr>
            <tr><th>Flight Number</th><td>${d.flightnumber}</td></tr>
            <tr><th>Departure</th><td>${d.departure}</td></tr>
            <tr><th>Destination</th><td>${d.destination}</td></tr>
            <tr><th>Date</th><td>${d.date}</td></tr>
            <tr><th>Time</th><td>${d.time}</td></tr>
            <tr><th>Seat</th><td>${d.seat}</td></tr>
            <tr><th>Class</th><td>${d.class}</td></tr>
            <tr class="detail-price"><th>Price</th><td>${d.price}</td></tr>
            <tr><th>Booking Status</th><td><span class="badge badge-success">✔ ${d.status}</span></td></tr>
        `;

        detailModal.style.display = "flex";

    });

    detailModalClose.addEventListener("click", function(){

        detailModal.style.display = "none";

    });

    // Click on the dark backdrop (not the card itself) also closes it
    detailModal.addEventListener("click", function(e){

        if (e.target === detailModal){
            detailModal.style.display = "none";
        }

    });

}


// FITUR AGAR NAV DI HAMBURGER TIDAK MUNCUL OTOMATIS KETIKA DI RESIZE SECARA MANUAL
let resizeTimer;
window.addEventListener("resize", () => {

document.body.classList.add("resize-animation-stopper");
clearTimeout(resizeTimer);


resizeTimer = setTimeout(() => {
    document.body.classList.remove("resize-animation-stopper");
}, 400); 
});
