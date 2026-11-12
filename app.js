
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
    const addRouteBtn = document.getElementById("addRoutePoint");

const LOCATION_STORAGE_KEY = "mountainForecastLastLocation";

function saveLastLocation(lat, lon) {
    try {
        localStorage.setItem(
            LOCATION_STORAGE_KEY,
            JSON.stringify({
                lat: Number(lat),
                lon: Number(lon),
                zoom: map.getZoom()
            })
        );
    } catch (error) {
        console.warn("Could not save location:", error);
    }
}

function loadLastLocation() {
    try {
        const saved = localStorage.getItem(LOCATION_STORAGE_KEY);

        if (!saved) return null;

        const location = JSON.parse(saved);

        if (
            !Number.isFinite(location.lat) ||
            !Number.isFinite(location.lon) ||
            location.lat < -90 ||
            location.lat > 90 ||
            location.lon < -180 ||
            location.lon > 180
        ) {
            return null;
        }

        return location;
    } catch (error) {
        console.warn("Could not load saved location:", error);
        return null;
    }
}
    
    if (
        !latInput || !lonInput || !forecastBtn ||
        !locateBtn || !results || !chartCanvas ||
        !routeContainer || !clearRouteBtn || !addRouteBtn
    ) {
        console.error("Mountain Forecast Pro: Required HTML element missing.");
        return;
    }

    if (typeof L === "undefined") {
        results.textContent = "The map library failed to load. Check your internet connection.";
        console.error("Leaflet did not load.");
        return;
    }
// Restore the last selected location
const savedLocation = loadLastLocation();

