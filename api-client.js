// API Client for connecting frontend with .NET backend API

const API_BASE_URL = 'https://yourapiurl.com/api'; // Set your API base URL here

// Authentication functions
const login = async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (data.token) {
        localStorage.setItem('token', data.token);
    }
    return data;
};

const register = async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });
    return response.json();
};

const logout = () => {
    localStorage.removeItem('token');
};

const refreshToken = async () => {
    // Logic to refresh JWT token if needed
};

// Player functions
const getPlayer = async () => {
    const response = await requestWithToken(`${API_BASE_URL}/player`);
    return response.json();
};

const updatePlayerName = async (newName) => {
    const response = await requestWithToken(`${API_BASE_URL}/player/name`, 'PUT', { name: newName });
    return response.json();
};

const changeClass = async (newClass) => {
    const response = await requestWithToken(`${API_BASE_URL}/player/class`, 'PUT', { class: newClass });
    return response.json();
};

// Combat functions
const startCombat = async (enemyId) => {
    const response = await requestWithToken(`${API_BASE_URL}/combat/start`, 'POST', { enemyId });
    return response.json();
};

const attack = async (attackData) => {
    const response = await requestWithToken(`${API_BASE_URL}/combat/attack`, 'POST', attackData);
    return response.json();
};

const flee = async () => {
    const response = await requestWithToken(`${API_BASE_URL}/combat/flee`, 'POST');
    return response.json();
};

// Inventory functions
const getInventory = async () => {
    const response = await requestWithToken(`${API_BASE_URL}/inventory`);
    return response.json();
};

const equipItem = async (itemId) => {
    const response = await requestWithToken(`${API_BASE_URL}/inventory/equip`, 'POST', { itemId });
    return response.json();
};

const unequipItem = async (itemId) => {
    const response = await requestWithToken(`${API_BASE_URL}/inventory/unequip`, 'POST', { itemId });
    return response.json();
};

// Request interceptor for JWT tokens
const requestWithToken = async (url, method = 'GET', body = null) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!response.ok) {
        // Handle global errors here
        console.error('API Error:', response.statusText);
        throw new Error(response.statusText);
    }
    return response;
};

export { API_BASE_URL, login, register, logout, refreshToken, getPlayer, updatePlayerName, changeClass, startCombat, attack, flee, getInventory, equipItem, unequipItem };