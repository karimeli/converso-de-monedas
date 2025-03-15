const express = require('express');
const path = require('path');
const mariadb = require('mariadb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Crear pool de conexiones a MariaDB
const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '123',
    database: process.env.DB_NAME || 'conversor_monedas',
    connectionLimit: 10
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Lista de monedas soportadas
const monedasSoportadas = [
    'USD', 'EUR', 'GBP', 'MXN', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR',
    'BRL', 'CLP', 'COP', 'PEN', 'VES', 'RUB', 'TRY', 'ZAR', 'SEK', 'NOK',
    'DKK', 'NZD', 'SGD', 'HKD', 'KRW', 'THB', 'MYR', 'IDR', 'PHP', 'SAR',
    'AED', 'QAR', 'KWD', 'EGP', 'NGN', 'PLN', 'CZK', 'HUF', 'ILS', 'PKR',
    'BDT', 'LKR', 'VND', 'KZT', 'UAH', 'BYN', 'RSD', 'HRK', 'RON', 'BGN'
];

// Middleware para validar las monedas
const validarMonedas = (req, res, next) => {
    const { origen, destino } = req.params;
    if (!monedasSoportadas.includes(origen)) { 
        return res.status(400).send(`Moneda de origen no soportada: ${origen}`);
    }
    if (!monedasSoportadas.includes(destino)) {
        return res.status(400).send(`Moneda de destino no soportada: ${destino}`);
    }
    next();
};

// Ruta principal - sirve el archivo index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API ENDPOINTS

// Obtener todas las tasas de cambio
app.get('/api/tasas', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM monedas');
        conn.release();
        res.json(rows);
    } catch (err) {
        console.error('Error en /api/tasas:', err);
        res.status(500).send('Error al obtener las tasas de cambio');
    }
});

// Obtener una tasa de cambio específica
app.get('/api/tasas/:origen/:destino', validarMonedas, async (req, res) => {
    const { origen, destino } = req.params;
    try {
        const conn = await pool.getConnection();
        const rows = await conn.query('SELECT tasa_cambio FROM monedas WHERE divisa_origen = ? AND divisa_destino = ?', [origen, destino]);
        conn.release();
        if (rows.length > 0) {
            res.json({ origen, destino, tasa_cambio: rows[0].tasa_cambio });
        } else {
            res.status(404).send('Tasa de cambio no encontrada');
        }
    } catch (err) {
        console.error('Error en /api/tasas/:origen/:destino:', err);
        res.status(500).send('Error al obtener la tasa de cambio');
    }
});

// Agregar una nueva tasa de cambio
app.post('/api/tasas', async (req, res) => {
    const { divisa_origen, divisa_destino, tasa_cambio } = req.body;
    if (!monedasSoportadas.includes(divisa_origen) || !monedasSoportadas.includes(divisa_destino)) {
        return res.status(400).send('Moneda no soportada');
    }
    try {
        const conn = await pool.getConnection();
        await conn.query('INSERT INTO monedas (divisa_origen, divisa_destino, tasa_cambio) VALUES (?, ?, ?)', [divisa_origen, divisa_destino, tasa_cambio]);
        conn.release();
        res.send('Tasa agregada correctamente');
    } catch (err) {
        console.error('Error en POST /api/tasas:', err);
        res.status(500).send('Error al agregar la tasa de cambio');
    }
});

// Actualizar una tasa de cambio existente
app.put('/api/tasas/:origen/:destino', validarMonedas, async (req, res) => {
    const { origen, destino } = req.params;
    const { tasa_cambio } = req.body;
    try {
        const conn = await pool.getConnection();
        const result = await conn.query('UPDATE monedas SET tasa_cambio = ? WHERE divisa_origen = ? AND divisa_destino = ?', [tasa_cambio, origen, destino]);
        conn.release();
        if (result.affectedRows > 0) {
            res.send('Tasa actualizada correctamente');
        } else {
            res.status(404).send('Tasa de cambio no encontrada');
        }
    } catch (err) {
        console.error('Error en PUT /api/tasas/:origen/:destino:', err);
        res.status(500).send('Error al actualizar la tasa de cambio');
    }
});

// Eliminar una tasa de cambio
app.delete('/api/tasas/:origen/:destino', validarMonedas, async (req, res) => {
    const { origen, destino } = req.params;
    try {
        const conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM monedas WHERE divisa_origen = ? AND divisa_destino = ?', [origen, destino]);
        conn.release();
        if (result.affectedRows > 0) {
            res.send('Tasa eliminada correctamente');
        } else {
            res.status(404).send('Tasa de cambio no encontrada');
        }
    } catch (err) {
        console.error('Error en DELETE /api/tasas/:origen/:destino:', err);
        res.status(500).send('Error al eliminar la tasa de cambio');
    }
});

// Convertir una cantidad de una moneda a otra
app.get('/api/convertir/:origen/:destino/:cantidad', validarMonedas, async (req, res) => {
    const { origen, destino, cantidad } = req.params;
    try {
        const conn = await pool.getConnection();
        const rows = await conn.query('SELECT tasa_cambio FROM monedas WHERE divisa_origen = ? AND divisa_destino = ?', [origen, destino]);
        conn.release();
        if (rows.length > 0) {
            const resultado = parseFloat(cantidad) * rows[0].tasa_cambio;
            res.json({ origen, destino, cantidad: parseFloat(cantidad), resultado: resultado.toFixed(2) });
        } else {
            res.status(404).send('Tasa de cambio no encontrada');
        }
    } catch (err) {
        console.error('Error en /api/convertir:', err);
        res.status(500).send('Error al convertir la moneda');
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});