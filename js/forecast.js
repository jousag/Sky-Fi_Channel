"use strict";

// OpenWeatherMap API Key
const API_KEY = "4dde6e137f0d145d346da61d7086e193";

// DOM Elements - will be initialized after DOM loads
let searchForm, cityInput, forecastContainer, errorMessage, loading, locationBtn;
let hourlyForecast, dailyForecast, tabButtons, hourlySection, dailySection;

// Chart instance
let hourlyChart = null;

console.log("Combined forecast page loaded");

// Initialize after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - initializing elements');
    
    // Initialize DOM elements
    searchForm = document.getElementById("search-form");
    cityInput = document.getElementById("city-input");
    forecastContainer = document.getElementById("forecast-container");
    errorMessage = document.getElementById("error-message");
    loading = document.getElementById("loading");
    locationBtn = document.getElementById("location-btn");
    hourlyForecast = document.getElementById("hourly-forecast");
    dailyForecast = document.getElementById("daily-forecast");
    tabButtons = document.querySelectorAll(".tab-btn");
    hourlySection = document.getElementById("hourly-forecast-section");
    dailySection = document.getElementById("daily-forecast-section");
    
    console.log('Elements found:', {
        searchForm: !!searchForm,
        cityInput: !!cityInput,
        locationBtn: !!locationBtn,
        forecastContainer: !!forecastContainer
    });

    // Event Listeners
    if (searchForm) {
        searchForm.addEventListener("submit", handleSearch);
        console.log('Search form listener attached');
    }

    if (locationBtn) {
        locationBtn.addEventListener("click", handleLocationRequest);
        console.log('Location button listener attached');
    }

    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
});

// Switch between hourly and daily tabs
function switchTab(tab) {
    // Update tab buttons
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    // Update sections
    if (tab === "hourly") {
        hourlySection.classList.add("active");
        dailySection.classList.remove("active");
    } else {
        dailySection.classList.add("active");
        hourlySection.classList.remove("active");
    }
}
// Handle search form submission
async function handleSearch(e) {
    e.preventDefault();
    const cityName = cityInput.value.trim();
    console.log('Search submitted for city:', cityName);
    if (!cityName) {
        showError("Please enter a city name");
        return;
    }
    hideForecast();
    hideError();
    showLoading();

    try {
        const coordinates = await getCityCoordinates(cityName);
        console.log('City coordinates:', coordinates);
        const forecastData = await getForecastData(coordinates.lat, coordinates.lon);
        console.log('Forecast data fetched (search):', forecastData);
        displayForecast(forecastData, coordinates);
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || "Failed to fetch forecast for the specified city.");
    } finally {
        hideLoading();
    }
}

// Handle location button click
async function handleLocationRequest() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser");
        return;
    }
    
    hideForecast();
    hideError();
    showLoading();
    locationBtn.disabled = true;
    locationBtn.textContent = "📍 Getting location...";
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        const { latitude, longitude } = position.coords;
        console.log('Location found:', latitude, longitude);
        const forecastData = await getForecastData(latitude, longitude);
        console.log('Forecast data fetched (location):', forecastData);
        // Get city name from reverse geocoding
        const cityInfo = await reverseGeocode(latitude, longitude);
        const coordinates = {
            lat: latitude,
            lon: longitude,
            name: cityInfo.name || "Your Location",
            country: cityInfo.country || "",
            state: cityInfo.state || ""
        };
        console.log('Reverse geocoded city info:', cityInfo);
        displayForecast(forecastData, coordinates);
    } catch (error) {
        console.error("Geolocation error:", error);
        if (error.code === 1) {
            showError("Location access denied. Please enable location permissions.");
        } else if (error.code === 2) {
            showError("Location unavailable. Please check your device settings.");
        } else if (error.code === 3) {
            showError("Location request timed out. Please try again.");
        } else {
            showError(error.message || "Unable to get your location");
        }
    } finally {
        hideLoading();
        locationBtn.disabled = false;
        locationBtn.textContent = "📍 My Location";
    }
}

// Get city coordinates using OpenWeatherMap Geocoding API
async function getCityCoordinates(cityName) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error("Failed to fetch city data");
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
        throw new Error(`City "${cityName}" not found. Please try another city.`);
    }
    
    const city = data[0];
    return {
        lat: city.lat,
        lon: city.lon,
        name: city.name,
        country: city.country,
        state: city.state || ""
    };
}

// Reverse geocode coordinates to get city name
async function reverseGeocode(lat, lon) {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                name: data[0].name,
                country: data[0].country,
                state: data[0].state || ""
            };
        }
    } catch (error) {
        console.error("Reverse geocoding error:", error);
    }
    
    return { name: "Your Location", country: "", state: "" };
}

