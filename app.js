
/*
===========================================================
                 MOUNTAIN FORECAST PRO
===========================================================

WHAT IS THIS FILE?

This is the main JavaScript file for Mountain Forecast Pro.

JavaScript makes websites interactive. HTML creates the
elements, CSS controls their appearance, and JavaScript
controls what those elements do.

This file controls:
    1. The interactive map.
    2. Selecting geographic coordinates.
    3. Saving locations between visits.
    4. Retrieving weather information.
    5. Estimating temperatures at higher elevations.
    6. Creating the temperature chart.
    7. Using the device's GPS.
    8. Planning a route with multiple points.

===========================================================
*/


// Wait until the HTML has finished loading before running
// JavaScript that interacts with its elements.

document.addEventListener("DOMContentLoaded", () => {


    // ==================================================
    // 1. FINDING HTML ELEMENTS
    // ==================================================

    const latInput = document.getElementById("lat");
    const lonInput = document.getElementById("lon");

    const forecastBtn = document.getElementById("forecastBtn");
    const locateBtn = document.getElementById("locateBtn");

    const results = document.getElementById("results");
    const chartCanvas = document.getElementById("chart");

    const mapElement = document.getElementById("map");

    const routeContainer = document.getElementById("route");
    const clearRouteBtn = document.getElementById("clearRoute");
    const addRouteBtn = document.getElementById("addRoutePoint");


    // Check that the important HTML elements actually exist.

    if (
        !latInput ||
        !lonInput ||
        !forecastBtn ||
        !locateBtn ||
        !results ||
        !mapElement
    ) {
        console.error(
            "Mountain Forecast Pro: A required HTML element is missing."
        );

        return;
    }


    // Check that Leaflet successfully loaded.

    if (typeof L === "undefined") {
        results.textContent =
            "The map library failed to load. Check your internet connection.";

        console.error("Leaflet did not load.");

        return;
    }



    // ==================================================
    // 2. APPLICATION VARIABLES
    // ==================================================

    const LOCATION_STORAGE_KEY = "mountainForecastLastLocation";

    let map;

    let selectedMarker = null;
    let selectedLocation = null;

    let chart = null;
    let forecastController = null;

    let routePoints = [];
    let routeMarkers = [];
    let routeLine = null;



    // ==================================================
    // 3. LOCAL STORAGE
    // ==================================================

    /*
    SAVE LAST LOCATION

    This function saves the selected latitude, longitude,
    and map zoom level in the browser.
    */

    function saveLastLocation(lat, lon) {

        if (!map) return;

        try {

            const location = {
                lat: Number(lat),
                lon: Number(lon),
                zoom: map.getZoom()
            };

            localStorage.setItem(
                LOCATION_STORAGE_KEY,
                JSON.stringify(location)
            );

        } catch (error) {

            console.warn("Unable to save location:", error);
        }
    }


    /*
    LOAD LAST LOCATION

    Retrieve the previously saved coordinates and validate
    them before using them.
    */

    function loadLastLocation() {

        try {

            const saved = localStorage.getItem(
                LOCATION_STORAGE_KEY
            );

            if (!saved) {
                return null;
            }

            const location = JSON.parse(saved);

            if (
                !location ||
                !Number.isFinite(location.lat) ||
                !Number.isFinite(location.lon) ||
                location.lat < -90 ||
                location.lat > 90 ||
                location.lon < -180 ||
                location.lon > 180
            ) {
                return null;
            }

            const zoom = Number.isFinite(location.zoom)
                ? Math.max(1, Math.min(location.zoom, 19))
                : 10;

            return {
                lat: location.lat,
                lon: location.lon,
                zoom: zoom
            };

        } catch (error) {

            console.warn("Unable to load saved location:", error);

            return null;
        }
    }


    /*
    SAVE CURRENT ZOOM

    Save the current location whenever the map's zoom changes.
    */

    function saveCurrentZoom() {

        if (!selectedLocation || !map) return;

        saveLastLocation(
            selectedLocation.lat,
            selectedLocation.lon
        );
    }



    // ==================================================
    // 4. MAP INITIALIZATION
    // ==================================================

    try {

        map = L.map("map").setView(
            [39.7392, -104.99],
            10
        );

    } catch (error) {

        console.error("Map initialization failed:", error);

        results.textContent =
            "The map could not be initialized. Check the map container.";

        return;
    }



    // ==================================================
    // 5. MAP LAYERS
    // ==================================================

    // Topographic map layer.
    const topoLayer = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,

            attribution:
                '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
        }
    );


    // Standard street map layer.
    const streetLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    );


    // Add the topographic layer when the map first loads.
    topoLayer.addTo(map);


    // Create the map layer selection menu.
    L.control.layers(
        {
            "Topographic": topoLayer,
            "Street Map": streetLayer
        }
    ).addTo(map);


    // Watch for errors while downloading map tiles.
    topoLayer.on("tileerror", () => {
        console.warn(
            "A topographic map tile failed to load. Try Street Map."
        );
    });

    streetLayer.on("tileerror", () => {
        console.warn(
            "A street map tile failed to load."
        );
    });



    // ==================================================
    // 6. MAP RESIZING
    // ==================================================

    function resizeMap() {

        if (map) {
            map.invalidateSize({ pan: false });
        }
    }


    window.addEventListener("load", resizeMap);
    window.addEventListener("resize", resizeMap);


    // Watch for changes to the map container's dimensions.
    if (typeof ResizeObserver !== "undefined") {

        const mapObserver = new ResizeObserver(resizeMap);

        mapObserver.observe(mapElement);
    }


    // Resize the map after Leaflet finishes initializing.
    map.whenReady(() => {
        setTimeout(resizeMap, 250);
    });



    // ==================================================
    // 7. LOCATION SELECTION
    // ==================================================

    /*
    GET COORDINATES

    Number() converts the input text into a number.

    Unlike parseFloat(), Number() does not accept a valid
    number followed by extra invalid characters.

    For example:
        Number("47.5") = 47.5
        Number("47abc") = NaN
    */

    function getCoordinates() {

        const lat = latInput.value.trim() === ""
            ? NaN
            : Number(latInput.value);

        const lon = lonInput.value.trim() === ""
            ? NaN
            : Number(lonInput.value);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            throw new Error(
                "Enter valid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180."
            );
        }

        return { lat, lon };
    }


    /*
    SELECT LOCATION

    Update the selected coordinates, marker, input boxes,
    map position, and saved location.
    */

    function selectLocation(lat, lon, moveMap = false) {

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            throw new Error("Invalid coordinates.");
        }


        selectedLocation = { lat, lon };


        // Update the input boxes.
        latInput.value = lat.toFixed(6);
        lonInput.value = lon.toFixed(6);


        // Remove the previous marker.
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }


        // Create a new marker.
        selectedMarker = L.marker([lat, lon]).addTo(map);


        // Add a popup to the marker.
        selectedMarker.bindPopup(`
            <strong>Selected Location</strong><br>
            Latitude: ${lat.toFixed(6)}<br>
            Longitude: ${lon.toFixed(6)}
        `);


        // Move the map if requested.
        if (moveMap) {
            map.setView([lat, lon], 12);
        }


        // Save the selected location.
        saveLastLocation(lat, lon);


        // Update the results panel.
        results.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⛰</span>
                <h3>Location Selected</h3>
                <p>
                    Latitude: ${lat.toFixed(6)}<br>
                    Longitude: ${lon.toFixed(6)}
                </p>
                <p>
                    Generate a forecast or add this location to your route.
                </p>
            </div>
        `;
    }


    // Select a location when the map is clicked.
    map.on("click", (event) => {

        selectLocation(
            event.latlng.lat,
            event.latlng.lng
        );

        console.log("Map location selected:", event.latlng);
    });


    // Read coordinates from the input boxes and select them.
    function readAndSelectInputs() {

        const { lat, lon } = getCoordinates();

        selectLocation(lat, lon, true);

        return { lat, lon };
    }



    // ==================================================
    // 8. WEATHER DESCRIPTIONS
    // ==================================================

    /*
    Open-Meteo returns weather conditions as WMO codes.
    This function translates those codes into descriptions.
    */

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



    // ==================================================
    // 9. WEATHER FORECAST
    // ==================================================

    /*
    RUN

    This is the main forecast function.

    It:
        1. Reads and validates coordinates.
        2. Requests weather information.
        3. Requests elevation information.
        4. Processes the returned data.
        5. Calculates estimated temperatures.
        6. Displays the results.
        7. Creates the temperature chart.
    */

    async function run() {

        let coordinates;


        // Read and validate the coordinates.
        try {

            coordinates = readAndSelectInputs();

        } catch (error) {

            alert(error.message);

            return;
        }


        // Cancel an older forecast request if one is running.
        if (forecastController) {
            forecastController.abort();
        }


        // Create a controller for this new request.
        const controller = new AbortController();

        forecastController = controller;

        const signal = controller.signal;


        // Disable the forecast button while loading.
        forecastBtn.disabled = true;

        forecastBtn.textContent = "Loading Forecast...";

        results.textContent =
            "Retrieving weather and elevation data...";


        const { lat, lon } = coordinates;



        // ==================================================
        // 9A. WEATHER API ADDRESS
        // ==================================================

        /*
        IMPORTANT FIX:

        The weather URL must be a URL object, not a plain
        string, because we assign URLSearchParams to its
        search property.

        The previous code attempted to use undefined
        variables named la and lo. This version uses the
        actual coordinates: lat and lon.
        */

        const weatherURL = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );


        // Add the requested weather parameters.
        weatherURL.search = new URLSearchParams({

            latitude: String(lat),
            longitude: String(lon),

            current:
                "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",

            hourly:
                "temperature_2m,precipitation_probability,wind_speed_10m,weather_code",

            forecast_days: "2",

            timezone: "auto",

            temperature_unit: "fahrenheit",

            wind_speed_unit: "mph"

        }).toString();



        // ==================================================
        // 9B. ELEVATION API ADDRESS
        // ==================================================

        const elevationURL = new URL(
            "https://api.open-meteo.com/v1/elevation"
        );

        elevationURL.search = new URLSearchParams({

            latitude: String(lat),
            longitude: String(lon)

        }).toString();



        // ==================================================
        // 9C. REQUESTING THE INFORMATION
        // ==================================================

        /*
        Promise.all() allows both API requests to run
        at approximately the same time.
        */

        try {

            const [weatherResponse, elevationResponse] =
                await Promise.all([

                    fetch(weatherURL, { signal }),

                    fetch(elevationURL, { signal })

                ]);


            // Check whether either server returned an error.
            if (!weatherResponse.ok) {

                throw new Error(
                    `Weather API error: HTTP ${weatherResponse.status}`
                );
            }

            if (!elevationResponse.ok) {

                throw new Error(
                    `Elevation API error: HTTP ${elevationResponse.status}`
                );
            }


            // Convert both responses from JSON into JavaScript objects.
            const [weather, elevationData] = await Promise.all([

                weatherResponse.json(),

                elevationResponse.json()

            ]);



            // ==================================================
            // 9D. CHECKING THE API INFORMATION
            // ==================================================

            if (
                !weather.current ||
                !weather.hourly ||

                !Array.isArray(weather.hourly.time) ||

                !Array.isArray(weather.hourly.temperature_2m) ||

                !Array.isArray(
                    weather.hourly.precipitation_probability
                ) ||

                !Array.isArray(weather.hourly.weather_code) ||

                !Array.isArray(elevationData.elevation) ||

                !Number.isFinite(elevationData.elevation[0])
            ) {

                throw new Error(
                    "The API returned incomplete weather or elevation data."
                );
            }



            // ==================================================
            // 9E. CURRENT WEATHER CONDITIONS
            // ==================================================

            const current = weather.current;

            const temperature = current.temperature_2m;

            const humidity = current.relative_humidity_2m;

            const wind = current.wind_speed_10m;

            // Convert elevation from meters into feet.
            const groundElevation =
                elevationData.elevation[0] * 3.28084;

            const conditions = weatherDescription(
                current.weather_code
            );


            // Check that the current conditions are valid.
            if (
                !Number.isFinite(temperature) ||
                !Number.isFinite(humidity) ||
                !Number.isFinite(wind)
            ) {

                throw new Error(
                    "The weather API returned invalid current conditions."
                );
            }



            // ==================================================
            // 10. HOURLY FORECAST
            // ==================================================

            const hourly = weather.hourly;


            // Find the first forecast hour at or after the current time.
            let firstHour = hourly.time.findIndex(
                time => time >= current.time
            );


            // If no matching time is found, start at index zero.
            if (firstHour < 0) {
                firstHour = 0;
            }


            // Start building the hourly forecast table.
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


            // Display the next six forecast hours.
            for (
                let i = firstHour;
                i < Math.min(firstHour + 6, hourly.time.length);
                i++
            ) {

                const time = hourly.time[i].slice(11, 16);

                const temp = hourly.temperature_2m[i];

                const rain =
                    hourly.precipitation_probability[i];

                const description = weatherDescription(
                    hourly.weather_code[i]
                );


                // Add a row to the hourly forecast table.
                hourlyHTML += `

                    <tr>

                        <td>${time}</td>

                        <td>${description}</td>

                        <td>
                            ${Number.isFinite(temp)
                                ? temp.toFixed(1) + "°F"
                                : "—"}
                        </td>

                        <td>
                            ${Number.isFinite(rain)
                                ? rain + "%"
                                : "—"}
                        </td>

                    </tr>

                `;
            }


            // Close the table.
            hourlyHTML += "</table>";



            // ==================================================
            // 11. ELEVATION TEMPERATURE ESTIMATES
            // ==================================================

            /*
            Temperature generally decreases as elevation increases.

            This estimate uses a lapse rate of 3.6°F per
            1,000 feet of elevation gain.

            This is NOT an actual mountain summit forecast.
            */

            const elevationLabels = [];

            const elevationTemperatures = [];


            // Start building the elevation table.
            let elevationHTML = `

                <h3>Estimated Temperature by Elevation</h3>

                <table>

                    <tr>
                        <th>Elevation Gain</th>
                        <th>Estimated Temp</th>
                    </tr>

            `;


            // Calculate temperatures every 1,000 feet.
            for (let gain = 0; gain <= 12000; gain += 1000) {

                const estimatedTemp =
                    temperature - (gain / 1000 * 3.6);


                const label = gain === 0
                    ? "0"
                    : `+${gain.toLocaleString()}`;


                // Save the information for the chart.
                elevationLabels.push(label);

                elevationTemperatures.push(
                    Number(estimatedTemp.toFixed(1))
                );


                // Add the information to the table.
                elevationHTML += `

                    <tr>

                        <td>${label} ft</td>

                        <td>${estimatedTemp.toFixed(1)}°F</td>

                    </tr>

                `;
            }


            // Close the elevation table.
            elevationHTML += "</table>";



            // ==================================================
            // 12. DISPLAY WEATHER RESULTS
            // ==================================================

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

                    Temperature estimates use a fixed 3.6°F per
                    1,000 ft lapse rate.

                    They are not actual forecasts for individual
                    mountain elevations.

                </p>

            `;



            // ==================================================
            // 13. CREATE THE TEMPERATURE CHART
            // ==================================================

            // Check whether Chart.js loaded successfully.
            if (typeof Chart === "undefined" || !chartCanvas) {

                console.warn(
                    "Chart.js or the chart canvas is unavailable. Weather results are still displayed."
                );

            } else {

                try {

                    // Destroy the previous chart before creating another.
                    if (chart) {
                        chart.destroy();
                    }


                    // Create the new line chart.
                    chart = new Chart(chartCanvas, {

                        type: "line",

                        data: {

                            labels: elevationLabels,

                            datasets: [{

                                label: "Estimated Temperature (°F)",

                                data: elevationTemperatures,

                                borderColor: "#73b9a0",

                                backgroundColor:
                                    "rgba(115,185,160,0.12)",

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
                                        color:
                                            "rgba(255,255,255,0.08)"
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
                                        color:
                                            "rgba(255,255,255,0.08)"
                                    }

                                }

                            }

                        }

                    });

                } catch (chartError) {

                    // A chart error should not erase the forecast.
                    console.error(
                        "Chart creation failed:",
                        chartError
                    );
                }
            }


        } catch (error) {

            // Canceled requests do not need to display an error.
            if (error.name === "AbortError") {
                return;
            }


            console.error("Forecast error:", error);


            // A TypeError from fetch commonly means the browser
            // could not complete the network request.
            const userMessage = error instanceof TypeError
                ? "The browser could not reach the weather service. Check your internet connection, browser extensions, or network restrictions."
                : error.message;


            // Display an understandable error message.
            results.innerHTML = `

                <div style="color:#ff8080">

                    <strong>Forecast unavailable</strong>

                    <p>${userMessage}</p>

                    <p>Check your connection and try again.</p>

                </div>

            `;

        } finally {

            // Restore the button if this is still the newest request.
            if (forecastController === controller) {

                forecastController = null;

                forecastBtn.disabled = false;

                forecastBtn.textContent = "Generate Forecast";
            }
        }
    }


    // Run the forecast when the user clicks the button.
    forecastBtn.addEventListener("click", run);



    // ==================================================
    // 14. GPS / CURRENT LOCATION
    // ==================================================

    locateBtn.addEventListener("click", () => {

        // Check whether the browser supports geolocation.
        if (!navigator.geolocation) {

            alert(
                "Your browser does not support location services."
            );

            return;
        }


        // Show the user that GPS is working.
        locateBtn.disabled = true;

        locateBtn.textContent = "Finding Location...";


        navigator.geolocation.getCurrentPosition(

            // SUCCESS: The browser found the coordinates.
            async position => {

                latInput.value =
                    position.coords.latitude.toFixed(6);

                lonInput.value =
                    position.coords.longitude.toFixed(6);


                // Run the normal forecast function using GPS coordinates.
                try {

                    await run();

                } finally {

                    // Restore the GPS button.
                    locateBtn.disabled = false;

                    locateBtn.textContent = "◎ Use My Location";
                }
            },


            // ERROR: The browser could not get the location.
            error => {

                alert(
                    "Unable to get your location: " + error.message
                );

                locateBtn.disabled = false;

                locateBtn.textContent = "◎ Use My Location";
            },


            // GPS settings.
            {
                enableHighAccuracy: true,

                timeout: 15000,

                maximumAge: 60000
            }
        );
    });



    // ==================================================
    // 15. ROUTE PLANNER
    // ==================================================

    /*
    The route planner lets the user select multiple locations
    and connect them with a line.

    The line drawn between points is straight. It does not
    follow roads, hiking trails, or terrain.
    */


    // ==================================================
    // 15A. DRAW THE ROUTE
    // ==================================================

    function renderRoute() {


        // Remove the old route line.
        if (routeLine) {

            map.removeLayer(routeLine);

            routeLine = null;
        }


        // Remove the old route markers.
        routeMarkers.forEach(marker => {

            map.removeLayer(marker);

        });

        routeMarkers = [];


        // Display an empty message if there are no points.
        if (routePoints.length === 0) {

            if (routeContainer) {

                routeContainer.innerHTML = `

                    <p class="empty-route">
                        No route points added yet.
                    </p>

                `;
            }

            return;
        }


        // Draw a line if there are at least two route points.
        if (routePoints.length >= 2) {

            routeLine = L.polyline(

                routePoints.map(point => [
                    point.lat,
                    point.lon
                ]),

                {
                    color: "#73b9a0",

                    weight: 4,

                    opacity: 0.85
                }

            ).addTo(map);
        }


        // Create a marker for every route point.
        routePoints.forEach((point, index) => {

            const routeMarker = L.marker([

                point.lat,

                point.lon

            ]).addTo(map);


            // Give each route marker a popup.
            routeMarker.bindPopup(`

                <strong>Route Point ${index + 1}</strong><br>

                Latitude: ${point.lat.toFixed(6)}<br>

                Longitude: ${point.lon.toFixed(6)}

            `);


            // Save the marker so it can be removed later.
            routeMarkers.push(routeMarker);
        });



        // ==================================================
        // 15B. DISPLAY THE ROUTE LIST
        // ==================================================

        if (routeContainer) {

            routeContainer.innerHTML = routePoints

                .map((point, index) => `

                    <div class="route-point">

                        <div>

                            <strong>Point ${index + 1}</strong>

                            <small>
                                ${point.lat.toFixed(5)},
                                ${point.lon.toFixed(5)}
                            </small>

                        </div>


                        <button

                            class="remove-route-point"

                            data-index="${index}"

                            aria-label="Remove route point ${index + 1}"

                            type="button"

                        >×</button>

                    </div>

                `)

                .join("");
        }
    }



    // ==================================================
    // 15C. ADD A ROUTE POINT
    // ==================================================

    if (addRouteBtn) {

        addRouteBtn.addEventListener("click", () => {

            try {

                const { lat, lon } = getCoordinates();


                // Add a new object to the route array.
                routePoints.push({ lat, lon });


                // Redraw the route with the new point.
                renderRoute();


                // Keep this point selected on the map.
                selectLocation(lat, lon);

            } catch (error) {

                alert(error.message);
            }
        });
    }



    // ==================================================
    // 15D. REMOVE A ROUTE POINT
    // ==================================================

    if (routeContainer) {

        routeContainer.addEventListener("click", event => {

            const removeButton = event.target.closest(
                ".remove-route-point"
            );


            // Ignore clicks that were not on a remove button.
            if (!removeButton) return;


            // Read which route point the button belongs to.
            const index = Number(
                removeButton.dataset.index
            );


            // Make sure the index is valid.
            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= routePoints.length
            ) {
                return;
            }


            // Remove exactly one route point.
            routePoints.splice(index, 1);


            // Redraw the route without the removed point.
            renderRoute();
        });
    }



    // ==================================================
    // 15E. CLEAR THE ENTIRE ROUTE
    // ==================================================

    if (clearRouteBtn) {

        clearRouteBtn.addEventListener("click", () => {

            routePoints = [];

            renderRoute();
        });
    }



    // ==================================================
    // 16. RESTORE THE LAST SELECTED LOCATION
    // ==================================================

    /*
    This section is near the bottom because the map and
    selectLocation() function must already exist.

    If a saved location exists, restore its coordinates,
    zoom level, and marker.
    */

    const savedLocation = loadLastLocation();

    if (savedLocation) {

        try {

            // Restore the map position and zoom.
            map.setView(

                [savedLocation.lat, savedLocation.lon],

                savedLocation.zoom

            );


            // Recreate the selected location marker.
            selectLocation(

                savedLocation.lat,

                savedLocation.lon

            );


            console.log(
                "Restored previous location:",
                savedLocation
            );

        } catch (error) {

            console.error(
                "Could not restore previous location:",
                error
            );
        }
    }



    // ==================================================
    // 17. FINISH INITIALIZATION
    // ==================================================

    console.log("Mountain Forecast Pro initialized.");

    console.log("Click the map to select a location.");

});
