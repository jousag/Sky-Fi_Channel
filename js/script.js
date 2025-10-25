// OpenWeatherMap API Key
const API_KEY = '4dde6e137f0d145d346da61d7086e193';

// DOM Elements
const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const weatherContainer = document.getElementById('weather-container');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const locationBtn = document.getElementById('location-btn');

// Event Listeners
searchForm.addEventListener('submit', handleSearch);
locationBtn.addEventListener('click', handleLocationRequest);

async function handleSearch(e) {
    e.preventDefault();
    const cityName = cityInput.value.trim();
    console.log('City name:', cityName);
    
    if (!cityName) {
        showError('Please enter a city name');
        return;
    }
    
    hideError();
    hideWeather();
    showLoading();
    
    try {
        // Step 1: Get coordinates from city name
        console.log('Fetching coordinates');
        const coordinates = await getCityCoordinates(cityName);
        console.log('Coordinates received:', coordinates);
        
        // Step 2: Get weather data using coordinates
        console.log('Fetching weather...');
        const weatherData = await getWeatherByCoordinates(coordinates.lat, coordinates.lon);
        console.log('Weather data received:', weatherData);
        
        // Step 3: Display the weather
        displayWeather(weatherData, coordinates);
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Handle location button click
async function handleLocationRequest() {
    console.log('Location button clicked');
    
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }
    
    hideError();
    hideWeather();
    showLoading();
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        const { latitude, longitude } = position.coords;
        console.log('User location:', { latitude, longitude });
        
        const weatherData = await getWeatherByCoordinates(latitude, longitude);
        console.log('Weather data received:', weatherData);
        
        const coordinates = {
            lat: latitude,
            lon: longitude,
            name: weatherData.name || 'Your Location',
            country: weatherData.sys?.country || '',
            state: ''
        };
        
        displayWeather(weatherData, coordinates);
        
    } catch (error) {
        console.error('Geolocation error:', error);
        
        // Handle specific geolocation errors
        if (error.code === 1) {
            showError('Location access denied. Please enable location permissions.');
        } else if (error.code === 2) {
            showError('Location unavailable. Please check your device settings.');
        } else if (error.code === 3) {
            showError('Location request timed out. Please try again.');
        } else {
            showError(error.message || 'Unable to get your location');
        }
    } finally {
        hideLoading();
    }
}

// Get city coordinates using OpenWeatherMap Geocoding API
async function getCityCoordinates(cityName) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch city data');
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
            state: city.state || ''
        };
        
    } catch (error) {
        throw new Error(error.message || 'Error fetching city coordinates');
    }
}

// Get weather data using coordinates
async function getWeatherByCoordinates(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch weather data');
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        throw new Error(error.message || 'Error fetching weather data');
    }
}

function displayWeather(data, coordinates) {
    document.getElementById('city-name').textContent = `${coordinates.name}, ${coordinates.country}`;
    document.getElementById('coordinates').textContent = `Lat: ${coordinates.lat.toFixed(4)}, Lon: ${coordinates.lon.toFixed(4)}`;
    document.getElementById('temp').textContent = Math.round(data.main.temp);
    
    // Update weather icon and description
    const iconCode = data.weather[0].icon;
    document.getElementById('weather-icon').src = 
        `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    document.getElementById('weather-icon').alt = data.weather[0].description;
    document.getElementById('weather-description').textContent = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);

    // Update weather details
    document.getElementById('feels-like').textContent = `${Math.round(data.main.feels_like)}°C`;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-speed').textContent = `${data.wind.speed} m/s`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;

    // Show weather container
    showWeather();
}

function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showWeather() {
    weatherContainer.classList.remove('hidden');
}

function hideWeather() {
    weatherContainer.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