// Get both hourly and daily forecast data
async function getForecastData(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error("Failed to fetch forecast data");
    }
    
    const data = await response.json();
    
    return {
        city: data.city,
        hourly: data.list, // Show all available forecast points (up to 40, every 3 hours)
        daily: groupByDay(data.list)
    };
}

// Group 3-hour forecast data by day for 7-day forecast
function groupByDay(forecastList) {
    const days = {};
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toDateString();
        if (!days[dayKey]) {
            days[dayKey] = {
                date: date,
                temps: [],
                weather: [],
                humidity: [],
                wind: [],
                pop: []
            };
        }
        days[dayKey].temps.push(item.main.temp);
        days[dayKey].weather.push(item.weather[0]);
        days[dayKey].humidity.push(item.main.humidity);
        days[dayKey].wind.push(item.wind.speed);
        days[dayKey].pop.push(item.pop || 0);
    });
    return Object.values(days).map(day => {
        // Get the most common weather condition
        const weatherCounts = {};
        day.weather.forEach(w => {
            const key = w.main;
            weatherCounts[key] = (weatherCounts[key] || 0) + 1;
        });
        const dominantWeather = day.weather.reduce((prev, curr) => 
            (weatherCounts[curr.main] > weatherCounts[prev.main] ? curr : prev)
        );
        return {
            dt: Math.floor(day.date.getTime() / 1000),
            temp: {
                min: Math.min(...day.temps),
                max: Math.max(...day.temps),
                avg: day.temps.reduce((a, b) => a + b) / day.temps.length
            },
            weather: [dominantWeather],
            humidity: Math.round(day.humidity.reduce((a, b) => a + b) / day.humidity.length),
            wind_speed: day.wind.reduce((a, b) => a + b) / day.wind.length,
            pop: Math.max(...day.pop)
        };
    }).slice(0, 7); // Limit to 7 days
}

// Display both forecasts
function displayForecast(data, coordinates) {
    console.log('Displaying forecast:', data, coordinates);
    // Defensive: check for missing data
    if (!data || !Array.isArray(data.hourly) || data.hourly.length === 0 || !Array.isArray(data.daily) || data.daily.length === 0) {
        showError('No forecast data available.');
        console.error('No forecast data available:', data);
        hideForecast();
        return;
    }
    // Update header
    document.getElementById("city-name").textContent = 
        `${coordinates.name}${coordinates.country ? ", " + coordinates.country : ""}`;
    document.getElementById("coordinates").textContent = 
        `Lat: ${coordinates.lat.toFixed(4)}, Lon: ${coordinates.lon.toFixed(4)}`;
    // Clear previous forecasts
    hourlyForecast.innerHTML = "";
    dailyForecast.innerHTML = "";
    // Create hourly chart
    createHourlyChart(data.hourly);
    // Create hourly forecast cards
    data.hourly.forEach((hour, index) => {
        const card = createHourlyCard(hour, index === 0);
        hourlyForecast.appendChild(card);
    });
    // Create daily forecast cards
    data.daily.forEach((day, index) => {
        const card = createDailyCard(day, index === 0);
        dailyForecast.appendChild(card);
    });
    showForecast();
}

function createHourlyChart(hourlyData) {
    // Debug: Log hourlyData
    console.log('Hourly data for chart:', hourlyData);
    // Check if Frappe Charts is loaded
    if (typeof frappe === 'undefined') {
        showError('Frappe Charts library not loaded');
        console.error('Frappe Charts library not loaded');
        return;
    }
    // Check if hourlyData is valid
    if (!Array.isArray(hourlyData) || hourlyData.length === 0) {
        showError('No hourly forecast data available for chart.');
        console.error('No hourly forecast data available for chart:', hourlyData);
        return;
    }

    const labels = hourlyData.map((hour, index) => {
        if (!hour || !hour.dt) return 'N/A';
        const date = new Date(hour.dt * 1000);
        if (index === 0) return "Now";
        return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    });

    const datasets = [
        {
            name: "Temperature",
            values: hourlyData.map(hour => hour && hour.main ? Math.round(hour.main.temp) : null),
            chartType: "line",
        },
        {
            name: "Feels Like",
            values: hourlyData.map(hour => hour && hour.main ? Math.round(hour.main.feels_like) : null),
            chartType: "line",
        },
        {
            name: "Rain (mm/h)",
            values: hourlyData.map(hour => {
                let rain = 0;
                if (hour && hour.rain) {
                    if (typeof hour.rain['1h'] !== 'undefined') rain = hour.rain['1h'];
                    else if (typeof hour.rain['3h'] !== 'undefined') rain = hour.rain['3h'] / 3;
                }
                return Math.max(0, rain);
            }),
            chartType: "bar",
            y2Axis: true,
        },
    ];

    // Destroy previous chart if exists
    if (hourlyChart) {
        hourlyChart = null;
    }

    // Create new chart
    const chartContainer = document.getElementById("hourly-chart");
    chartContainer.innerHTML = ""; // Clear container

    const chartData = {
        labels: labels,
        datasets: datasets,
        yMarkers: [
            {
                label: "Freezing",
                value: 0,
                options: { labelPos: 'left' }
            }
        ]
    };

    hourlyChart = new frappe.Chart("#hourly-chart", {
        title: "Temperature & Weather Conditions",
        data: chartData,
        type: "axis-mixed",
        height: 300,
        colors: ["#ff6b6b", "#ffa726", "#4dabf7"],
        lineOptions: {
            regionFill: 1,
            hideDots: 0,
            heatline: 0,
            spline: 1
        },
        barOptions: {
            spaceRatio: 0.5
        },
        axisOptions: {
            xAxisMode: "tick",
            xIsSeries: false,
            yAxisMode: "span",
            y2AxisMode: "span"
        },
        tooltipOptions: {
            formatTooltipX: d => d,
            formatTooltipY: (d, index) => {
                // Check if this is the rain dataset (3rd dataset, index 2)
                if (index === 2) {
                    return d + " mm/h";
                }
                return d + "°C";
            }
        }
    });
}

