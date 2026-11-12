
document.addEventListener("DOMContentLoaded", () => {

    // ==============================
    // ELEMENTS
    // ==============================

    const latInput = document.getElementById("lat");
    const lonInput = document.getElementById("lon");
    const forecastBtn = document.getElementById("forecastBtn");
    const locateBtn = document.getElementById("locateBtn");
    const results = document.getElementById("results");
    const chartCanvas = document.getElementById("chart");
    const routeContainer = document.getElementById("route");
    const clearRouteBtn = document.getElementById("clearRoute");

    // Check required HTML elements
    if (
        !latInput ||
        !lonInput ||
        !forecastBtn ||
        !locateBtn ||
        !results ||
        !chartCanvas
    ) {
        console.error("Missing required HTML elements.");
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet did not load.");
        return;
    }


    // ==============================
    // MAP INITIALIZATION
    // ==============================

    const map = L.map("map", {
        zoomControl: true
    }).setView([39.7392, -104.99], 10);

    const tileLayer = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,
            attribution:
                '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
        }
    );

    tileLayer.addTo(map);

    tileLayer.on("tileerror", (event) => {
        console.error("Map tile failed to load:", event);
    });


    // ==============================
    // VARIABLES
    // ==============================

    let marker = null;
    let chart = null;
    let forecastRequest = 0;


    // ==============================
    // MAP RESIZING
    // ==============================

    function resizeMap() {
        map.invalidateSize({ pan: false });
    }

    window.addEventListener("load", resizeMap);
    window.addEventListener("resize", resizeMap);

    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            resizeMap();
        });

        observer.observe(document.getElementById("map"));
    }

    map.whenReady(() => {
        setTimeout(resizeMap, 250);
    });


    // ==============================
    // MARKER FUNCTION
    // ==============================

    function setMarker(lat, lon) {

        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker([lat, lon]).addTo(map);

        marker.bindPopup(`
            <strong>Selected Location</strong><br>
            Latitude: ${lat.toFixed(6)}<br>
            Longitude: ${lon.toFixed(6)}
        `);
    }


    // ==============================
    // MAP CLICK COORDINATES
    // ==============================

    map.on("click", (event) => {

        const lat = event.latlng.lat;
        const lon = event.latlng.lng;

        // Populate coordinate inputs
        latInput.value = lat.toFixed(6);
        lonInput.value = lon.toFixed(6);

        // Place marker at selected location
        setMarker(lat, lon);

        // Show selected coordinates
        if (results) {
            results.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⛰</span>
                    <h3>Location Selected</h3>
                    <p>
                        Latitude: ${lat.toFixed(6)}<br>
                        Longitude: ${lon.toFixed(6)}
                    </p>
                    <p>Press Generate Forecast to continue.</p>
                </div>
            `;
        }

        console.log("Map clicked:", lat, lon);

    });


    // ==============================
    // WEATHER FORECAST
    // ==============================

    async function run() {

        const la = parseFloat(latInput.value);
        const lo = parseFloat(lonInput.value);

        // Validate coordinates
        if (
            !Number.isFinite(la) ||
            !Number.isFinite(lo) ||
            la < -90 ||
            la > 90 ||
            lo < -180 ||
            lo > 180
        ) {
            alert("Enter valid coordinates.");
            return;
        }

        const requestId = ++forecastRequest;

        try {

            forecastBtn.disabled = true;
            forecastBtn.textContent = "Loading Forecast...";

            // Update map marker
            setMarker(la, lo);
            map.setView([la, lo], 12);

            // API URLs
            const weatherURL =
                `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=mph`;

            const elevationURL =
                `https://api.open-meteo.com/v1/elevation?latitude=${la}&longitude=${lo}`;

            // Fetch both APIs simultaneously
            const [weatherResponse, elevationResponse] =
                await Promise.all([
                    fetch(weatherURL),
                    fetch(elevationURL)
                ]);

            if (!weatherResponse.ok) {
                throw new Error("Weather API request failed.");
            }

            if (!elevationResponse.ok) {
                throw new Error("Elevation API request failed.");
            }

            const weather = await weatherResponse.json();
            const elevationData = await elevationResponse.json();

            // Prevent an older request overwriting newer results
            if (requestId !== forecastRequest) {
                return;
            }

            // Validate API responses
            if (
                !weather.current ||
                !Number.isFinite(elevationData.elevation?.[0])
            ) {
                throw new Error("Weather or elevation data unavailable.");
            }


            // ==============================
            // WEATHER DATA
            // ==============================

            const tempF =
                (weather.current.temperature_2m * 9 / 5) + 32;

            const humidity =
                weather.current.relative_humidity_2m;

            const wind =
                weather.current.wind_speed_10m;

            // Convert meters to feet
            const startingElevation =
                elevationData.elevation[0] * 3.28084;


            // ==============================
            // RESULTS HTML
            // ==============================

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
                        <th>Elevation Gain</th>
                        <th>Estimated Temp</th>
                    </tr>
            `;


            // ==============================
            // ELEVATION CALCULATIONS
            // ==============================

            const chartLabels = [];
            const chartData = [];

            for (
                let elevation = 0;
                elevation <= 12000;
                elevation += 1000
            ) {

                // Temperature decreases with elevation gain
                const forecastTemp =
                    tempF - ((elevation / 1000) * 3.6);

                const label =
                    elevation > 0
                        ? `+${elevation.toLocaleString()}`
                        : "0";

                chartLabels.push(label);

                chartData.push(
                    Number(forecastTemp.toFixed(1))
                );

                html += `
                    <tr>
                        <td>${label} ft</td>
                        <td>${forecastTemp.toFixed(1)} °F</td>
                    </tr>
                `;
            }

            html += "</table>";

            html += `
                <p style="font-size:12px;">
                    Ground elevation: Copernicus DEM via Open-Meteo.
                    <br>
                    Temperature changes are estimates, not mountain forecasts.
                </p>
            `;

            results.innerHTML = html;


            // ==============================
            // TEMPERATURE CHART
            // ==============================

            if (typeof Chart === "undefined") {
                throw new Error("Chart.js did not load.");
            }

            if (chart) {
                chart.destroy();
            }

            chart = new Chart(chartCanvas, {

                type: "line",

                data: {

                    labels: chartLabels,

                    datasets: [{
                        label: "Estimated Temperature (°F)",
                        data: chartData,

                        borderColor: "#73b9a0",
                        backgroundColor: "rgba(115,185,160,0.12)",

                        borderWidth: 3,
                        pointRadius: 3,
                        pointHoverRadius: 6,

                        fill: true,
                        tension: 0.3
                    }]

                },

                options: {

                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            labels: {
                                color: "#edf3f5"
                            }
                        }
                    },

                    scales: {

                        x: {
                            title: {
                                display: true,
                                text: "Elevation Gain (feet)",
                                color: "#9aabb5"
                            },

                            ticks: {
                                color: "#9aabb5"
                            },

                            grid: {
                                color: "rgba(255,255,255,0.08)"
                            }
                        },

                        y: {
                            title: {
                                display: true,
                                text: "Temperature (°F)",
                                color: "#9aabb5"
                            },

                            ticks: {
                                color: "#9aabb5"
                            },

                            grid: {
                                color: "rgba(255,255,255,0.08)"
                            }
                        }

                    }

                }

            });

        }

        catch (error) {

            // Ignore errors from outdated requests
            if (requestId !== forecastRequest) {
                return;
            }

            console.error("Forecast error:", error);

            results.innerHTML = `
                <div style="color:#ff8080">
                    <strong>Forecast unavailable</strong>
                    <br>
                    ${error.message}
                </div>
            `;

        }

        finally {

            if (requestId === forecastRequest) {
                forecastBtn.disabled = false;
                forecastBtn.textContent = "Generate Forecast";
            }

        }

    }


    // ==============================
    // FORECAST BUTTON
    // ==============================

    forecastBtn.addEventListener("click", run);


    // ==============================
    // CURRENT LOCATION BUTTON
    // ==============================

    locateBtn.addEventListener("click", () => {

        if (!navigator.geolocation) {
            alert("Your browser does not support geolocation.");
            return;
        }

        locateBtn.disabled = true;
        locateBtn.textContent = "Finding Location...";

        navigator.geolocation.getCurrentPosition(

            (position) => {

                latInput.value =
                    position.coords.latitude.toFixed(6);

                lonInput.value =
                    position.coords.longitude.toFixed(6);

                run();

                locateBtn.disabled = false;
                locateBtn.textContent = "◎ Use My Location";

            },

            (error) => {

                alert("Unable to get your location: " + error.message);

                locateBtn.disabled = false;
                locateBtn.textContent = "◎ Use My Location";

            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }

        );

    });


    // ==============================
    // ROUTE PLANNER
    // ==============================

    if (clearRouteBtn && routeContainer) {

        clearRouteBtn.addEventListener("click", () => {

            routeContainer.innerHTML = `
                <p class="empty-route">
                    No route points added yet.
                </p>
            `;

        });

    }


    // ==============================
    // INITIALIZATION COMPLETE
    // ==============================

    console.log("Mountain Forecast Pro initialized.");
    console.log("Click anywhere on the map to select coordinates.");

});
