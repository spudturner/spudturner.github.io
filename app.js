const map = L.map('map').setView([39.7392, -104.99], 10);

const topo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 17,
        attribution: 'OpenTopoMap'
    }
).addTo(map);

let marker = null;
let chart = null;

map.on('click', e => {
    document.getElementById('lat').value =
        e.latlng.lat.toFixed(6);

    document.getElementById('lon').value =
        e.latlng.lng.toFixed(6);
});

document
    .getElementById('forecastBtn')
    .addEventListener('click', run);

document
    .getElementById('locateBtn')
    .addEventListener('click', () => {

        navigator.geolocation.getCurrentPosition(p => {
            lat.value = p.coords.latitude;
            lon.value = p.coords.longitude;
            run();
        });

    });

async function run() {

    const la = parseFloat(
        document.getElementById('lat').value
    );

    const lo = parseFloat(
        document.getElementById('lon').value
    );

    if (!Number.isFinite(la) ||
        !Number.isFinite(lo)) {

        alert('Enter valid coordinates');
        return;
    }

    try {

        if (marker)
            map.removeLayer(marker);

        marker = L.marker([la, lo])
            .addTo(map);

        map.setView([la, lo], 12);

        // ❌ THIS IS FAILING DUE TO CORS

        const elevFt = 0;
