const map = L.map('map').setView([39.7392, -104.99], 10);

const topo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
        attribution: 'OpenTopoMap',
        maxZoom: 17
    }
).addTo(map);

const osm = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: 'OpenStreetMap'
    }
);

L.control.layers(
    {
        "Topographic": topo,
        "Street": osm
    }
).addTo(map);

let marker = null;
let chart = null;
let routePoints = [];
let routeLine = null;

map.on("click", (e) => {

    const latVal = e.latlng.lat.toFixed(6);
    const lonVal = e.latlng.lng.toFixed(6);

    document.getElementById("lat").value = latVal;
    document.getElementById("lon").value = lonVal;

    addRoutePoint(e.latlng.lat, e.latlng.lng);
});

document.getElementById("forecastBtn")
    .addEventListener("click", generateForecast);

document.getElementById("clearRoute")
    .addEventListener("click", clearRoute);

document.getElementById("locateBtn")
    .addEventListener("click", () => {

        if (!navigator.geolocation) {
            alert("Geolocation not supported.");
            return;
        }

        navigator.geolocation.getCurrentPosition((position) => {

            document.getElementById("lat").value =
                position.coords.latitude.toFixed(6);

            document.getElementById("lon").value =
                position.coords.longitude.toFixed(6);

            generateForecast();
        });

    });

async function generateForecast() {

    const lat = parseFloat(
        document.getElementById("lat").value
    );

    const lon = parseFloat(
        document.getElementById("lon").value
    );

    if (isNaN(lat) || isNaN(lon)) {
        alert("Enter valid coordinates.");
        return;
    }

    try {

        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker([lat, lon]).addTo(map);

        map.setView([lat, lon], 12);

        const elevResponse =
            await fetch(
                `https://api.opentopodata.org/v1/aster30m?locations=${lat},${lon}`
            );

        const elevData =
            await elevResponse.json();

        const elevationMeters =
            elevData.results?.[0]?.elevation ?? 0;

        const elevationFeet =
            elevationMeters * 3.28084;

        const weatherResponse =
            await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
            );

        const weather =
            await weatherResponse.json();

        const current =
            weather.current;

        const tempC =
            current.temperature_2m;

        const tempF =
            (tempC * 9 / 5) + 32;

        const humidity =
            current.relative_humidity_2m ?? "N/A";

        const wind =
            current.wind_speed_10m ?? "N/A";

        buildForecast(
            tempF,
            elevationFeet,
            humidity,
            wind
        );

    }
    catch (error) {

        console.error(error);

        document.getElementById("results").innerHTML =
            `
            <div style="color:#ff8080;">
            Unable to retrieve weather data.
            Check browser console for details.
            </div>
            `;
    }
}

function buildForecast(
    surfaceTemp,
    groundElevation,
    humidity,
    wind
) {

    const lapseRate = 3.6;

    let html = `
        <h3>Current Conditions</h3>

        <p>
        Elevation: ${groundElevation.toFixed(0)} ft<br>
        Temperature: ${surfaceTemp.toFixed(1)} °F<br>
        Humidity: ${humidity}%<br>
        Wind Speed: ${wind}
        </p>

        <table style="width:100%;">
        <tr>
            <th>Elevation</th>
            <th>Temp</th>
        </tr>
    `;

    const elevations = [];
    const temps = [];

    for (let i = 0; i <= 12000; i += 1000) {

        const elev = groundElevation + i;

        const temp =
            surfaceTemp -
            ((i / 1000) * lapseRate);

        elevations.push(
            elev.toFixed(0)
        );

        temps.push(
            temp.toFixed(1)
        );

        html += `
            <tr>
                <td>${elev.toFixed(0)} ft</td>
                <td>${temp.toFixed(1)} °F</td>
            </tr>
        `;
    }

    html += "</table>";

    document.getElementById("results")
        .innerHTML = html;

    buildChart(
        elevations,
        temps
    );
}

function buildChart(
    elevations,
    temps
) {

    if (chart) {
        chart.destroy();
    }

    const ctx =
        document.getElementById("chart");

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: elevations,
            datasets: [
                {
                    label: "Temperature by Elevation",
                    data: temps,
                    borderColor: "red",
                    borderWidth: 3,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function addRoutePoint(
    lat,
    lon
) {

    routePoints.push([lat, lon]);

    if (routeLine) {
        map.removeLayer(routeLine);
    }

    routeLine =
        L.polyline(routePoints, {
            color: "yellow",
            weight: 4
        }).addTo(map);

    document.getElementById("route")
        .innerHTML =
        `Waypoints: ${routePoints.length}`;
}

function clearRoute() {

    routePoints = [];

    if (routeLine) {
        map.removeLayer(routeLine);
    }

    document.getElementById("route")
        .innerHTML = "";
}
