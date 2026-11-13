
/*
===========================================================
                 MOUNTAIN FORECAST PRO
===========================================================

WHAT IS THIS FILE?

This is the main JavaScript file for Mountain Forecast Pro.

JavaScript is a programming language that makes websites
interactive. HTML creates the elements on a webpage, CSS
controls their appearance, and JavaScript controls what
those elements actually do.

For example:
    - HTML creates the map container.
    - CSS determines how large the map appears.
    - JavaScript loads the map and makes it respond to clicks.

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


// DOMContentLoaded is an event. An event is something that
// happens in the browser that JavaScript can respond to.
//
// DOM stands for Document Object Model. It is the browser's
// internal representation of the webpage and its HTML.
//
// This event tells JavaScript to wait until the HTML has
// finished loading before trying to interact with it.
//
// Without this, JavaScript might try to find buttons or map
// containers that the browser has not created yet.

document.addEventListener("DOMContentLoaded", () => {


    // ==================================================
    // 1. FINDING HTML ELEMENTS
    // ==================================================

    /*
    WHAT IS document.getElementById()?

    Every HTML element can have an ID, which is a unique name
    used to identify that element.

    For example, in index.html:

        <input id="lat">

    JavaScript can find that input using:

        document.getElementById("lat")

    We store the elements in variables so we can use them
    later without having to search for them repeatedly.

    A variable is a named container that stores information.

    The 'const' keyword creates a variable that cannot be
    reassigned to a different value later.
    */

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


    /*
    Before doing anything else, check that the important
    HTML elements actually exist.

    An element that JavaScript cannot find will have a value
    of null. Null means that there is no value or object there.

    If a required element is missing, continuing could cause
    errors throughout the program.

    Instead, we display an error and stop the program.
    */

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


    /*
    Leaflet is the JavaScript library used to create the map.

    A library is a collection of prewritten code that
    programmers can use instead of building everything
    themselves.

    The letter L is the name Leaflet uses for its functions.

    If Leaflet failed to load, the map cannot be created.
    */

    if (typeof L === "undefined") {
        results.textContent =
            "The map library failed to load. Check your internet connection.";

        console.error("Leaflet did not load.");

        return;
    }



    // ==================================================
    // 2. APPLICATION VARIABLES
    // ==================================================

    /*
    These variables keep track of information while the
    website is running.

    'let' creates a variable whose value can change.

    This is different from 'const', which cannot be reassigned.

    For example:
        let chart = null;

    Later, we can replace null with an actual chart object.

    An object is a JavaScript value that can contain multiple
    related pieces of information.
    */

    const LOCATION_STORAGE_KEY = "mountainForecastLastLocation";

    let map;

    let selectedMarker = null;
    let selectedLocation = null;

    let chart = null;
    let forecastController = null;

    let routePoints = [];
    let routeMarkers = [];
    let routeLine = null;


    /*
    Here is what these variables represent:

    map:
        The Leaflet map displayed on the website.

    selectedMarker:
        The marker showing the currently selected location.

    selectedLocation:
        The latitude and longitude currently selected.

    chart:
        The temperature chart.

    forecastController:
        Controls an active weather request so an older request
        can be canceled if a new one starts.

    routePoints:
        An array containing all locations added to a route.

    routeMarkers:
        The map markers representing those route points.

    routeLine:
        The line connecting the route points.

    An array is a list of values stored in a single variable.
    We use arrays for the route because it can contain many
    different locations.
    */



    // ==================================================
    // 3. LOCAL STORAGE
    // ==================================================

    /*
    WHAT IS localStorage?

    localStorage is a feature built into web browsers.

    It allows a website to save small amounts of information
    directly in the user's browser.

    Unlike ordinary JavaScript variables, information stored
    in localStorage survives:
        - Refreshing the webpage.
        - Closing and reopening the browser.
        - Restarting the computer.

    The information stays on that particular browser and device.

    It does NOT automatically transfer between devices.

    LOCATION_STORAGE_KEY is the name we use to identify our
    saved location in localStorage.
    */


    /*
    SAVE LAST LOCATION

    This function saves the selected latitude, longitude,
    and map zoom level.

    A function is a reusable block of code that performs
    a particular task.

    We pass latitude and longitude into this function.
    These are called parameters.

    Number() converts a value into a number.

    JSON.stringify() converts a JavaScript object into text
    so it can be stored in localStorage.

    JSON stands for JavaScript Object Notation. It is a
    common format for storing and transferring information.
    */

    function saveLastLocation(lat, lon) {

        // We cannot save the map zoom if the map does not exist.
        if (!map) return;

        try {

            // Create an object containing the information
            // we want to remember.

            const location = {
                lat: Number(lat),
                lon: Number(lon),
                zoom: map.getZoom()
            };

            // Store the object as text in the browser.
            localStorage.setItem(
                LOCATION_STORAGE_KEY,
                JSON.stringify(location)
            );

        } catch (error) {

            // If the browser blocks storage, report the problem.
            console.warn("Unable to save location:", error);
        }
    }


    /*
    LOAD LAST LOCATION

    This function retrieves the saved location.

    localStorage.getItem() retrieves the information using
    the key we created above.

    JSON.parse() converts the stored text back into a
    JavaScript object.

    We validate the coordinates before using them. Validation
    means checking that information is acceptable and within
    the expected limits.
    */

    function loadLastLocation() {

        try {

            const saved = localStorage.getItem(
                LOCATION_STORAGE_KEY
            );

            // If nothing was saved, return null.
            if (!saved) {
                return null;
            }

            // Convert the stored text back into an object.
            const location = JSON.parse(saved);

            // Make sure the saved information is valid.
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

            // Make sure the zoom level is also reasonable.
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

    The user can zoom in and out of the map.

    We want the website to remember the zoom level as well
    as the selected coordinates.

    This function saves the current location again whenever
    the map's zoom level changes.
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

    /*
    We now create the actual map.

    L.map("map") tells Leaflet to put the map inside the
    HTML element whose ID is "map".

    setView() determines where the map initially appears.

    The first value is an array:
        [latitude, longitude]

    The second value is the zoom level.

    A larger zoom number means a closer view.

    We use a default location in Denver in case the user
    has never selected a location before.

    The try/catch block prevents a map initialization
    problem from crashing the rest of the website.
    */

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

    /*
    A map layer is a particular map display that can be
    placed on top of the Leaflet map.

    We provide two choices:

        1. OpenTopoMap:
           A topographic map showing terrain features,
           elevation information, and landforms.

        2. OpenStreetMap:
           A standard street map.

    tileLayer() loads the map as many small square images
    called tiles.

    Leaflet automatically combines those tiles to create
    the complete map.
    */


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


    /*
    This creates the small menu in the upper corner of the
    map that lets the user switch between map layers.
    */

    L.control.layers(
        {
            "Topographic": topoLayer,
            "Street Map": streetLayer
        }
    ).addTo(map);


    /*
    These event listeners watch for errors while downloading
    map tiles.

    An event listener is code that waits for something to
    happen and then responds to it.

    If a map tile fails to load, we display a warning in
    the browser's developer console.
    */

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

    /*
    Sometimes a map is displayed before its surrounding
    webpage has finished adjusting its size.

    This can cause the map to appear gray, incomplete,
    or incorrectly positioned.

    invalidateSize() tells Leaflet to recalculate the
    dimensions of the map.

    We run this when:
        - The browser finishes loading.
        - The browser window changes size.
        - The map container changes size.
    */

    function resizeMap() {

        if (map) {
            map.invalidateSize({ pan: false });
        }
    }


    window.addEventListener("load", resizeMap);
    window.addEventListener("resize", resizeMap);


    /*
    ResizeObserver watches an HTML element and detects
    when its dimensions change.

    This is useful when the sidebar opens, closes, or changes
    size without the browser window itself changing size.
    */

    if (typeof ResizeObserver !== "undefined") {

        const mapObserver = new ResizeObserver(resizeMap);

        mapObserver.observe(mapElement);
    }


    // Wait until Leaflet finishes initializing the map.
    // Then resize it once more after a short delay.

    map.whenReady(() => {
        setTimeout(resizeMap, 250);
    });



    // ==================================================
    // 7. LOCATION SELECTION
    // ==================================================

    /*
    GET COORDINATES

    This function reads the latitude and longitude inputs.

    parseFloat() converts text into a decimal number.

    For example:
        "47.505000" becomes 47.505

    We also check that the coordinates are geographically
    possible.

    Latitude:
        -90 = South Pole
         90 = North Pole

    Longitude:
       -180 to 180 = the full east/west range of Earth.
    */

    function getCoordinates() {

        const lat = Number.parseFloat(latInput.value);
        const lon = Number.parseFloat(lonInput.value);

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

    This is one of the most important functions in the program.

    It updates the website whenever the user chooses a location.

    It:
        1. Saves the selected coordinates in a variable.
        2. Updates the latitude and longitude inputs.
        3. Removes the previous map marker.
        4. Creates a new map marker.
        5. Optionally moves the map.
        6. Saves the location in localStorage.
        7. Updates the results panel.

    A marker is the pin or symbol placed on the map.

    The moveMap parameter determines whether the map should
    move to the selected coordinates.

    Its default value is false.
    */

    function selectLocation(lat, lon, moveMap = false) {

        // Check that the coordinates are valid.
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


        // Remember the currently selected coordinates.
        selectedLocation = { lat, lon };


        // Update the input boxes on the webpage.
        latInput.value = lat.toFixed(6);
        lonInput.value = lon.toFixed(6);


        // Remove the previous marker if one exists.
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }


        // Create a marker at the new coordinates.
        selectedMarker = L.marker([lat, lon]).addTo(map);


        // Create a popup that appears when the marker is clicked.
        selectedMarker.bindPopup(`
            <strong>Selected Location</strong><br>
            Latitude: ${lat.toFixed(6)}<br>
            Longitude: ${lon.toFixed(6)}
        `);


        // Move the map only if moveMap is true.
        if (moveMap) {
            map.setView([lat, lon], 12);
        }


        // Save the selected coordinates and current zoom.
        saveLastLocation(lat, lon);


        // Display information about the selected location.
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


    /*
    MAP CLICK EVENT

    Whenever the user clicks the map, Leaflet provides the
    coordinates of the clicked location.

    event.latlng contains the latitude and longitude.

    We pass those coordinates into selectLocation().

    This is how clicking the map updates the input boxes,
    marker, results panel, and saved location.
    */

    map.on("click", (event) => {

        selectLocation(
            event.latlng.lat,
            event.latlng.lng
        );

        console.log("Map location selected:", event.latlng);
    });


    /*
    READ AND SELECT INPUTS

    This function is used when the user manually enters
    coordinates into the latitude and longitude input boxes.

    It reads the values, checks them, and selects the location.

    The true value tells selectLocation() to move the map
    to the entered coordinates.
    */

    function readAndSelectInputs() {

        const { lat, lon } = getCoordinates();

        selectLocation(lat, lon, true);

        return { lat, lon };
    }



    // ==================================================
    // 8. WEATHER DESCRIPTIONS
    // ==================================================

    /*
    Open-Meteo returns weather conditions as numbers called
    WMO weather codes.

    These codes are standardized numbers representing
    different weather conditions.

    For example:
        0 = Clear sky
        3 = Overcast
        61 = Light rain
        71 = Light snow
        95 = Thunderstorm

    This function translates those numbers into words
    that are easier for people to understand.
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

    It is called when the user clicks the Generate Forecast
    button or when the GPS button retrieves their location.

    It:
        1. Reads the selected coordinates.
        2. Sends requests to Open-Meteo.
        3. Retrieves current weather conditions.
        4. Retrieves hourly forecast information.
        5. Retrieves ground elevation.
        6. Calculates estimated temperatures at higher elevations.
        7. Displays the information.
        8. Creates the temperature chart.

    The word 'async' means asynchronous.

    An asynchronous function can wait for something that
    takes time, such as downloading information from an API,
    without freezing the entire webpage.

    An API (Application Programming Interface) is a way for
    one program to request information or services from
    another program.

    In this case, our website asks Open-Meteo for weather
    and elevation information.
    */

    async function run() {

        let coordinates;


        // First, read and validate the coordinates.
        try {

            coordinates = readAndSelectInputs();

        } catch (error) {

            alert(error.message);

            return;
        }


        /*
        ABORT CONTROLLER

        A fetch request is a request to retrieve information
        from another server.

        Sometimes a user clicks Generate Forecast multiple
        times before the first request finishes.

        We do not want an older request to overwrite the
        results of a newer request.

        AbortController allows us to cancel an active request.

        If an earlier forecast is still running, cancel it
        before starting another one.
        */

        if (forecastController) {
            forecastController.abort();
        }


        // Create a controller for this new forecast request.
        const controller = new AbortController();

        forecastController = controller;

        const signal = controller.signal;


        // Disable the button while the forecast is loading.
        forecastBtn.disabled = true;

        forecastBtn.textContent = "Loading Forecast...";

        results.textContent =
            "Retrieving weather and elevation data...";


        const { lat, lon } = coordinates;



        // ==================================================
        // 9A. WEATHER API ADDRESS
        // ==================================================

        /*
        This is the address of the Open-Meteo weather API.

        URL means Uniform Resource Locator. It is the address
        used to locate a resource on the internet.

        URLSearchParams adds the information we want to request.

        We ask for:
            - Current temperature.
            - Current humidity.
            - Current wind speed.
            - Current weather code.
            - Hourly temperature.
            - Hourly precipitation probability.
            - Hourly wind speed.
            - Hourly weather code.

        We also request:
            - Two days of forecast data.
            - The location's local time zone.
            - Fahrenheit temperatures.
            - Wind speeds in miles per hour.
        */

        const weatherURL = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );

        weatherURL.search = new URLSearchParams({

            latitude: lat,
            longitude: lon,

            current:
                "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",

            hourly:
                "temperature_2m,precipitation_probability,wind_speed_10m,weather_code",

            forecast_days: "2",

            timezone: "auto",

            temperature_unit: "fahrenheit",

            wind_speed_unit: "mph"

        });



        // ==================================================
        // 9B. ELEVATION API ADDRESS
        // ==================================================

        /*
        This is a separate API request for the elevation
        of the selected coordinates.

        Elevation is the height of a location above sea level.

        The API returns elevation in meters.

        Later, we convert that value into feet.
        */

        const elevationURL = new URL(
            "https://api.open-meteo.com/v1/elevation"
        );

        elevationURL.search = new URLSearchParams({

            latitude: lat,
            longitude: lon

        });



        // ==================================================
        // 9C. REQUESTING THE INFORMATION
        // ==================================================

        /*
        fetch() sends a request to an internet address.

        We use Promise.all() to send both API requests at
        approximately the same time.

        A Promise represents an operation that may finish
        in the future.

        Promise.all() waits until both requests have finished.

        This is faster than waiting for the weather request
        to finish before starting the elevation request.
        */

        try {

            const [weatherResponse, elevationResponse] =
                await Promise.all([

                    fetch(weatherURL, { signal }),

                    fetch(elevationURL, { signal })

                ]);


            // Check whether either server reported an error.
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


            /*
            Convert the responses from JSON into JavaScript
            objects that we can work with.

            We can now access information using properties
            such as weather.current.temperature_2m.
            */

            const [weather, elevationData] = await Promise.all([

                weatherResponse.json(),

                elevationResponse.json()

            ]);



            // ==================================================
            // 9D. CHECKING THE API INFORMATION
            // ==================================================

            /*
            Never assume an internet service will always return
            exactly what we expect.

            We check that the important information exists
            before trying to use it.

            Array.isArray() checks whether something is a list.

            Number.isFinite() checks whether something is
            a valid, usable number.
            */

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

            /*
            We retrieve the current conditions from the
            weather response.

            The API returns temperature in Fahrenheit because
            we specifically requested Fahrenheit above.

            Elevation is returned in meters, so we convert
            it into feet.

            There are approximately 3.28084 feet in one meter.
            */

            const current = weather.current;

            const temperature = current.temperature_2m;

            const humidity = current.relative_humidity_2m;

            const wind = current.wind_speed_10m;

            const groundElevation =
                elevationData.elevation[0] * 3.28084;

            const conditions = weatherDescription(
                current.weather_code
            );


            // Make sure the current conditions are valid.
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

            /*
            The hourly forecast contains a list of times and
            corresponding weather information.

            We want to display the next six hours rather than
            displaying the entire two-day forecast.

            findIndex() searches an array and returns the
            position of the first matching item.

            We use it to find the first forecast hour that
            is at or after the current time.
            */

            const hourly = weather.hourly;

            let firstHour = hourly.time.findIndex(
                time => time >= current.time
            );


            // If no matching time is found, start at index zero.
            if (firstHour < 0) {
                firstHour = 0;
            }


            // Build the HTML table for the hourly forecast.
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


            /*
            A for loop repeats a section of code.

            Here, we start at the first upcoming hour and
            continue until we have displayed six hours
            or reached the end of the available forecast.
            */

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


                // Add another row to the HTML table.
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


            // Close the HTML table.
            hourlyHTML += "</table>";



            // ==================================================
            // 11. ELEVATION TEMPERATURE ESTIMATES
            // ==================================================

            /*
            Temperature generally decreases as elevation
            increases.

            We use a simplified temperature lapse rate of
            3.6°F per 1,000 feet of elevation gain.

            A lapse rate describes how temperature changes
            as altitude increases or decreases.

            IMPORTANT:

            This is an estimate, not an actual weather
            forecast for a mountain summit.

            Real mountain temperatures depend on many
            additional factors, including wind, sunlight,
            clouds, humidity, and weather systems.
            */


            // These arrays will hold information for the chart.
            const elevationLabels = [];

            const elevationTemperatures = [];


            // Start building the elevation results table.
            let elevationHTML = `

                <h3>Estimated Temperature by Elevation</h3>

                <table>

                    <tr>
                        <th>Elevation Gain</th>
                        <th>Estimated Temp</th>
                    </tr>

            `;


            /*
            This loop calculates estimated temperatures
            every 1,000 feet, from zero to 12,000 feet.

            For example:

                Ground temperature = 60°F

                At 1,000 feet:
                    60 - 3.6 = 56.4°F

                At 2,000 feet:
                    60 - 7.2 = 52.8°F
            */

            for (let gain = 0; gain <= 12000; gain += 1000) {

                const estimatedTemp =
                    temperature - (gain / 1000 * 3.6);


                // Create a readable elevation label.
                const label = gain === 0
                    ? "0"
                    : `+${gain.toLocaleString()}`;


                // Save the information for the chart.
                elevationLabels.push(label);

                elevationTemperatures.push(
                    Number(estimatedTemp.toFixed(1))
                );


                // Add the information to the results table.
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

            /*
            innerHTML changes the HTML inside an element.

            We use it to display the weather information
            that we retrieved and calculated above.

            The ${} sections insert JavaScript values into
            the HTML.

            This is called template literal interpolation.
            */

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

            /*
            Chart.js is a JavaScript library that creates charts.

            We check whether it loaded before trying to use it.

            If Chart.js is unavailable, we still display the
            weather information and elevation table.

            The chart is an additional visual representation
            of the elevation estimates.
            */

            if (typeof Chart === "undefined" || !chartCanvas) {

                console.warn(
                    "Chart.js or the chart canvas is unavailable. Weather results are still displayed."
                );

            } else {

                try {

                    // Remove the previous chart before creating
                    // a new one. Otherwise charts can overlap.
                    if (chart) {
                        chart.destroy();
                    }


                    // Create the new line chart.
                    chart = new Chart(chartCanvas, {

                        type: "line",

                        data: {

                            // The labels appear along the bottom.
                            labels: elevationLabels,

                            datasets: [{

                                label: "Estimated Temperature (°F)",

                                // These are the temperatures
                                // calculated in the elevation loop.
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


                            // Configure the horizontal and
                            // vertical axes of the chart.
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

            /*
            If something goes wrong while retrieving or
            processing weather information, this section
            catches the error.

            A catch block prevents an error from stopping
            the entire webpage.
            */

            // Canceled requests are expected and do not need
            // to display an error to the user.
            if (error.name === "AbortError") {
                return;
            }


            console.error("Forecast error:", error);


            // Display an understandable error message.
            results.innerHTML = `

                <div style="color:#ff8080">

                    <strong>Forecast unavailable</strong>

                    <p>${error.message}</p>

                    <p>Check your connection and try again.</p>

                </div>

            `;

        } finally {

            /*
            The finally block runs whether the forecast
            succeeded or failed.

            We use it to restore the Generate Forecast button.

            We only change the button if this is still the
            most recent request.
            */

            if (forecastController === controller) {

                forecastController = null;

                forecastBtn.disabled = false;

                forecastBtn.textContent = "Generate Forecast";
            }
        }
    }


    // When the user clicks Generate Forecast, run the function.
    forecastBtn.addEventListener("click", run);



    // ==================================================
    // 14. GPS / CURRENT LOCATION
    // ==================================================

    /*
    This section allows the user to use their device's GPS.

    GPS stands for Global Positioning System.

    The browser asks the device for its current geographic
    coordinates.

    The browser must have permission to access this information.

    Most browsers also require the website to use HTTPS
    (a secure connection) before allowing geolocation.

    getCurrentPosition() requests the current coordinates.

    It can take several seconds, so we provide success and
    error functions to handle both possible outcomes.
    */

    locateBtn.addEventListener("click", () => {

        // Check whether the browser supports GPS access.
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


                /*
                Run the normal forecast function.

                Because run() reads the input boxes, it will
                automatically use the GPS coordinates.
                */

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

    A route point is one geographic location in the route.

    For example:

        Point 1: Trailhead
        Point 2: Campsite
        Point 3: Summit

    The route is stored in an array called routePoints.

    Each route point is an object containing latitude and
    longitude.

    IMPORTANT:

    The line drawn between points is straight.

    It does not follow roads, hiking trails, or terrain.
    */


    // ==================================================
    // 15A. DRAW THE ROUTE
    // ==================================================

    /*
    renderRoute() redraws the route whenever a point is
    added or removed.

    It first removes the old line and markers.

    Then it draws the updated route using the current
    information in the routePoints array.
    */

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


        // If there are no points, display an empty message.
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


        /*
        If there are at least two points, draw a line
        connecting them.

        L.polyline() creates a line from a list of coordinates.

        The line is added to the map using addTo(map).
        */

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


        /*
        Create a marker for every route point.

        forEach() repeats a function for every item in an array.

        index represents the position of the point in the array.

        The first point has index 0, the second has index 1,
        and so on.
        */

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


            // Save the marker so we can remove it later.
            routeMarkers.push(routeMarker);
        });



        // ==================================================
        // 15B. DISPLAY THE ROUTE LIST
        // ==================================================

        /*
        We also display each route point in the sidebar.

        map() takes every item in an array and creates
        something new from it.

        join("") combines all the resulting HTML into one
        string that can be placed inside the route container.
        */

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

    /*
    When the user clicks Add Selected Location:

        1. Read the latitude and longitude inputs.
        2. Check that they contain valid coordinates.
        3. Add the coordinates to the routePoints array.
        4. Redraw the route.
        5. Update the selected location.

    We check that the route button exists before adding
    an event listener.

    This means the map can still work even if the route
    planner button is missing from the HTML.
    */

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

    /*
    Each route point has its own X button.

    Instead of creating a separate event listener for every
    X button, we put one event listener on the route container.

    This is called event delegation.

    The event listener checks whether the user clicked one
    of the remove buttons.

    If they did, we find its index and remove that point.
    */

    if (routeContainer) {

        routeContainer.addEventListener("click", event => {

            const removeButton = event.target.closest(
                ".remove-route-point"
            );


            // If the click was not on a remove button, do nothing.
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


            // splice() removes items from an array.
            // Here, we remove exactly one route point.
            routePoints.splice(index, 1);


            // Redraw the route without the removed point.
            renderRoute();
        });
    }



    // ==================================================
    // 15E. CLEAR THE ENTIRE ROUTE
    // ==================================================

    /*
    This button removes every route point.

    Setting an array's length to zero clears all of its items.

    We then call renderRoute() to remove the markers and
    line from the map.
    */

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
    This section is intentionally near the bottom.

    The map and selectLocation() function must already exist
    before we try to restore anything.

    Earlier in the file, we created loadLastLocation().

    Now we use that function to retrieve the saved coordinates.

    If a saved location exists:

        1. Move the map to those coordinates.
        2. Restore the previous zoom level.
        3. Recreate the selected marker.
        4. Update the latitude and longitude input boxes.

    If no location has ever been saved, the map stays at
    the default location set during initialization.
    */

    const savedLocation = loadLastLocation();

    if (savedLocation) {

        try {

            // Restore the map position and zoom first.
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

    /*
    This message appears in the browser's developer console.

    The developer console is a browser tool used to inspect
    messages, warnings, and errors generated by JavaScript.

    If this message appears, the main JavaScript initialization
    completed successfully.
    */

    console.log("Mountain Forecast Pro initialized.");

    console.log("Click the map to select a location.");

});
