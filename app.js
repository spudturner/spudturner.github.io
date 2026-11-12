
// ==============================
// MAP INITIALIZATION
// ==============================

const map = L.map("map").setView(
    [39.7392, -104.99],
    10
);

// Load topographic map tiles
L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 17,
        attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
    }
).addTo(map);

// Map variables
let marker = null;
let chart = null;

// Fix map sizing after page loads
window.addEventListener("load", () => {
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
});

// ==============================
// MAP CLICK COORDINATES
// ==============================

map.on("click", (e) => {

    document.getElementById("lat").value =
        e.latlng.lat.toFixed(6);

    document.getElementById("lon").value =
        e.latlng.lng.toFixed(6);

});

// Generate Forecast button
document
    .getElementById("forecastBtn")
    .addEventListener("click", run);


// Use My Location button
document
    .getElementById("locateBtn")
    .addEventListener("click", () => {

        navigator.geolocation.getCurrentPosition(

            (position) => {

                document.getElementById("lat").value =
                    position.coords.latitude.toFixed(6);

                document.getElementById("lon").value =
                    position.coords.longitude.toFixed(6);

                run();
            },

            (error) => {
                alert("Unable to get your location: " + error.message);
            }
        );

    });

async function run() {

    const la = parseFloat(
        document.getElementById("lat").value
    );

    const lo = parseFloat(
        document.getElementById("lon").value
    );

    if (
        !Number.isFinite(la) ||
        !Number.isFinite(lo) ||
        la < -90 || la > 90 ||
        lo < -180 || lo > 180
    ) {
        alert("Enter valid coordinates");
        return;
    }

    try {

        // Remove the previous marker
        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker([la, lo]).addTo(map);
        map.setView([la, lo], 12);

        // Request weather and elevation simultaneously
        const weatherURL =
            `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=mph`;

        const elevationURL =
            `https://api.open-meteo.com/v1/elevation?latitude=${la}&longitude=${lo}`;

        const [weatherResponse, elevationResponse] =
            await Promise.all([
                fetch(weatherURL),
                fetch(elevationURL)
            ]);

        // Check for HTTP errors
        if (!weatherResponse.ok || !elevationResponse.ok) {
            throw new Error("API request failed");
        }

        const weather = await weatherResponse.json();
        const elevationData = await elevationResponse.json();

        if (
            !weather.current ||
            !elevationData.elevation ||
            elevationData.elevation[0] == null
        ) {
            throw new Error("Weather or elevation data unavailable");
        }

        // Convert temperature to Fahrenheit
        const tempF =
            (weather.current.temperature_2m * 9 / 5) + 32;

        const humidity =
            weather.current.relative_humidity_2m;

        const wind =
            weather.current.wind_speed_10m;

        // Convert actual elevation from meters to feet
        const startingElevation =
            elevationData.elevation[0] * 3.28084;

        let html = `
            <h3>Current Conditions</h3>

            <p>
                Temperature: ${tempF.toFixed(1)}°F
                <br>

                Humidity: ${humidity}%
                <br>

                Wind: ${wind} mph
                <br>

                Ground Elevation:
                ${startingElevation.toFixed(0)} ft
            </p>

            <table style="width:100%;">
                <tr>
                    <th>Elevation</th>
                    <th>Temp</th>
                </tr>
        `;

        const chartLabels = [];
        const chartData = [];

        // Generate temperatures at 1,000-foot intervals
        for (
            let elevation = 0;
            elevation <= 12000;
            elevation += 1000
        ) {

            // Calculate elevation difference from starting location
            const elevationDifference =
                elevation - startingElevation;

            // Estimate temperature change:
            // 3.6°F per 1,000 feet
            const forecastTemp =
                tempF - ((elevationDifference / 1000) * 3.6);

            chartLabels.push(elevation.toString());

            chartData.push(
                Number(forecastTemp.toFixed(1))
            );

            html += `
                <tr>
                    <td>${elevation > 0 ? "+" : ""}${elevation} ft</td>
                    <td>${forecastTemp.toFixed(1)} °F</td>
                </tr>
            `;
        }

        html += "</table>";

        html += `
            <p style="font-size: 12px;">
                Elevation data: Open-Meteo / Copernicus DEM
            </p>
        `;

        document.getElementById("results").innerHTML = html;

        // Update chart
        const ctx = document.getElementById("chart");

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx, {
            type: "line",

            data: {
                labels: chartLabels,

                datasets: [{
                    label: "Estimated Temperature by Elevation",
                    data: chartData,
                    borderColor: "red",
                    borderWidth: 3,
                    tension: 0.3
                }]
            },

            options: {
                responsive: true,

                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Elevation (feet)"
                        }
                    },

                    y: {
                        title: {
                            display: true,
                            text: "Temperature (°F)"
                        }
                    }
                }
            }
        });

    }

    catch (error) {

        console.error(error);

        document.getElementById("results").innerHTML = `
            <div style="color:#ff8080">
                Weather or elevation service unavailable.
                <br>
                ${error.message}
            </div>
        `;
    }
}
