const map = L.map("map").setView([39.7392, -104.99], 10);

L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 17,
        attribution: "© OpenTopoMap"
    }
).addTo(map);

let marker = null;
let chart = null;

map.on("click", (e) => {
    document.getElementById("lat").value =
        e.latlng.lat.toFixed(6);

    document.getElementById("lon").value =
        e.latlng.lng.toFixed(6);
});

document
    .getElementById("forecastBtn")
    .addEventListener("click", run);

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

    if (!Number.isFinite(la) ||
        !Number.isFinite(lo)) {

        alert("Enter valid coordinates");
        return;
    }

    try {

        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker([la, lo])
            .addTo(map);

        map.setView([la, lo], 12);

        const response =
            await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
            );

        const weather =
            await response.json();

        if (!weather.current) {
            throw new Error(
                "Weather data unavailable"
            );
        }

        const tempF =
            (weather.current.temperature_2m * 9 / 5) + 32;

        const humidity =
            weather.current.relative_humidity_2m;

        const wind =
            weather.current.wind_speed_10m;

        // Estimate elevation table relative to surface
        // until a CORS-safe elevation source is added

        const startingElevation = 0;

        let html = `
            <h3>Current Conditions</h3>

            <p>
                Temperature:
                ${tempF.toFixed(1)}°F
                <br>

                Humidity:
                ${humidity}%
                <br>

                Wind:
                ${wind}
            </p>

            <table style="width:100%;">
                <tr>
                    <th>Elevation</th>
                    <th>Temp</th>
                </tr>
        `;

        const chartLabels = [];
        const chartData = [];

        for (
            let elevation = 0;
            elevation <= 12000;
            elevation += 1000
        ) {

            const forecastTemp =
                tempF -
                ((elevation / 1000) * 3.6);

            chartLabels.push(
                elevation.toString()
            );

            chartData.push(
                forecastTemp.toFixed(1)
            );

            html += `
                <tr>
                    <td>${elevation} ft</td>
                    <td>${forecastTemp.toFixed(1)} °F</td>
                </tr>
            `;
        }

        html += "</table>";

        document.getElementById(
            "results"
        ).innerHTML = html;

        const ctx =
            document.getElementById("chart");

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label:
                            "Temperature by Elevation",
                        data: chartData,
                        borderColor: "red",
                        borderWidth: 3,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true
            }
        });

    }
    catch (error) {

        console.error(error);

        document.getElementById(
            "results"
        ).innerHTML =
            `
            <div style="color:#ff8080">
                Weather service unavailable.
            </div>
            `;
    }
}