// Create an hourly forecast card
function createHourlyCard(hourData, isNow) {
    const card = document.createElement("div");
    card.className = "forecast-card";
    
    // Format time
    const date = new Date(hourData.dt * 1000);
    const timeString = isNow ? "Now" : date.toLocaleTimeString("en-US", { 
        hour: "numeric", 
        hour12: true 
    });
    const dateString = date.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
    });
    
    // Get weather info
    const temp = Math.round(hourData.main.temp);
    const feelsLike = Math.round(hourData.main.feels_like);
    const description = hourData.weather[0].description;
    const icon = hourData.weather[0].icon;
    const humidity = hourData.main.humidity;
    const windSpeed = hourData.wind.speed;
    const pop = Math.round(hourData.pop * 100);
    
    card.innerHTML = `
        <div class="forecast-time">
            <strong>${timeString}</strong>
            <span class="forecast-date">${dateString}</span>
        </div>
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" 
             alt="${description}" 
             class="forecast-icon">
        <div class="forecast-temp">${temp}°C</div>
        <div class="forecast-description">${description.charAt(0).toUpperCase() + description.slice(1)}</div>
        <div class="forecast-details">
            <div class="detail-row">
                <span>💧 ${humidity}%</span>
                <span>💨 ${windSpeed} m/s</span>
            </div>
            <div class="detail-row">
                <span>Feels ${feelsLike}°C</span>
                ${pop > 0 ? `<span>🌧️ ${pop}%</span>` : ""}
            </div>
        </div>
    `;
    
    return card;
}

// Create a daily forecast card
function createDailyCard(dayData, isToday) {
    const card = document.createElement("div");
    card.className = "forecast-card daily-card";
    
    // Format date
    const date = new Date(dayData.dt * 1000);
    const dayName = isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "long" });
    const dateString = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    // Get weather info
    const tempMax = Math.round(dayData.temp.max);
    const tempMin = Math.round(dayData.temp.min);
    const description = dayData.weather[0].description;
    const icon = dayData.weather[0].icon;
    const humidity = dayData.humidity;
    const windSpeed = dayData.wind_speed.toFixed(1);
    const pop = Math.round(dayData.pop * 100);
    
    card.innerHTML = `
        <div class="forecast-day">
            <strong>${dayName}</strong>
            <span class="forecast-date">${dateString}</span>
        </div>
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" 
             alt="${description}" 
             class="forecast-icon">
        <div class="forecast-temp-range">
            <span class="temp-max">${tempMax}°</span>
            <span class="temp-divider">/</span>
            <span class="temp-min">${tempMin}°</span>
        </div>
        <div class="forecast-description">${description.charAt(0).toUpperCase() + description.slice(1)}</div>
        <div class="forecast-details">
            <div class="detail-row">
                <span>💧 ${humidity}%</span>
                <span>💨 ${windSpeed} m/s</span>
            </div>
            ${pop > 0 ? `<div class="detail-row"><span>🌧️ ${pop}% chance</span></div>` : ""}
        </div>
    `;
    
    return card;
}

// UI Helper Functions
function showLoading() {
    loading.classList.remove("hidden");
}

function hideLoading() {
    loading.classList.add("hidden");
}

function showForecast() {
    forecastContainer.classList.remove("hidden");
}

function hideForecast() {
    forecastContainer.classList.add("hidden");
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function hideError() {
    errorMessage.classList.add("hidden");
}