if (savedLocation) {
    selectLocation(savedLocation.lat, savedLocation.lon);

    map.setView(
        [savedLocation.lat, savedLocation.lon],
        savedLocation.zoom || 10
    );

    console.log("Restored previous location:", savedLocation);
}
    // ==============================
    // MAP
    // ==============================

    const map = L.map("map").setView([39.7392, -104.99], 10);

    const topoLayer = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,
            attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
        }
    );

    const streetLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    );

    topoLayer.addTo(map);

    L.control.layers(
        {
            "Topographic": topoLayer,
            "Street Map": streetLayer
        }
    ).addTo(map);

    topoLayer.on("tileerror", () => {
        console.warn("A topographic map tile failed to load. Try Street Map.");
    });

    let selectedMarker = null;
    let selectedLocation = null;
    let chart = null;
    let forecastController = null;

    // Route planner state
    let routePoints = [];
    let routeMarkers = [];
    let routeLine = null;

    // ==============================
    // MAP RESIZING
    // ==============================

    function resizeMap() {
        map.invalidateSize({ pan: false });
    }

    window.addEventListener("load", resizeMap);
    window.addEventListener("resize", resizeMap);

    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(resizeMap);
        observer.observe(document.getElementById("map"));
    }

    map.whenReady(() => setTimeout(resizeMap, 250));

    // ==============================
    // LOCATION SELECTION
    // ==============================

    function getCoordinates() {
        const lat = Number.parseFloat(latInput.value);
        const lon = Number.parseFloat(lonInput.value);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 || lat > 90 ||
            lon < -180 || lon > 180
        ) {
            throw new Error("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).");
        }

        return { lat, lon };
    }

    function selectLocation(lat, lon, moveMap = false) {
        selectedLocation = { lat, lon };
        saveLastLocation(lat, lon);
        latInput.value = lat.toFixed(6);
        lonInput.value = lon.toFixed(6);

        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }

        selectedMarker = L.marker([lat, lon]).addTo(map);

        selectedMarker.bindPopup(`
            <strong>Selected Location</strong><br>
            Latitude: ${lat.toFixed(6)}<br>
            Longitude: ${lon.toFixed(6)}
        `);

        if (moveMap) {
            map.setView([lat, lon], 12);
        }

        results.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⛰</span>
                <h3>Location Selected</h3>
                <p>
                    Latitude: ${lat.toFixed(6)}<br>
                    Longitude: ${lon.toFixed(6)}
                </p>
                <p>Generate a forecast or add this location to your route.</p>
            </div>
        `;
    }

    map.on("click", (event) => {
        selectLocation(event.latlng.lat, event.latlng.lng);
        console.log("Map clicked:", event.latlng);
    });

    // Keep manually entered coordinates in sync when generating a forecast.
    function readAndSelectInputs() {
        const { lat, lon } = getCoordinates();
        selectLocation(lat, lon, true);
        saveLastLocation(lat, lon);
        return { lat, lon };
    }

    // ==============================
    // WEATHER DESCRIPTION
    // ==============================

    function weatherDescription(code) {
        const descriptions = {
            0: "Clear sky",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast",
            45: "Fog",
            48: "Depositing rime fog",
            51: "Light drizzle",
            53: "Moderate drizzle",
            55: "Dense drizzle",
            56: "Freezing drizzle",
            57: "Heavy freezing drizzle",
            61: "Light rain",
            63: "Moderate rain",
            65: "Heavy rain",
            66: "Freezing rain",
            67: "Heavy freezing rain",
            71: "Light snow",
            73: "Moderate snow",
            75: "Heavy snow",
            77: "Snow grains",
            80: "Rain showers",
            81: "Moderate rain showers",
            82: "Heavy rain showers",
            85: "Snow showers",
            86: "Heavy snow showers",
            95: "Thunderstorm",
            96: "Thunderstorm with hail",
            99: "Severe thunderstorm with hail"
        };

        return descriptions[code] || "Conditions unavailable";
    }

    // ==============================
    // FORECAST
    // ==============================

    async function run() {
        let coordinates;

        try {
            coordinates = readAndSelectInputs();
        } catch (error) {
            alert(error.message);
            return;
        }

        // Cancel any previous forecast request.
        if (forecastController) {
            forecastController.abort();
        }

        forecastController = new AbortController();
        const signal = forecastController.signal;

        forecastBtn.disabled = true;
        forecastBtn.textContent = "Loading Forecast...";

        results.textContent = "Retrieving weather and elevation data...";

        const { lat, lon } = coordinates;

        const weatherURL = new URL("https://api.open-meteo.com/v1/forecast");
        weatherURL.search = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
            hourly: "temperature_2m,precipitation_probability,wind_speed_10m,weather_code",
            forecast_days: "2",
            timezone: "auto",
            temperature_unit: "fahrenheit",
            wind_speed_unit: "mph"
        });

        const elevationURL = new URL("https://api.open-meteo.com/v1/elevation");
        elevationURL.search = new URLSearchParams({
            latitude: lat,
            longitude: lon
        });

        try {
            const [weatherResponse, elevationResponse] = await Promise.all([
                fetch(weatherURL, { signal }),
                fetch(elevationURL, { signal })
            ]);

            const weather = await weatherResponse.json();
            const elevationData = await elevationResponse.json();

            if (!weatherResponse.ok) {
                throw new Error(weather.reason || "Weather API request failed.");
            }

            if (!elevationResponse.ok) {
                throw new Error(elevationData.reason || "Elevation API request failed.");
            }

            if (
                !weather.current ||
                !weather.hourly ||
                !Array.isArray(weather.hourly.time) ||
                !Array.isArray(elevationData.elevation) ||
                !Number.isFinite(elevationData.elevation[0])
            ) {
                throw new Error("The API returned incomplete weather or elevation data.");
            }

            const current = weather.current;
            const groundElevation = elevationData.elevation[0] * 3.28084;

            const temperature = current.temperature_2m;
            const humidity = current.relative_humidity_2m;
            const wind = current.wind_speed_10m;
            const conditions = weatherDescription(current.weather_code);

            // ==============================
            // HOURLY FORECAST
            // ==============================

            const hourly = weather.hourly;

            // Find the first forecast hour at or after the current time.
            let firstHour = hourly.time.findIndex(
                time => time >= current.time
            );

            if (firstHour < 0) firstHour = 0;

            let hourlyHTML = `
                <h3>Upcoming Hours</h3>
                <table>
                    <tr>
                        <th>Time</th>
                        <th>Conditions</th>
                        <th>Temp</th>
                        <th>Rain</th>
                    </tr>
            `;

            for (let i = firstHour; i < Math.min(firstHour + 6, hourly.time.length); i++) {
                const time = hourly.time[i].slice(11, 16);
                const temp = hourly.temperature_2m[i];
                const rain = hourly.precipitation_probability[i];
                const description = weatherDescription(hourly.weather_code[i]);

                hourlyHTML += `
                    <tr>
                        <td>${time}</td>
                        <td>${description}</td>
                        <td>${Number.isFinite(temp) ? temp.toFixed(1) + "°F" : "—"}</td>
                        <td>${Number.isFinite(rain) ? rain + "%" : "—"}</td>
                    </tr>
                `;
            }

            hourlyHTML += "</table>";

            // ==============================
            // ELEVATION ESTIMATES
            // ==============================

            const elevationLabels = [];
            const elevationTemperatures = [];

            let elevationHTML = `
                <h3>Estimated Temperature by Elevation</h3>
                <table>
                    <tr>
                        <th>Elevation Gain</th>
                        <th>Estimated Temp</th>
                    </tr>
            `;

            for (let gain = 0; gain <= 12000; gain += 1000) {
                const estimatedTemp = temperature - (gain / 1000 * 3.6);
                const label = gain === 0 ? "0" : `+${gain.toLocaleString()}`;

                elevationLabels.push(label);
                elevationTemperatures.push(Number(estimatedTemp.toFixed(1)));

                elevationHTML += `
                    <tr>
                        <td>${label} ft</td>
                        <td>${estimatedTemp.toFixed(1)}°F</td>
                    </tr>
                `;
            }

            elevationHTML += "</table>";

            // ==============================
            // DISPLAY RESULTS
            // ==============================

            results.innerHTML = `
                <h3>Current Conditions</h3>
                <p>
                    Conditions: ${conditions}<br>
                    Temperature: ${temperature.toFixed(1)}°F<br>
                    Humidity: ${humidity}%<br>
                    Wind: ${wind} mph<br>
                    Ground Elevation: ${groundElevation.toFixed(0)} ft
                </p>
                ${hourlyHTML}
                ${elevationHTML}
                <p style="font-size:12px;">
                    Elevation data: Copernicus DEM via Open-Meteo.
                    Temperature estimates use a fixed 3.6°F per 1,000 ft lapse rate.
                    They are not actual forecasts for individual mountain elevations.
                </p>
            `;

            // ==============================
            // CHART
            // ==============================

            if (typeof Chart === "undefined") {
                throw new Error("Chart.js did not load. Check your internet connection.");
            }

            if (chart) {
                chart.destroy();
            }

            chart = new Chart(chartCanvas, {
                type: "line",
                data: {
                    labels: elevationLabels,
                    datasets: [{
                        label: "Estimated Temperature (°F)",
                        data: elevationTemperatures,
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
                            labels: { color: "#edf3f5" }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: "Elevation Gain (feet)",
                                color: "#9aabb5"
                            },
                            ticks: { color: "#9aabb5" },
                            grid: { color: "rgba(255,255,255,0.08)" }
                        },
                        y: {
                            title: {
                                display: true,
                                text: "Temperature (°F)",
                                color: "#9aabb5"
                            },
                            ticks: { color: "#9aabb5" },
                            grid: { color: "rgba(255,255,255,0.08)" }
                        }
                    }
                }
            });

        } catch (error) {
            if (error.name === "AbortError") return;

            console.error("Forecast error:", error);

            results.innerHTML = `
                <div style="color:#ff8080">
                    <strong>Forecast unavailable</strong>
                    <p>${error.message}</p>
                    <p>Check your connection and try again.</p>
                </div>
            `;
        } finally {
            if (forecastController && forecastController.signal === signal) {
                forecastBtn.disabled = false;
                forecastBtn.textContent = "Generate Forecast";
            }
        }
    }

    forecastBtn.addEventListener("click", run);

    // ==============================
    // CURRENT LOCATION
    // ==============================

    locateBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
            alert("Your browser does not support location services.");
            return;
        }

        locateBtn.disabled = true;
        locateBtn.textContent = "Finding Location...";

        navigator.geolocation.getCurrentPosition(
            async position => {
                latInput.value = position.coords.latitude.toFixed(6);
                lonInput.value = position.coords.longitude.toFixed(6);

                await run();

                locateBtn.disabled = false;
                locateBtn.textContent = "◎ Use My Location";
            },
            error => {
                alert("Unable to get your location: " + error.message);
                locateBtn.disabled = false;
                locateBtn.textContent = "◎ Use My Location";
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    });

    // ==============================
    // ROUTE PLANNER
    // ==============================

    function renderRoute() {
        // Remove old route line.
        if (routeLine) {
            map.removeLayer(routeLine);
            routeLine = null;
        }

        // Remove old route markers.
        routeMarkers.forEach(marker => map.removeLayer(marker));
        routeMarkers = [];

        if (routePoints.length === 0) {
            routeContainer.innerHTML = `
                <p class="empty-route">No route points added yet.</p>
            `;
            return;
        }

        // Draw route line when there are at least two points.
        if (routePoints.length >= 2) {
            routeLine = L.polyline(
                routePoints.map(point => [point.lat, point.lon]),
                {
                    color: "#73b9a0",
                    weight: 4,
                    opacity: 0.85
                }
            ).addTo(map);
        }

        // Add numbered map markers.
        routePoints.forEach((point, index) => {
            const routeMarker = L.marker([point.lat, point.lon])
                .addTo(map)
                .bindPopup(`
                    <strong>Route Point ${index + 1}</strong><br>
                    ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}
                `);

            routeMarkers.push(routeMarker);
        });

        // Build the route list.
        routeContainer.innerHTML = routePoints.map((point, index) => `
            <div class="route-point">
                <div>
                    <strong>Point ${index + 1}</strong>
                    <small>${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}</small>
                </div>
                <button
                    class="remove-route-point"
                    data-index="${index}"
                    aria-label="Remove route point ${index + 1}"
                    type="button"
                >×</button>
            </div>
        `).join("");
    }

    addRouteBtn.addEventListener("click", () => {
        try {
            const { lat, lon } = getCoordinates();

            selectedLocation = { lat, lon };

            routePoints.push({ lat, lon });
            renderRoute();

            selectLocation(lat, lon);
        } catch (error) {
            alert(error.message);
        }
    });

    routeContainer.addEventListener("click", event => {
        const removeButton = event.target.closest(".remove-route-point");

        if (!removeButton) return;

        const index = Number(removeButton.dataset.index);

        if (!Number.isInteger(index) || index < 0 || index >= routePoints.length) {
            return;
        }

        routePoints.splice(index, 1);
        renderRoute();
    });

    clearRouteBtn.addEventListener("click", () => {
        routePoints = [];
        renderRoute();
    });

    // ==============================
    // INITIALIZATION
    // ==============================

    console.log("Mountain Forecast Pro initialized.");
    console.log("Click the map to select a location.");
});
